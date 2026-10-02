import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { AlertEvent, AlertType, AlertSeverity } from '../../../shared/types.js';

export class AlertRepository {
  constructor(private db: DatabaseSync) {}

  listAlerts(limit = 50): AlertEvent[] {
    const stmt = this.db.prepare(`
      SELECT a.*, v.plate_number as vehicle_plate
      FROM alert_events a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      ORDER BY a.created_at DESC
      LIMIT ?;
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      vehicle_id: r.vehicle_id,
      vehicle_plate: r.vehicle_plate ?? null,
      type: r.type as AlertType,
      severity: r.severity as AlertSeverity,
      message: r.message,
      lat: Number(r.lat),
      lng: Number(r.lng),
      created_at: r.created_at,
    }));
  }

  createAlert(data: {
    vehicle_id: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    lat: number;
    lng: number;
  }): AlertEvent {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO alert_events (id, vehicle_id, type, severity, message, lat, lng, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    stmt.run(id, data.vehicle_id, data.type, data.severity, data.message, data.lat, data.lng, nowIso);

    const vehicleStmt = this.db.prepare('SELECT plate_number FROM vehicles WHERE id = ?;');
    const v = vehicleStmt.get(data.vehicle_id) as any;

    return {
      id,
      vehicle_id: data.vehicle_id,
      vehicle_plate: v?.plate_number ?? null,
      type: data.type,
      severity: data.severity,
      message: data.message,
      lat: data.lat,
      lng: data.lng,
      created_at: nowIso,
    };
  }

  recordTelemetryPing(data: {
    vehicle_id: string;
    lat: number;
    lng: number;
    speed_kmh: number;
    battery_percent: number;
    heading_deg: number;
  }): void {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO telemetry_pings (id, vehicle_id, lat, lng, speed_kmh, battery_percent, heading_deg, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    stmt.run(id, data.vehicle_id, data.lat, data.lng, data.speed_kmh, data.battery_percent, data.heading_deg, nowIso);
  }

  listSince(sinceIso: string): AlertEvent[] {
    return this.listAlerts(100000).filter((a) => a.created_at >= sinceIso);
  }
}
