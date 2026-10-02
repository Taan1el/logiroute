import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, type AppContext } from '../src/app.js';

describe('API rules and error handling', () => {
  let context: AppContext;
  const api = () => request(context.app);
  const vehicleByPlate = async (plate: string) =>
    (await api().get('/api/vehicles')).body.data.find((v: any) => v.plate_number === plate);

  beforeEach(() => { context = createApp(':memory:', true); });
  afterEach(() => { context.db.close(); });

  it('rejects skipped and unknown delivery statuses', async () => {
    const pending = (await api().get('/api/deliveries?status=pending')).body.data[0];
    const skip = await api().patch(`/api/deliveries/${pending.id}/status`).send({ status: 'completed' });
    expect(skip.status).toBe(400);
    expect(skip.body.error).toMatch(/Cannot move/);
    const unknown = await api().patch(`/api/deliveries/${pending.id}/status`).send({ status: 'flying' });
    expect(unknown.status).toBe(400);
    expect((await api().get('/api/deliveries?status=flying')).status).toBe(400);
  });

  it('returns 404 for unknown deliveries and routes', async () => {
    expect((await api().get('/api/deliveries/nope')).status).toBe(404);
    expect((await api().patch('/api/deliveries/nope/status').send({ status: 'dispatched' })).status).toBe(404);
    expect((await api().post('/api/deliveries/nope/assign').send({ vehicle_id: 'x' })).status).toBe(404);
    expect((await api().get('/api/unknown')).status).toBe(404);
  });

  it('refuses vehicles in maintenance and unknown vehicles', async () => {
    const pending = (await api().get('/api/deliveries?status=pending')).body.data[0];
    const broken = await vehicleByPlate('TLN-804');
    const refused = await api().post(`/api/deliveries/${pending.id}/assign`).send({ vehicle_id: broken.id });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/maintenance/);
    const missing = await api().post(`/api/deliveries/${pending.id}/assign`).send({ vehicle_id: 'nope' });
    expect(missing.status).toBe(400);
    const create = await api()
      .post('/api/deliveries')
      .send({ destination_address: 'A', dropoff_lat: 59.4, dropoff_lng: 24.7, vehicle_id: 'nope' });
    expect(create.status).toBe(400);
  });

  it('only assigns pending deliveries', async () => {
    const dispatched = (await api().get('/api/deliveries?status=dispatched')).body.data[0];
    const idle = await vehicleByPlate('TLN-803');
    const res = await api().post(`/api/deliveries/${dispatched.id}/assign`).send({ vehicle_id: idle.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pending/);
  });

  it('keeps a vehicle en route until its last delivery is completed', async () => {
    const idle = await vehicleByPlate('TLN-803');
    const create = (address: string, lat: number, lng: number) =>
      api().post('/api/deliveries').send({ destination_address: address, dropoff_lat: lat, dropoff_lng: lng, vehicle_id: idle.id });
    const first = await create('A', 59.43, 24.76);
    const second = await create('B', 59.42, 24.78);
    expect(first.body.data.status).toBe('dispatched');
    for (const step of ['in_transit', 'arrived_at_hub', 'completed']) {
      expect((await api().patch(`/api/deliveries/${first.body.data.id}/status`).send({ status: step })).status).toBe(200);
    }
    expect((await vehicleByPlate('TLN-803')).status).toBe('en_route');
    for (const step of ['in_transit', 'arrived_at_hub', 'completed']) {
      await api().patch(`/api/deliveries/${second.body.data.id}/status`).send({ status: step });
    }
    expect((await vehicleByPlate('TLN-803')).status).toBe('idle');
  });

  it('blocks maintenance for a vehicle with active deliveries', async () => {
    const busy = await vehicleByPlate('TLN-801');
    const res = await api().patch(`/api/vehicles/${busy.id}/status`).send({ status: 'maintenance' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/active deliveries/);
    expect((await api().patch('/api/vehicles/nope/status').send({ status: 'idle' })).status).toBe(404);
    expect((await api().patch(`/api/vehicles/${busy.id}/status`).send({ status: 'sleeping' })).status).toBe(400);
  });

  it('validates telemetry and geofence payloads', async () => {
    const v = await vehicleByPlate('TLN-803');
    const bad = [
      { vehicle_id: v.id, lat: 'x', lng: 24 },
      { vehicle_id: v.id, lat: 59, lng: 24, speed_kmh: -5 },
      { vehicle_id: v.id, lat: 59, lng: 24, battery_percent: 120 },
      { lat: 59, lng: 24 },
    ];
    for (const body of bad) expect((await api().post('/api/telemetry/ingest').send(body)).status).toBe(400);
    expect((await api().post('/api/telemetry/ingest').send({ vehicle_id: 'nope', lat: 59, lng: 24 })).status).toBe(404);
    const fence = { name: 'x', center_lat: 59, center_lng: 24, radius_meters: -3 };
    expect((await api().post('/api/geofences').send(fence)).status).toBe(400);
    expect((await api().post('/api/geofences').send({ ...fence, name: '', radius_meters: 30 })).status).toBe(400);
  });

  it('moves an in-transit delivery to arrived_at_hub with zero ETA within 80 m', async () => {
    const del = (await api().get('/api/deliveries?status=in_transit')).body.data[0];
    const res = await api()
      .post('/api/telemetry/ingest')
      .send({ vehicle_id: del.vehicle_id, lat: del.dropoff_lat, lng: del.dropoff_lng, speed_kmh: 10 });
    expect(res.status).toBe(200);
    const after = (await api().get(`/api/deliveries/${del.id}`)).body.data;
    expect(after).toMatchObject({ status: 'arrived_at_hub', eta_minutes: 0 });
  });

  it('updates the ETA of a dispatched delivery without changing its status', async () => {
    const del = (await api().get('/api/deliveries?status=dispatched')).body.data[0];
    await api()
      .post('/api/telemetry/ingest')
      .send({ vehicle_id: del.vehicle_id, lat: del.dropoff_lat, lng: del.dropoff_lng, speed_kmh: 10 });
    const after = (await api().get(`/api/deliveries/${del.id}`)).body.data;
    expect(after.status).toBe('dispatched');
    expect(after.eta_minutes).toBe(1);
  });

  it('answers malformed JSON with 400 and clamps the alert limit', async () => {
    const res = await api().post('/api/deliveries').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect((await api().get('/api/alerts?limit=1')).body.data).toHaveLength(1);
    expect((await api().get('/api/alerts?limit=abc')).status).toBe(200);
  });

  it('reports seeded counts in the metrics', async () => {
    const metrics = (await api().get('/api/metrics')).body.data;
    expect(metrics).toMatchObject({ total_vehicles: 4, active_en_route: 2, active_deliveries: 2, completed_24h: 0, alerts_24h: 2 });
  });
});
