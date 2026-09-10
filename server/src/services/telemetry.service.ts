import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeofenceRepository } from '../repositories/geofence.repository.js';
import { AlertRepository } from '../repositories/alert.repository.js';
import { DeliveryRepository } from '../repositories/delivery.repository.js';
import { GeoService } from './geo.service.js';
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
    const prevVehicle = this.vehicleRepo.getVehicleById(dto.vehicle_id);
    if (!prevVehicle) {
      throw new Error(`Vehicle not found: ${dto.vehicle_id}`);
    }

    const prevPos = { lat: prevVehicle.current_lat, lng: prevVehicle.current_lng };
    const newPos = { lat: dto.lat, lng: dto.lng };

    // Calculate heading if not explicitly provided
    let heading = dto.heading_deg;
    if (heading === undefined || isNaN(heading)) {
      if (prevPos.lat !== newPos.lat || prevPos.lng !== newPos.lng) {
        heading = this.geoService.calculateHeading(prevPos, newPos);
      } else {
        heading = prevVehicle.heading_deg;
      }
    }

    const speed = dto.speed_kmh ?? prevVehicle.speed_kmh;
    const battery = dto.battery_percent ?? prevVehicle.battery_percent;

    // 1. Record ping in audit log
    this.alertRepo.recordTelemetryPing({
      vehicle_id: dto.vehicle_id,
      lat: dto.lat,
      lng: dto.lng,
      speed_kmh: speed,
      battery_percent: battery,
      heading_deg: heading,
    });

    // 2. Update current vehicle position
    this.vehicleRepo.updatePosition(dto.vehicle_id, dto.lat, dto.lng, speed, heading, battery);

    const triggeredAlerts: AlertEvent[] = [];

    // 3. Geofence enter / exit checks
    const geofences = this.geofenceRepo.listGeofences();
    for (const gf of geofences) {
      const wasInside = this.geoService.isInsideGeofence(prevPos, gf);
      const isInside = this.geoService.isInsideGeofence(newPos, gf);

      if (!wasInside && isInside && gf.alert_on_enter) {
        const alert = this.alertRepo.createAlert({
          vehicle_id: dto.vehicle_id,
          type: 'geofence_entered',
          severity: 'info',
          message: `Vehicle entered geofence: ${gf.name}`,
          lat: dto.lat,
          lng: dto.lng,
        });
        triggeredAlerts.push(alert);
      } else if (wasInside && !isInside && gf.alert_on_exit) {
        const alert = this.alertRepo.createAlert({
          vehicle_id: dto.vehicle_id,
          type: 'geofence_exited',
          severity: 'warning',
          message: `Vehicle exited geofence: ${gf.name}`,
          lat: dto.lat,
          lng: dto.lng,
        });
        triggeredAlerts.push(alert);
      }
    }

    // 4. Overspeed checks (> 50 km/h city limit)
    if (speed > 50) {
      const alert = this.alertRepo.createAlert({
        vehicle_id: dto.vehicle_id,
        type: 'overspeed_detected',
        severity: 'warning',
        message: `Speed limit exceeded: ${Math.round(speed)} km/h in Tallinn urban zone (50 km/h limit)`,
        lat: dto.lat,
        lng: dto.lng,
      });
      triggeredAlerts.push(alert);
    }

    // 5. Battery critical checks (< 15%)
    if (battery < 15 && prevVehicle.battery_percent >= 15) {
      const alert = this.alertRepo.createAlert({
        vehicle_id: dto.vehicle_id,
        type: 'low_battery',
        severity: 'critical',
        message: `Battery critically low: ${battery}% remaining. Vehicle requires charging station dispatch.`,
        lat: dto.lat,
        lng: dto.lng,
      });
      triggeredAlerts.push(alert);
    }

    // 6. Update active deliveries associated with this vehicle
    const activeDeliveries = this.deliveryRepo
      .listDeliveries()
      .filter((d) => d.vehicle_id === dto.vehicle_id && (d.status === 'dispatched' || d.status === 'in_transit'));

    for (const delivery of activeDeliveries) {
      const dropoff = { lat: delivery.dropoff_lat, lng: delivery.dropoff_lng };
      const distKm = this.geoService.haversineDistanceKm(newPos, dropoff);
      const effectiveSpeed = Math.max(speed, 25);
      const etaMinutes = Math.max(1, Math.round((distKm / effectiveSpeed) * 60));

      if (distKm <= 0.08) {
        // Within 80 meters of destination -> mark arrived at hub / destination
        this.deliveryRepo.updateStatus(delivery.id, 'arrived_at_hub', 0);
      } else {
        this.deliveryRepo.updateEta(delivery.id, etaMinutes);
      }
    }

    const updatedVehicle = this.vehicleRepo.getVehicleById(dto.vehicle_id)!;
    return { vehicle: updatedVehicle, triggeredAlerts };
  }
}
