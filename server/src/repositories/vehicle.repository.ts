import { DatabaseSync } from 'node:sqlite';
import { Vehicle, VehicleStatus } from '../../../shared/types.js';

export class VehicleRepository {
  constructor(private db: DatabaseSync) {}

  listVehicles(): Vehicle[] {
    const stmt = this.db.prepare('SELECT * FROM vehicles ORDER BY plate_number ASC;');
    const rows = stmt.all() as any[];

    return rows.map((r) => ({
      id: r.id,
      plate_number: r.plate_number,
      model: r.model,
      status: r.status as VehicleStatus,
      battery_percent: Number(r.battery_percent),
      current_lat: Number(r.current_lat),
      current_lng: Number(r.current_lng),
      speed_kmh: Number(r.speed_kmh),
      heading_deg: Number(r.heading_deg),
      updated_at: r.updated_at,
    }));
  }

  getVehicleById(id: string): Vehicle | null {
    const stmt = this.db.prepare('SELECT * FROM vehicles WHERE id = ?;');
    const r = stmt.get(id) as any;
    if (!r) return null;

    return {
      id: r.id,
      plate_number: r.plate_number,
      model: r.model,
      status: r.status as VehicleStatus,
      battery_percent: Number(r.battery_percent),
      current_lat: Number(r.current_lat),
      current_lng: Number(r.current_lng),
      speed_kmh: Number(r.speed_kmh),
      heading_deg: Number(r.heading_deg),
      updated_at: r.updated_at,
    };
  }

  updatePosition(
    id: string,
    lat: number,
    lng: number,
    speedKmh: number,
    headingDeg: number,
    batteryPercent?: number
  ): void {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE vehicles
      SET current_lat = ?, current_lng = ?, speed_kmh = ?, heading_deg = ?,
          battery_percent = COALESCE(?, battery_percent), updated_at = ?
      WHERE id = ?;
    `);
    stmt.run(lat, lng, speedKmh, headingDeg, batteryPercent ?? null, nowIso, id);
  }

  updateStatus(id: string, status: VehicleStatus): void {
    const nowIso = new Date().toISOString();
    this.db.prepare('UPDATE vehicles SET status = ?, updated_at = ? WHERE id = ?;').run(status, nowIso, id);
  }
}
