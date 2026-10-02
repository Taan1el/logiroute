import crypto from 'node:crypto';
import { DeliveryRepository } from '../repositories/delivery.repository.js';
import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeoService } from './geo.service.js';
import { CreateDeliveryDto, Delivery, DeliveryStatus } from '../../../shared/types.js';

export class DeliveryService {
  constructor(
    private deliveryRepo: DeliveryRepository,
    private vehicleRepo: VehicleRepository,
    private geoService: GeoService
  ) {}

  listDeliveries(status?: DeliveryStatus): Delivery[] {
    return this.deliveryRepo.listDeliveries(status);
  }

  getDeliveryById(id: string): Delivery | null {
    return this.deliveryRepo.getDeliveryById(id);
  }

  createDelivery(dto: CreateDeliveryDto): Delivery {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
      throw new Error('Delivery must be an object');
    }
    if (typeof dto.destination_address !== 'string' || !dto.destination_address.trim()) {
      throw new Error('Destination address must be a non-empty string');
    }
    for (const field of ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng'] as const) {
      const value = dto[field];
      if (field.startsWith('pickup') && value === undefined) continue;
      const limit = field.endsWith('lat') ? 90 : 180;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -limit || value > limit) {
        throw new Error(`${field} must be a finite number between ${-limit} and ${limit}`);
      }
    }

    // Default pickup location: Vabaduse Hub Tallinn
    const pickupLat = dto.pickup_lat ?? 59.4335;
    const pickupLng = dto.pickup_lng ?? 24.745;
    const dropoffLat = dto.dropoff_lat;
    const dropoffLng = dto.dropoff_lng;

    const distanceKm = this.geoService.haversineDistanceKm(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng }
    );

    // Initial ETA estimate (30 km/h urban speed + 5 min dispatch buffer)
    const etaMinutes = Math.max(5, Math.round((distanceKm / 30) * 60) + 5);
    const trackingCode = `LR-TLN-${Math.floor(100000 + Math.random() * 900000)}`;

    const delivery = this.deliveryRepo.createDelivery({
      tracking_code: trackingCode,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      destination_address: dto.destination_address.trim(),
      distance_km: distanceKm,
      eta_minutes: etaMinutes,
      vehicle_id: dto.vehicle_id ?? null,
      status: dto.vehicle_id ? 'dispatched' : 'pending',
    });

    if (dto.vehicle_id) {
      this.vehicleRepo.updateStatus(dto.vehicle_id, 'en_route');
    }

    return delivery;
  }

  updateDeliveryStatus(id: string, status: DeliveryStatus): Delivery {
    const delivery = this.deliveryRepo.getDeliveryById(id);
    if (!delivery) {
      throw new Error(`Delivery not found: ${id}`);
    }

    this.deliveryRepo.updateStatus(id, status);

    // If completed or pending, check if assigned vehicle has active deliveries
    if (status === 'completed' && delivery.vehicle_id) {
      const remaining = this.deliveryRepo
        .listDeliveries()
        .filter((d) => d.vehicle_id === delivery.vehicle_id && d.id !== id && d.status !== 'completed');

      if (remaining.length === 0) {
        this.vehicleRepo.updateStatus(delivery.vehicle_id, 'idle');
      }
    } else if ((status === 'dispatched' || status === 'in_transit') && delivery.vehicle_id) {
      this.vehicleRepo.updateStatus(delivery.vehicle_id, 'en_route');
    }

    return this.deliveryRepo.getDeliveryById(id)!;
  }

  assignVehicle(id: string, vehicleId: string): Delivery {
    const delivery = this.deliveryRepo.getDeliveryById(id);
    if (!delivery) {
      throw new Error(`Delivery not found: ${id}`);
    }

    const vehicle = this.vehicleRepo.getVehicleById(vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${vehicleId}`);
    }

    this.deliveryRepo.assignVehicle(id, vehicleId);
    this.vehicleRepo.updateStatus(vehicleId, 'en_route');

    if (delivery.status === 'pending') {
      this.deliveryRepo.updateStatus(id, 'dispatched');
    }

    return this.deliveryRepo.getDeliveryById(id)!;
  }
}
