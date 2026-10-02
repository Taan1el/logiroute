import { calculateHeading, isInsideGeofence } from './geo.js';
import type {
  AlertEvent,
  AlertSeverity,
  AlertType,
  Delivery,
  DeliveryStatus,
  FleetMetrics,
  Geofence,
  GeoPoint,
  IngestTelemetryDto,
  Vehicle,
} from './types.js';

export const OVERSPEED_KMH = 50;
export const LOW_BATTERY_PERCENT = 15;
/** A vehicle within this distance of a drop-off counts as arrived. */
export const ARRIVAL_RADIUS_KM = 0.08;
/** Assumed average speed for planning and initial estimates. */
export const PLANNING_SPEED_KMH = 30;
export const DISPATCH_BUFFER_MINUTES = 5;
/** Floor used for live ETAs so a stopped vehicle does not give an infinite estimate. */
export const MIN_ETA_SPEED_KMH = 25;
export const DEFAULT_PICKUP: GeoPoint = { lat: 59.4335, lng: 24.745 };
export const DAY_MS = 24 * 60 * 60 * 1000;

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending',
  'dispatched',
  'in_transit',
  'arrived_at_hub',
  'completed',
];

const NEXT_STATUS: Record<DeliveryStatus, DeliveryStatus | null> = {
  pending: 'dispatched',
  dispatched: 'in_transit',
  in_transit: 'arrived_at_hub',
  arrived_at_hub: 'completed',
  completed: null,
};

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (DELIVERY_STATUSES as string[]).includes(value);
}

export function nextDeliveryStatus(status: DeliveryStatus): DeliveryStatus | null {
  return NEXT_STATUS[status];
}

/** Statuses only move one step forward, and a vehicle is required once dispatched. */
export function checkTransition(delivery: Pick<Delivery, 'status' | 'vehicle_id'>, to: DeliveryStatus): string | null {
  if (NEXT_STATUS[delivery.status] !== to) {
    return `Cannot move a delivery from ${delivery.status} to ${to}`;
  }
  if (!delivery.vehicle_id) {
    return 'Assign a vehicle before changing the delivery status';
  }
  return null;
}

export function initialEtaMinutes(distanceKm: number): number {
  return Math.max(5, Math.round((distanceKm / PLANNING_SPEED_KMH) * 60) + DISPATCH_BUFFER_MINUTES);
}

export function liveEtaMinutes(distanceKm: number, speedKmh: number): number {
  return Math.max(1, Math.round((distanceKm / Math.max(speedKmh, MIN_ETA_SPEED_KMH)) * 60));
}

function checkRange(name: string, value: unknown, limit: number): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -limit || value > limit) {
    return `${name} must be a finite number between ${-limit} and ${limit}`;
  }
  return null;
}

function checkOptionalRange(name: string, value: unknown, min: number, max: number): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return `${name} must be a number between ${min} and ${max}`;
  }
  return null;
}

export function validateDeliveryInput(dto: unknown): string | null {
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return 'Delivery must be an object';
  const input = dto as Record<string, unknown>;
  if (typeof input.destination_address !== 'string' || !input.destination_address.trim()) {
    return 'Destination address must be a non-empty string';
  }
  for (const field of ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng']) {
    if (field.startsWith('pickup') && input[field] === undefined) continue;
    const error = checkRange(field, input[field], field.endsWith('lat') ? 90 : 180);
    if (error) return error;
  }
  return null;
}

export function validateTelemetryInput(dto: Partial<IngestTelemetryDto>): string | null {
  if (typeof dto.vehicle_id !== 'string' || !dto.vehicle_id) return 'vehicle_id is required';
  return (
    checkRange('lat', dto.lat, 90) ??
    checkRange('lng', dto.lng, 180) ??
    checkOptionalRange('speed_kmh', dto.speed_kmh, 0, 300) ??
    checkOptionalRange('battery_percent', dto.battery_percent, 0, 100) ??
    checkOptionalRange('heading_deg', dto.heading_deg, 0, 360)
  );
}

export function validateGeofenceInput(dto: Record<string, unknown>): string | null {
  if (typeof dto.name !== 'string' || !dto.name.trim()) return 'name must be a non-empty string';
  return (
    checkRange('center_lat', dto.center_lat, 90) ??
    checkRange('center_lng', dto.center_lng, 180) ??
    (typeof dto.radius_meters === 'number' &&
    Number.isFinite(dto.radius_meters) &&
    dto.radius_meters > 0 &&
    dto.radius_meters <= 50000
      ? null
      : 'radius_meters must be a number between 1 and 50000')
  );
}

export interface NewAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  lat: number;
  lng: number;
}

export interface TelemetryOutcome {
  speed_kmh: number;
  battery_percent: number;
  heading_deg: number;
  alerts: NewAlert[];
}

/**
 * Applies the alert rules to one ping: geofence enter and exit (compared
 * with the previous position), overspeed on every ping above the limit, and
 * low battery only when the level crosses the threshold.
 */
export function evaluateTelemetry(
  previous: Vehicle,
  dto: IngestTelemetryDto,
  geofences: Geofence[],
): TelemetryOutcome {
  const prevPos = { lat: previous.current_lat, lng: previous.current_lng };
  const newPos = { lat: dto.lat, lng: dto.lng };
  const moved = prevPos.lat !== newPos.lat || prevPos.lng !== newPos.lng;
  const heading =
    dto.heading_deg !== undefined && !Number.isNaN(dto.heading_deg)
      ? dto.heading_deg
      : moved
        ? calculateHeading(prevPos, newPos)
        : previous.heading_deg;
  const speed = dto.speed_kmh ?? previous.speed_kmh;
  const battery = dto.battery_percent ?? previous.battery_percent;
  const alerts: NewAlert[] = [];

  for (const gf of geofences) {
    const wasInside = isInsideGeofence(prevPos, gf);
    const isInside = isInsideGeofence(newPos, gf);
    if (!wasInside && isInside && gf.alert_on_enter) {
      alerts.push({ type: 'geofence_entered', severity: 'info', message: `Vehicle entered geofence: ${gf.name}`, ...newPos });
    } else if (wasInside && !isInside && gf.alert_on_exit) {
      alerts.push({ type: 'geofence_exited', severity: 'warning', message: `Vehicle exited geofence: ${gf.name}`, ...newPos });
    }
  }
  if (speed > OVERSPEED_KMH) {
    alerts.push({
      type: 'overspeed_detected',
      severity: 'warning',
      message: `Speed limit exceeded: ${Math.round(speed)} km/h in Tallinn urban zone (${OVERSPEED_KMH} km/h limit)`,
      ...newPos,
    });
  }
  if (battery < LOW_BATTERY_PERCENT && previous.battery_percent >= LOW_BATTERY_PERCENT) {
    alerts.push({
      type: 'low_battery',
      severity: 'critical',
      message: `Battery low: ${battery}% remaining. Plan a charging stop for this vehicle.`,
      ...newPos,
    });
  }
  return { speed_kmh: speed, battery_percent: battery, heading_deg: heading, alerts };
}

export interface DeliveryUpdate {
  id: string;
  eta_minutes: number;
  /** True when an in-transit delivery is within the arrival radius. */
  arrived: boolean;
}

/** Recomputes ETAs of a vehicle's dispatched and in-transit deliveries after a ping. */
export function progressDeliveries(
  deliveries: Delivery[],
  vehicleId: string,
  position: GeoPoint,
  speedKmh: number,
  distanceKm: (a: GeoPoint, b: GeoPoint) => number,
): DeliveryUpdate[] {
  return deliveries
    .filter((d) => d.vehicle_id === vehicleId && (d.status === 'dispatched' || d.status === 'in_transit'))
    .map((d) => {
      const km = distanceKm(position, { lat: d.dropoff_lat, lng: d.dropoff_lng });
      return {
        id: d.id,
        eta_minutes: liveEtaMinutes(km, speedKmh),
        arrived: d.status === 'in_transit' && km <= ARRIVAL_RADIUS_KM,
      };
    });
}

export function computeMetrics(
  vehicles: Vehicle[],
  deliveries: Delivery[],
  alerts: AlertEvent[],
  now: Date,
): FleetMetrics {
  const since = now.getTime() - DAY_MS;
  const within = (iso: string): boolean => new Date(iso).getTime() >= since;
  const battery = vehicles.reduce((sum, v) => sum + v.battery_percent, 0);
  return {
    total_vehicles: vehicles.length,
    active_en_route: vehicles.filter((v) => v.status === 'en_route').length,
    active_deliveries: deliveries.filter((d) => d.status === 'dispatched' || d.status === 'in_transit').length,
    completed_24h: deliveries.filter((d) => d.status === 'completed' && within(d.updated_at)).length,
    alerts_24h: alerts.filter((a) => within(a.created_at)).length,
    avg_battery_percent: vehicles.length ? Math.round((battery / vehicles.length) * 10) / 10 : 0,
  };
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
