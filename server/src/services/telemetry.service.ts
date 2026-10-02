import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeofenceRepository } from '../repositories/geofence.repository.js';
import { AlertRepository } from '../repositories/alert.repository.js';
import { DeliveryRepository } from '../repositories/delivery.repository.js';
import { GeoService } from './geo.service.js';
import { evaluateTelemetry, progressDeliveries, validateTelemetryInput } from '../../../shared/rules.js';
import { AlertEvent, IngestTelemetryDto, Vehicle } from '../../../shared/types.js';

export class TelemetryService {
  constructor(
    private vehicleRepo: VehicleRepository,
    private geofenceRepo: GeofenceRepository,
    private alertRepo: AlertRepository,
    private deliveryRepo: DeliveryRepository,
    private geoService: GeoService
  ) {}

  ingest(dto: IngestTelemetryDto): { vehicle: Vehicle; triggeredAlerts: AlertEvent[] } {
    const invalid = validateTelemetryInput(dto);
    if (invalid) {
      throw new Error(invalid);
    }
    const previous = this.vehicleRepo.getVehicleById(dto.vehicle_id);
    if (!previous) {
      throw new Error(`Vehicle not found: ${dto.vehicle_id}`);
    }

    const outcome = evaluateTelemetry(previous, dto, this.geofenceRepo.listGeofences());

    this.alertRepo.recordTelemetryPing({
      vehicle_id: dto.vehicle_id,
      lat: dto.lat,
      lng: dto.lng,
      speed_kmh: outcome.speed_kmh,
      battery_percent: outcome.battery_percent,
      heading_deg: outcome.heading_deg,
    });
    this.vehicleRepo.updatePosition(
      dto.vehicle_id,
      dto.lat,
      dto.lng,
      outcome.speed_kmh,
      outcome.heading_deg,
      outcome.battery_percent
    );

    const triggeredAlerts = outcome.alerts.map((alert) =>
      this.alertRepo.createAlert({ vehicle_id: dto.vehicle_id, ...alert })
    );

    const updates = progressDeliveries(
      this.deliveryRepo.listDeliveries(),
      dto.vehicle_id,
      { lat: dto.lat, lng: dto.lng },
      outcome.speed_kmh,
      (a, b) => this.geoService.haversineDistanceKm(a, b)
    );
    for (const update of updates) {
      if (update.arrived) {
        this.deliveryRepo.updateStatus(update.id, 'arrived_at_hub', 0);
      } else {
        this.deliveryRepo.updateEta(update.id, update.eta_minutes);
      }
    }

    return { vehicle: this.vehicleRepo.getVehicleById(dto.vehicle_id)!, triggeredAlerts };
  }
}
