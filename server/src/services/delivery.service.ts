import crypto from 'node:crypto';
import { DeliveryRepository } from '../repositories/delivery.repository.js';
import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeoService } from './geo.service.js';
import {
  checkTransition,
  DEFAULT_PICKUP,
  initialEtaMinutes,
  isDeliveryStatus,
  validateDeliveryInput,
} from '../../../shared/rules.js';
import { CreateDeliveryDto, Delivery, DeliveryStatus } from '../../../shared/types.js';

export class DeliveryService {
  constructor(
    private deliveryRepo: DeliveryRepository,
    private vehicleRepo: VehicleRepository,
    private geoService: GeoService
  ) {}

  listDeliveries(status?: DeliveryStatus): Delivery[] {
    if (status !== undefined && !isDeliveryStatus(status)) {
      throw new Error(`Unknown delivery status: ${String(status)}`);
    }
    return this.deliveryRepo.listDeliveries(status);
  }

  getDeliveryById(id: string): Delivery | null {
    return this.deliveryRepo.getDeliveryById(id);
  }

  createDelivery(dto: CreateDeliveryDto): Delivery {
    const invalid = validateDeliveryInput(dto);
    if (invalid) {
      throw new Error(invalid);
    }
    if (dto.vehicle_id !== undefined) {
      this.requireAssignableVehicle(dto.vehicle_id);
    }

    const pickupLat = dto.pickup_lat ?? DEFAULT_PICKUP.lat;
    const pickupLng = dto.pickup_lng ?? DEFAULT_PICKUP.lng;
    const distanceKm = this.geoService.haversineDistanceKm(
      { lat: pickupLat, lng: pickupLng },
      { lat: dto.dropoff_lat, lng: dto.dropoff_lng }
    );

    const delivery = this.deliveryRepo.createDelivery({
      tracking_code: this.newTrackingCode(),
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: dto.dropoff_lat,
      dropoff_lng: dto.dropoff_lng,
      destination_address: dto.destination_address.trim(),
      distance_km: distanceKm,
      eta_minutes: initialEtaMinutes(distanceKm),
      vehicle_id: dto.vehicle_id ?? null,
      status: dto.vehicle_id ? 'dispatched' : 'pending',
    });

    if (dto.vehicle_id) {
      this.vehicleRepo.updateStatus(dto.vehicle_id, 'en_route');
    }
    return delivery;
  }

  updateDeliveryStatus(id: string, status: DeliveryStatus): Delivery {
    if (!isDeliveryStatus(status)) {
      throw new Error(`Unknown delivery status: ${String(status)}`);
    }
    const delivery = this.deliveryRepo.getDeliveryById(id);
    if (!delivery) {
      throw new Error(`Delivery not found: ${id}`);
    }
    const blocked = checkTransition(delivery, status);
    if (blocked) {
      throw new Error(blocked);
    }

    const finished = status === 'arrived_at_hub' || status === 'completed';
    this.deliveryRepo.updateStatus(id, status, finished ? 0 : undefined);

    if (status === 'completed' && delivery.vehicle_id) {
      const stillBusy = this.deliveryRepo
        .listDeliveries()
        .some((d) => d.vehicle_id === delivery.vehicle_id && d.id !== id && d.status !== 'completed');
      if (!stillBusy) {
        this.vehicleRepo.updateStatus(delivery.vehicle_id, 'idle');
      }
    }
    return this.deliveryRepo.getDeliveryById(id)!;
  }

  assignVehicle(id: string, vehicleId: string): Delivery {
    const delivery = this.deliveryRepo.getDeliveryById(id);
    if (!delivery) {
      throw new Error(`Delivery not found: ${id}`);
    }
    if (delivery.status !== 'pending') {
      throw new Error(`Only pending deliveries can be assigned, this one is ${delivery.status}`);
    }
    this.requireAssignableVehicle(vehicleId);

    this.deliveryRepo.assignVehicle(id, vehicleId);
    this.vehicleRepo.updateStatus(vehicleId, 'en_route');
    this.deliveryRepo.updateStatus(id, 'dispatched');
    return this.deliveryRepo.getDeliveryById(id)!;
  }

  private requireAssignableVehicle(vehicleId: unknown): void {
    if (typeof vehicleId !== 'string') {
      throw new Error('vehicle_id must be a string');
    }
    const vehicle = this.vehicleRepo.getVehicleById(vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${vehicleId}`);
    }
    if (vehicle.status === 'maintenance') {
      throw new Error(`Vehicle ${vehicle.plate_number} is in maintenance and cannot take deliveries`);
    }
  }

  private newTrackingCode(): string {
    for (;;) {
      const code = `LR-TLN-${crypto.randomInt(100000, 1000000)}`;
      if (!this.deliveryRepo.getDeliveryByTrackingCode(code)) return code;
    }
  }
}
