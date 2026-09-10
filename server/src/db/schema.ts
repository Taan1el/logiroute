import { DatabaseSync } from 'node:sqlite';

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plate_number TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      battery_percent INTEGER NOT NULL DEFAULT 100,
      current_lat REAL NOT NULL,
      current_lng REAL NOT NULL,
      speed_kmh REAL NOT NULL DEFAULT 0,
      heading_deg REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS geofences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      radius_meters REAL NOT NULL,
      alert_on_enter INTEGER NOT NULL DEFAULT 1,
      alert_on_exit INTEGER NOT NULL DEFAULT 1,
      color TEXT NOT NULL DEFAULT '#38bdf8'
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      tracking_code TEXT UNIQUE NOT NULL,
      vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
      pickup_lat REAL NOT NULL,
      pickup_lng REAL NOT NULL,
      dropoff_lat REAL NOT NULL,
      dropoff_lng REAL NOT NULL,
      destination_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      distance_km REAL NOT NULL,
      eta_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_vehicle ON deliveries(vehicle_id);

    CREATE TABLE IF NOT EXISTS telemetry_pings (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed_kmh REAL NOT NULL,
      battery_percent INTEGER NOT NULL,
      heading_deg REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON telemetry_pings(vehicle_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alert_events(created_at DESC);
  `);
}
