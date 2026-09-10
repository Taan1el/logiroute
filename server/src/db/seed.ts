import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export function seedDatabase(db: DatabaseSync): void {
  const check = db.prepare('SELECT COUNT(*) as count FROM vehicles;').get() as { count: number };
  if (check.count > 0) return;

  const now = new Date().toISOString();
  const past20m = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const past5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // 1. Seed Geofences (Tallinn Logistics Corridors)
  const insertGeofence = db.prepare(`
    INSERT INTO geofences (id, name, center_lat, center_lng, radius_meters, alert_on_enter, alert_on_exit, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const geoVabaduse = crypto.randomUUID();
  const geoUlemiste = crypto.randomUUID();
  const geoTelliskivi = crypto.randomUUID();
  const geoPort = crypto.randomUUID();

  insertGeofence.run(geoVabaduse, 'Vabaduse Central Hub', 59.4338, 24.7453, 650, 1, 1, '#38bdf8');
  insertGeofence.run(geoUlemiste, 'Ülemiste Smart City Depot', 59.4230, 24.8030, 900, 1, 1, '#10b981');
  insertGeofence.run(geoTelliskivi, 'Telliskivi Creative Hub', 59.4398, 24.7290, 500, 1, 1, '#f59e0b');
  insertGeofence.run(geoPort, 'Tallinn Passenger Port Terminal', 59.4445, 24.7640, 450, 1, 1, '#818cf8');

  // 2. Seed Vehicles
  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (
      id, plate_number, model, status, battery_percent, current_lat, current_lng, speed_kmh, heading_deg, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const v1 = crypto.randomUUID();
  const v2 = crypto.randomUUID();
  const v3 = crypto.randomUUID();
  const v4 = crypto.randomUUID();

  insertVehicle.run(v1, 'TLN-801', 'Bolt Rapid Courier EV', 'en_route', 88, 59.4350, 24.7480, 42, 120, now);
  insertVehicle.run(v2, 'TLN-802', 'Autonomous Pod Rover', 'en_route', 74, 59.4245, 24.8010, 18, 45, now);
  insertVehicle.run(v3, 'TLN-803', 'Nordic Heavy Cargo Van', 'idle', 98, 59.4390, 24.7300, 0, 0, now);
  insertVehicle.run(v4, 'TLN-804', 'Express Delivery Bike', 'maintenance', 12, 59.4430, 24.7620, 0, 0, past20m);

  // 3. Seed Deliveries
  const insertDelivery = db.prepare(`
    INSERT INTO deliveries (
      id, tracking_code, vehicle_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
      destination_address, status, distance_km, eta_minutes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  insertDelivery.run(
    crypto.randomUUID(),
    'TRK-9812',
    v1,
    59.4338,
    24.7453,
    59.4398,
    24.7290,
    'Telliskivi 60a, 10412 Tallinn',
    'in_transit',
    3.2,
    7,
    past20m,
    now
  );

  insertDelivery.run(
    crypto.randomUUID(),
    'TRK-9813',
    v2,
    59.4230,
    24.8030,
    59.4445,
    24.7640,
    'Sadama 25, 10111 Tallinn',
    'dispatched',
    5.8,
    14,
    past5m,
    now
  );

  insertDelivery.run(
    crypto.randomUUID(),
    'TRK-9814',
    null,
    59.4350,
    24.7480,
    59.4280,
    24.7820,
    'Tartu mnt 80, 10112 Tallinn',
    'pending',
    4.1,
    12,
    now,
    now
  );

  // 4. Seed Alert Events
  const insertAlert = db.prepare(`
    INSERT INTO alert_events (id, vehicle_id, type, severity, message, lat, lng, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);

  insertAlert.run(
    crypto.randomUUID(),
    v1,
    'geofence_entered',
    'info',
    'Vehicle TLN-801 entered geofence zone: Vabaduse Central Hub',
    59.4338,
    24.7453,
    past20m
  );

  insertAlert.run(
    crypto.randomUUID(),
    v4,
    'low_battery',
    'critical',
    'Vehicle TLN-804 battery critical: 12% remaining (Maintenance required)',
    59.4430,
    24.7620,
    past5m
  );
}
