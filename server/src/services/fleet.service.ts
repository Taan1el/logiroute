import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeofenceRepository } from '../repositories/geofence.repository.js';
import { AlertRepository } from '../repositories/alert.repository.js';
import { Geofence, Vehicle, VehicleStatus, AlertEvent, FleetMetrics } from '../../../shared/types.js';

export class FleetService {
  constructor(
    private vehicleRepo: VehicleRepository,
    private geofenceRepo: GeofenceRepository,
    private alertRepo: AlertRepository
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
    return this.geofenceRepo.createGeofence(dto);
  }

  listAlerts(limit?: number): AlertEvent[] {
    return this.alertRepo.listAlerts(limit);
  }

  getMetrics(): FleetMetrics {
    return this.alertRepo.getMetrics();
  }
}
