import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeofenceRepository } from '../repositories/geofence.repository.js';
import { AlertRepository } from '../repositories/alert.repository.js';
import { DeliveryRepository } from '../repositories/delivery.repository.js';
import { checkVehicleStatusChange, computeMetrics, DAY_MS, validateGeofenceInput } from '../../../shared/rules.js';
import { Geofence, Vehicle, VehicleStatus, AlertEvent, FleetMetrics } from '../../../shared/types.js';

export class FleetService {
  constructor(
    private vehicleRepo: VehicleRepository,
    private geofenceRepo: GeofenceRepository,
    private alertRepo: AlertRepository,
    private deliveryRepo: DeliveryRepository
  ) {}

  listVehicles(): Vehicle[] {
    return this.vehicleRepo.listVehicles();
  }

  getVehicleById(id: string): Vehicle | null {
    return this.vehicleRepo.getVehicleById(id);
  }

  updateVehicleStatus(id: string, status: VehicleStatus): Vehicle {
    const vehicle = this.vehicleRepo.getVehicleById(id);
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${id}`);
    }
    const hasActive = this.deliveryRepo
      .listDeliveries()
      .some((d) => d.vehicle_id === id && (d.status === 'dispatched' || d.status === 'in_transit'));
    const blocked = checkVehicleStatusChange(vehicle, status, hasActive);
    if (blocked) {
      throw new Error(blocked);
    }
    this.vehicleRepo.updateStatus(id, status);
    return this.vehicleRepo.getVehicleById(id)!;
  }

  listGeofences(): Geofence[] {
    return this.geofenceRepo.listGeofences();
  }

  createGeofence(dto: {
    name: string;
    center_lat: number;
    center_lng: number;
    radius_meters: number;
    alert_on_enter?: boolean;
    alert_on_exit?: boolean;
    color?: string;
  }): Geofence {
    const invalid = validateGeofenceInput(dto as unknown as Record<string, unknown>);
    if (invalid) {
      throw new Error(invalid);
    }
    return this.geofenceRepo.createGeofence({ ...dto, name: dto.name.trim() });
  }

  listAlerts(limit?: number): AlertEvent[] {
    return this.alertRepo.listAlerts(limit);
  }

  getMetrics(now = new Date()): FleetMetrics {
    const since = new Date(now.getTime() - DAY_MS).toISOString();
    return computeMetrics(
      this.vehicleRepo.listVehicles(),
      this.deliveryRepo.listDeliveries(),
      this.alertRepo.listSince(since),
      now
    );
  }
}
