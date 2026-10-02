import type {
  AlertEvent,
  CreateDeliveryDto,
  Delivery,
  DeliveryStatus,
  IngestTelemetryDto,
  Vehicle,
  VehicleStatus,
} from '../../../shared/types';
import { haversineDistanceKm } from '../../../shared/geo';
import {
  checkAssignable,
  checkAssignableVehicle,
  checkTransition,
  checkVehicleStatusChange,
  computeMetrics,
  DEFAULT_PICKUP,
  evaluateTelemetry,
  initialEtaMinutes,
  isDeliveryStatus,
  progressDeliveries,
  validateDeliveryInput,
  validateTelemetryInput,
} from '../../../shared/rules';
import type { Backend } from '../services/api';
import { buildSampleData, FIRST_NEW_TRACKING_NUMBER, type SampleData } from './sample';

export interface DemoBackend extends Backend {
  reset(): void;
}

const copy = <T,>(value: T): T => structuredClone(value);

/**
 * In-browser stand-in for the API. It applies the same shared rules as the
 * server (validation, status transitions, alert rules, ETAs, metrics) to an
 * in-memory copy of the sample data; nothing is stored or sent anywhere.
 */
export function createDemoBackend(clock: () => Date = () => new Date()): DemoBackend {
  let data: SampleData = buildSampleData(clock());
  let trackingNumber = FIRST_NEW_TRACKING_NUMBER;
  let alertCounter = 0;

  const nowIso = (): string => clock().toISOString();
  const vehicleById = (id: string): Vehicle | undefined => data.vehicles.find((v) => v.id === id);
  const deliveryById = (id: string): Delivery => {
    const found = data.deliveries.find((d) => d.id === id);
    if (!found) throw new Error(`Delivery not found: ${id}`);
    return found;
  };
  const requireVehicle = (id: unknown): Vehicle => {
    if (typeof id !== 'string') throw new Error('vehicle_id must be a string');
    const vehicle = vehicleById(id);
    if (!vehicle) throw new Error(`Vehicle not found: ${id}`);
    const blocked = checkAssignableVehicle(vehicle);
    if (blocked) throw new Error(blocked);
    return vehicle;
  };
  const hasActive = (vehicleId: string): boolean =>
    data.deliveries.some((d) => d.vehicle_id === vehicleId && (d.status === 'dispatched' || d.status === 'in_transit'));
  const touch = (delivery: Delivery, patch: Partial<Delivery>): void => {
    Object.assign(delivery, patch, { updated_at: nowIso() });
  };

  return {
    reset() {
      data = buildSampleData(clock());
      trackingNumber = FIRST_NEW_TRACKING_NUMBER;
      alertCounter = 0;
    },

    async getVehicles() {
      return copy(data.vehicles);
    },

    async updateVehicleStatus(id: string, status: VehicleStatus) {
      const vehicle = vehicleById(id);
      if (!vehicle) throw new Error(`Vehicle not found: ${id}`);
      const blocked = checkVehicleStatusChange(vehicle, status, hasActive(id));
      if (blocked) throw new Error(blocked);
      vehicle.status = status;
      vehicle.updated_at = nowIso();
      return copy(vehicle);
    },

    async getGeofences() {
      return copy(data.geofences);
    },

    async getDeliveries(status?: DeliveryStatus) {
      if (status !== undefined && !isDeliveryStatus(status)) throw new Error(`Unknown delivery status: ${String(status)}`);
      return copy(data.deliveries.filter((d) => status === undefined || d.status === status));
    },

    async createDelivery(dto: CreateDeliveryDto) {
      const invalid = validateDeliveryInput(dto);
      if (invalid) throw new Error(invalid);
      const vehicle = dto.vehicle_id !== undefined ? requireVehicle(dto.vehicle_id) : null;
      const pickup = { lat: dto.pickup_lat ?? DEFAULT_PICKUP.lat, lng: dto.pickup_lng ?? DEFAULT_PICKUP.lng };
      const distanceKm = haversineDistanceKm(pickup, { lat: dto.dropoff_lat, lng: dto.dropoff_lng });
      const stamp = nowIso();
      const delivery: Delivery = {
        id: `del-${trackingNumber}`,
        tracking_code: `LR-TLN-${trackingNumber++}`,
        vehicle_id: vehicle?.id ?? null,
        vehicle_plate: vehicle?.plate_number ?? null,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_lat: dto.dropoff_lat,
        dropoff_lng: dto.dropoff_lng,
        destination_address: dto.destination_address.trim(),
        status: vehicle ? 'dispatched' : 'pending',
        distance_km: distanceKm,
        eta_minutes: initialEtaMinutes(distanceKm),
        created_at: stamp,
        updated_at: stamp,
      };
      data.deliveries.unshift(delivery);
      if (vehicle) vehicle.status = 'en_route';
      return copy(delivery);
    },

    async updateDeliveryStatus(id: string, status: DeliveryStatus) {
      if (!isDeliveryStatus(status)) throw new Error(`Unknown delivery status: ${String(status)}`);
      const delivery = deliveryById(id);
      const blocked = checkTransition(delivery, status);
      if (blocked) throw new Error(blocked);
      const finished = status === 'arrived_at_hub' || status === 'completed';
      touch(delivery, { status, ...(finished ? { eta_minutes: 0 } : {}) });
      if (status === 'completed' && delivery.vehicle_id) {
        const busy = data.deliveries.some((d) => d.vehicle_id === delivery.vehicle_id && d.id !== id && d.status !== 'completed');
        const vehicle = vehicleById(delivery.vehicle_id);
        if (vehicle && !busy) vehicle.status = 'idle';
      }
      return copy(delivery);
    },

    async assignVehicle(deliveryId: string, vehicleId: string) {
      const delivery = deliveryById(deliveryId);
      const notAssignable = checkAssignable(delivery);
      if (notAssignable) throw new Error(notAssignable);
      const vehicle = requireVehicle(vehicleId);
      vehicle.status = 'en_route';
      touch(delivery, { vehicle_id: vehicle.id, vehicle_plate: vehicle.plate_number, status: 'dispatched' });
      return copy(delivery);
    },

    async ingestTelemetry(dto: IngestTelemetryDto) {
      const invalid = validateTelemetryInput(dto);
      if (invalid) throw new Error(invalid);
      const vehicle = vehicleById(dto.vehicle_id);
      if (!vehicle) throw new Error(`Vehicle not found: ${dto.vehicle_id}`);

      const outcome = evaluateTelemetry(vehicle, dto, data.geofences);
      Object.assign(vehicle, {
        current_lat: dto.lat,
        current_lng: dto.lng,
        speed_kmh: outcome.speed_kmh,
        battery_percent: outcome.battery_percent,
        heading_deg: outcome.heading_deg,
        updated_at: nowIso(),
      });

      const triggeredAlerts: AlertEvent[] = outcome.alerts.map((alert) => ({
        id: `alert-demo-${++alertCounter}`,
        vehicle_id: vehicle.id,
        vehicle_plate: vehicle.plate_number,
        created_at: nowIso(),
        ...alert,
      }));
      data.alerts = [...[...triggeredAlerts].reverse(), ...data.alerts];

      const updates = progressDeliveries(
        data.deliveries,
        vehicle.id,
        { lat: dto.lat, lng: dto.lng },
        outcome.speed_kmh,
        haversineDistanceKm,
      );
      for (const update of updates) {
        touch(deliveryById(update.id), update.arrived ? { status: 'arrived_at_hub', eta_minutes: 0 } : { eta_minutes: update.eta_minutes });
      }
      return copy({ vehicle, triggeredAlerts });
    },

    async getAlerts(limit = 50) {
      return copy(data.alerts.slice(0, Math.max(1, Math.min(limit, 200))));
    },

    async getMetrics() {
      return computeMetrics(data.vehicles, data.deliveries, data.alerts, clock());
    },
  };
}
