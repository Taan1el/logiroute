import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GeoService } from '../src/services/geo.service.js';

describe('LogiRoute Fleet API & Telemetry Engine', () => {
  let app: any;

  beforeEach(() => {
    // In-memory SQLite for complete test isolation
    const context = createApp(':memory:', true);
    app = context.app;
  });

  describe('Health check', () => {
    it('returns healthy status and ISO timestamp', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GeoService mathematical precision', () => {
    const geo = new GeoService();

    it('calculates Haversine distance correctly between Tallinn coordinates', () => {
      // Vabaduse Square to Ülemiste City (~3.5 km)
      const p1 = { lat: 59.4335, lng: 24.745 };
      const p2 = { lat: 59.4215, lng: 24.802 };
      const dist = geo.haversineDistanceKm(p1, p2);
      expect(dist).toBeGreaterThan(3.0);
      expect(dist).toBeLessThan(4.0);
    });

    it('correctly determines whether point is within circular geofence boundary', () => {
      const gf = {
        id: 'gf-test',
        name: 'Test Hub',
        center_lat: 59.4335,
        center_lng: 24.745,
        radius_meters: 500,
        alert_on_enter: true,
        alert_on_exit: true,
        color: '#38bdf8',
      };

      // Exact center
      expect(geo.isInsideGeofence({ lat: 59.4335, lng: 24.745 }, gf)).toBe(true);

      // Nearby (~100m away)
      expect(geo.isInsideGeofence({ lat: 59.434, lng: 24.746 }, gf)).toBe(true);

      // Far away (~3km away)
      expect(geo.isInsideGeofence({ lat: 59.42, lng: 24.8 }, gf)).toBe(false);
    });

    it('calculates heading azimuth degrees in 0..360 range', () => {
      const p1 = { lat: 59.4, lng: 24.7 };
      const p2 = { lat: 59.5, lng: 24.7 }; // Northward
      const heading = geo.calculateHeading(p1, p2);
      expect(heading).toBeGreaterThanOrEqual(0);
      expect(heading).toBeLessThanOrEqual(5); // Roughly 0 degrees North
    });
  });

  describe('Vehicles and fleet management', () => {
    it('lists seeded vehicles with telemetry state', async () => {
      const res = await request(app).get('/api/vehicles');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.data[0]).toHaveProperty('plate_number');
      expect(res.body.data[0]).toHaveProperty('battery_percent');
    });

    it('retrieves single vehicle by id', async () => {
      const listRes = await request(app).get('/api/vehicles');
      const firstVeh = listRes.body.data[0];

      const res = await request(app).get(`/api/vehicles/${firstVeh.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.plate_number).toBe(firstVeh.plate_number);
    });

    it('returns 404 for non-existent vehicle', async () => {
      const res = await request(app).get('/api/vehicles/veh-unknown');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('updates vehicle operational status', async () => {
      const listRes = await request(app).get('/api/vehicles');
      const firstVeh = listRes.body.data.find((v: any) => v.plate_number === 'TLN-803');

      const patchRes = await request(app)
        .patch(`/api/vehicles/${firstVeh.id}/status`)
        .send({ status: 'maintenance' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('maintenance');

      // Verify persistence
      const getRes = await request(app).get(`/api/vehicles/${firstVeh.id}`);
      expect(getRes.body.data.status).toBe('maintenance');
    });
  });

  describe('Geofence management', () => {
    it('lists configured geofences', async () => {
      const res = await request(app).get('/api/geofences');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      const names = res.body.data.map((g: any) => g.name);
      expect(names).toContain('Vabaduse Central Hub');
    });

    it('creates a custom geofence perimeter', async () => {
      const newGeofence = {
        name: 'Mustamäe Tech Park',
        center_lat: 59.395,
        center_lng: 24.671,
        radius_meters: 650,
        color: '#10b981',
      };

      const res = await request(app).post('/api/geofences').send(newGeofence);
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Mustamäe Tech Park');
      expect(res.body.data.radius_meters).toBe(650);

      // Verify in list
      const listRes = await request(app).get('/api/geofences');
      expect(listRes.body.data.some((g: any) => g.name === 'Mustamäe Tech Park')).toBe(true);
    });
  });

  describe('Telemetry ingestion & event rule triggers', () => {
    it('triggers geofence_exited and geofence_entered alerts across boundaries', async () => {
      const listRes = await request(app).get('/api/vehicles');
      const v1 = listRes.body.data.find((v: any) => v.plate_number === 'TLN-801');

      // First ping: Move outside Vabaduse geofence to open highway
      const moveOutRes = await request(app).post('/api/telemetry/ingest').send({
        vehicle_id: v1.id,
        lat: 59.41,
        lng: 24.78,
        speed_kmh: 42,
      });

      expect(moveOutRes.status).toBe(200);
      const exitedAlert = moveOutRes.body.data.triggeredAlerts.find(
        (a: any) => a.type === 'geofence_exited'
      );
      expect(exitedAlert).toBeDefined();
      expect(exitedAlert.message).toContain('exited geofence');

      // Second ping: Move directly into Ülemiste City hub (59.4230, 24.8030)
      const moveInRes = await request(app).post('/api/telemetry/ingest').send({
        vehicle_id: v1.id,
        lat: 59.423,
        lng: 24.803,
        speed_kmh: 30,
      });

      expect(moveInRes.status).toBe(200);
      const enteredAlert = moveInRes.body.data.triggeredAlerts.find(
        (a: any) => a.type === 'geofence_entered'
      );
      expect(enteredAlert).toBeDefined();
      expect(enteredAlert.message).toContain('Ülemiste');
    });

    it('triggers overspeed_detected alert when urban limit (50 km/h) is breached', async () => {
      const listRes = await request(app).get('/api/vehicles');
      const v2 = listRes.body.data.find((v: any) => v.plate_number === 'TLN-802');

      const res = await request(app).post('/api/telemetry/ingest').send({
        vehicle_id: v2.id,
        lat: 59.43,
        lng: 24.75,
        speed_kmh: 68.5,
      });

      expect(res.status).toBe(200);
      const overspeedAlert = res.body.data.triggeredAlerts.find(
        (a: any) => a.type === 'overspeed_detected'
      );
      expect(overspeedAlert).toBeDefined();
      expect(overspeedAlert.severity).toBe('warning');
      expect(overspeedAlert.message).toContain('69 km/h');
    });

    it('triggers low_battery alert when battery drops below 15%', async () => {
      const listRes = await request(app).get('/api/vehicles');
      const v3 = listRes.body.data.find((v: any) => v.plate_number === 'TLN-803'); // starts at 98%

      const res = await request(app).post('/api/telemetry/ingest').send({
        vehicle_id: v3.id,
        lat: 59.44,
        lng: 24.72,
        battery_percent: 11,
      });

      expect(res.status).toBe(200);
      const lowBatAlert = res.body.data.triggeredAlerts.find(
        (a: any) => a.type === 'low_battery'
      );
      expect(lowBatAlert).toBeDefined();
      expect(lowBatAlert.severity).toBe('critical');
    });
  });

  describe('Delivery lifecycle & dispatching', () => {
    it('creates delivery with computed Haversine distance and initial ETA', async () => {
      const newDelivery = {
        destination_address: 'Viru Väljak 4, 10111 Tallinn',
        pickup_lat: 59.4335,
        pickup_lng: 24.745,
        dropoff_lat: 59.4365,
        dropoff_lng: 24.755,
      };

      const res = await request(app).post('/api/deliveries').send(newDelivery);
      expect(res.status).toBe(201);
      expect(res.body.data.tracking_code).toMatch(/^LR-TLN-\d+/);
      expect(res.body.data.distance_km).toBeGreaterThan(0);
      expect(res.body.data.eta_minutes).toBeGreaterThan(0);
      expect(res.body.data.status).toBe('pending');
    });

    it('assigns vehicle and transitions status to dispatched and updates vehicle to en_route', async () => {
      const newDelivery = {
        destination_address: 'Tartu mnt 80, Tallinn',
        dropoff_lat: 59.425,
        dropoff_lng: 24.775,
      };

      const createRes = await request(app).post('/api/deliveries').send(newDelivery);
      const deliveryId = createRes.body.data.id;

      const vehList = await request(app).get('/api/vehicles');
      const idleVeh = vehList.body.data.find((v: any) => v.plate_number === 'TLN-803');

      const assignRes = await request(app)
        .post(`/api/deliveries/${deliveryId}/assign`)
        .send({ vehicle_id: idleVeh.id });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.status).toBe('dispatched');
      expect(assignRes.body.data.vehicle_id).toBe(idleVeh.id);

      // Vehicle should now be en_route
      const vehRes = await request(app).get(`/api/vehicles/${idleVeh.id}`);
      expect(vehRes.body.data.status).toBe('en_route');
    });

    it('reverts vehicle to idle when delivery is completed', async () => {
      const delList = await request(app).get('/api/deliveries');
      const inTransitDel = delList.body.data.find((d: any) => d.status === 'in_transit');

      const arrivedRes = await request(app)
        .patch(`/api/deliveries/${inTransitDel.id}/status`)
        .send({ status: 'arrived_at_hub' });
      expect(arrivedRes.status).toBe(200);

      const updateRes = await request(app)
        .patch(`/api/deliveries/${inTransitDel.id}/status`)
        .send({ status: 'completed' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('completed');

      // Check vehicle status
      if (inTransitDel.vehicle_id) {
        const vehRes = await request(app).get(`/api/vehicles/${inTransitDel.vehicle_id}`);
        expect(vehRes.body.data.status).toBe('idle');
      }
    });
  });

  describe('Fleet Metrics & Alert Log', () => {
    it('returns aggregated metrics for fleet operational health', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total_vehicles');
      expect(res.body.data).toHaveProperty('active_en_route');
      expect(res.body.data).toHaveProperty('active_deliveries');
      expect(res.body.data).toHaveProperty('avg_battery_percent');
      expect(res.body.data).toHaveProperty('alerts_24h');
      expect(res.body.data).toHaveProperty('completed_24h');
      expect(res.body.data.total_vehicles).toBeGreaterThanOrEqual(4);
    });

    it('returns paginated alerts list', async () => {
      const res = await request(app).get('/api/alerts?limit=10');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
