import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { Geofence } from '../../../shared/types.js';

export class GeofenceRepository {
  constructor(private db: DatabaseSync) {}

  listGeofences(): Geofence[] {
    const stmt = this.db.prepare('SELECT * FROM geofences ORDER BY name ASC;');
    const rows = stmt.all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      center_lat: Number(r.center_lat),
      center_lng: Number(r.center_lng),
      radius_meters: Number(r.radius_meters),
      alert_on_enter: Boolean(r.alert_on_enter),
      alert_on_exit: Boolean(r.alert_on_exit),
      color: r.color,
    }));
  }

  getGeofenceById(id: string): Geofence | null {
    const stmt = this.db.prepare('SELECT * FROM geofences WHERE id = ?;');
    const r = stmt.get(id) as any;
    if (!r) return null;

    return {
      id: r.id,
      name: r.name,
      center_lat: Number(r.center_lat),
      center_lng: Number(r.center_lng),
      radius_meters: Number(r.radius_meters),
      alert_on_enter: Boolean(r.alert_on_enter),
      alert_on_exit: Boolean(r.alert_on_exit),
      color: r.color,
    };
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
    const id = crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO geofences (id, name, center_lat, center_lng, radius_meters, alert_on_enter, alert_on_exit, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    stmt.run(
      id,
      dto.name,
      dto.center_lat,
      dto.center_lng,
      dto.radius_meters,
      dto.alert_on_enter !== false ? 1 : 0,
      dto.alert_on_exit !== false ? 1 : 0,
      dto.color || '#38bdf8'
    );

    return this.getGeofenceById(id)!;
  }
}
