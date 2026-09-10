import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { Delivery, DeliveryStatus } from '../../../shared/types.js';

export class DeliveryRepository {
  constructor(private db: DatabaseSync) {}

  listDeliveries(status?: DeliveryStatus): Delivery[] {
    let sql = `
      SELECT d.*, v.plate_number as vehicle_plate
      FROM deliveries d
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
    `;
    const params: any[] = [];
    if (status) {
      sql += ' WHERE d.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY d.created_at DESC;';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      tracking_code: r.tracking_code,
      vehicle_id: r.vehicle_id ?? null,
      vehicle_plate: r.vehicle_plate ?? null,
      pickup_lat: Number(r.pickup_lat),
      pickup_lng: Number(r.pickup_lng),
      dropoff_lat: Number(r.dropoff_lat),
      dropoff_lng: Number(r.dropoff_lng),
      destination_address: r.destination_address,
      status: r.status as DeliveryStatus,
      distance_km: Number(r.distance_km),
      eta_minutes: Number(r.eta_minutes),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  getDeliveryById(id: string): Delivery | null {
    const stmt = this.db.prepare(`
      SELECT d.*, v.plate_number as vehicle_plate
      FROM deliveries d
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.id = ?;
    `);
    const r = stmt.get(id) as any;
    if (!r) return null;

    return {
      id: r.id,
      tracking_code: r.tracking_code,
      vehicle_id: r.vehicle_id ?? null,
      vehicle_plate: r.vehicle_plate ?? null,
      pickup_lat: Number(r.pickup_lat),
      pickup_lng: Number(r.pickup_lng),
      dropoff_lat: Number(r.dropoff_lat),
      dropoff_lng: Number(r.dropoff_lng),
      destination_address: r.destination_address,
      status: r.status as DeliveryStatus,
      distance_km: Number(r.distance_km),
      eta_minutes: Number(r.eta_minutes),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  getDeliveryByTrackingCode(trackingCode: string): Delivery | null {
    const stmt = this.db.prepare(`
      SELECT d.*, v.plate_number as vehicle_plate
      FROM deliveries d
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.tracking_code = ?;
    `);
    const r = stmt.get(trackingCode) as any;
    if (!r) return null;

    return {
      id: r.id,
      tracking_code: r.tracking_code,
      vehicle_id: r.vehicle_id ?? null,
      vehicle_plate: r.vehicle_plate ?? null,
      pickup_lat: Number(r.pickup_lat),
      pickup_lng: Number(r.pickup_lng),
      dropoff_lat: Number(r.dropoff_lat),
      dropoff_lng: Number(r.dropoff_lng),
      destination_address: r.destination_address,
      status: r.status as DeliveryStatus,
      distance_km: Number(r.distance_km),
      eta_minutes: Number(r.eta_minutes),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  createDelivery(data: {
    tracking_code: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat: number;
    dropoff_lng: number;
    destination_address: string;
    distance_km: number;
    eta_minutes: number;
    vehicle_id?: string | null;
    status?: DeliveryStatus;
  }): Delivery {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const status = data.status || 'pending';

    const stmt = this.db.prepare(`
      INSERT INTO deliveries (
        id, tracking_code, vehicle_id, pickup_lat, pickup_lng,
        dropoff_lat, dropoff_lng, destination_address, status,
        distance_km, eta_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run(
      id,
      data.tracking_code,
      data.vehicle_id ?? null,
      data.pickup_lat,
      data.pickup_lng,
      data.dropoff_lat,
      data.dropoff_lng,
      data.destination_address,
      status,
      data.distance_km,
      data.eta_minutes,
      nowIso,
      nowIso
    );

    return this.getDeliveryById(id)!;
  }

  updateStatus(id: string, status: DeliveryStatus, etaMinutes?: number): void {
    const nowIso = new Date().toISOString();
    if (etaMinutes !== undefined) {
      this.db
        .prepare('UPDATE deliveries SET status = ?, eta_minutes = ?, updated_at = ? WHERE id = ?;')
        .run(status, etaMinutes, nowIso, id);
    } else {
      this.db
        .prepare('UPDATE deliveries SET status = ?, updated_at = ? WHERE id = ?;')
        .run(status, nowIso, id);
    }
  }

  assignVehicle(id: string, vehicleId: string | null): void {
    const nowIso = new Date().toISOString();
    this.db
      .prepare('UPDATE deliveries SET vehicle_id = ?, updated_at = ? WHERE id = ?;')
      .run(vehicleId, nowIso, id);
  }

  updateEta(id: string, etaMinutes: number): void {
    const nowIso = new Date().toISOString();
    this.db
      .prepare('UPDATE deliveries SET eta_minutes = ?, updated_at = ? WHERE id = ?;')
      .run(etaMinutes, nowIso, id);
  }
}
