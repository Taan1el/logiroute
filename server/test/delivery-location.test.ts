import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, type AppContext } from '../src/app.js';
import { DeliveryService } from '../src/services/delivery.service.js';
import { DeliveryRepository } from '../src/repositories/delivery.repository.js';
import { VehicleRepository } from '../src/repositories/vehicle.repository.js';
import { GeoService } from '../src/services/geo.service.js';

const valid = { destination_address: 'Delivery point', dropoff_lat: 59.4, dropoff_lng: 24.7 };

describe('Delivery location validation', () => {
  let context: AppContext;
  beforeEach(() => { context = createApp(':memory:', true); });
  afterEach(() => { context.db.close(); });

  const invalid: [string, unknown][] = [
    ['array body', []],
    ['missing address', { ...valid, destination_address: undefined }],
    ...['', '   ', 12, true, {}, [], null].map(value =>
      [`address ${JSON.stringify(value)}`, { ...valid, destination_address: value }] as [string, unknown]),
  ];
  for (const field of ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng']) {
    const limit = field.endsWith('lat') ? 90 : 180;
    for (const value of [null, '', '59', true, [], {}, limit + 0.01, -limit - 0.01]) {
      invalid.push([`${field} ${JSON.stringify(value)}`, { ...valid, [field]: value }]);
    }
    if (field.startsWith('dropoff')) invalid.push([`missing ${field}`, { ...valid, [field]: undefined }]);
  }

  it.each(invalid)('rejects %s without changing stored state', async (_name, body) => {
    const deliveries = context.db.prepare('SELECT * FROM deliveries ORDER BY id').all();
    const vehicles = context.db.prepare('SELECT * FROM vehicles ORDER BY id').all();
    const response = await request(context.app).post('/api/deliveries').send(body as object);
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(context.db.prepare('SELECT * FROM deliveries ORDER BY id').all()).toEqual(deliveries);
    expect(context.db.prepare('SELECT * FROM vehicles ORDER BY id').all()).toEqual(vehicles);
  });

  it.each([[0, 0], [90, 180], [-90, -180], [59.4, 24.7]])(
    'persists valid coordinates %s, %s and finite route estimates', async (lat, lng) => {
      const response = await request(context.app).post('/api/deliveries').send({
        ...valid, pickup_lat: lat, pickup_lng: lng, dropoff_lat: lat, dropoff_lng: lng,
      });
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        pickup_lat: lat, pickup_lng: lng, dropoff_lat: lat, dropoff_lng: lng,
        distance_km: 0, eta_minutes: 5, status: 'pending',
      });
      const stored = context.db.prepare('SELECT * FROM deliveries WHERE id = ?').get(response.body.data.id);
      expect(stored).toMatchObject({ pickup_lat: lat, pickup_lng: lng, dropoff_lat: lat, dropoff_lng: lng });
    },
  );

  it('defaults omitted pickup coordinates independently and trims the address', async () => {
    const response = await request(context.app).post('/api/deliveries').send({
      ...valid, pickup_lat: 0, destination_address: '  Delivery point  ',
    });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ pickup_lat: 0, pickup_lng: 24.745, destination_address: 'Delivery point' });
    const defaultResponse = await request(context.app).post('/api/deliveries').send(valid);
    expect(defaultResponse.status).toBe(201);
    expect(defaultResponse.body.data).toMatchObject({ pickup_lat: 59.4335, pickup_lng: 24.745 });
  });

  it.each(['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng'])(
    'rejects non-finite %s from internal callers', (field) => {
      const service = new DeliveryService(new DeliveryRepository(context.db), new VehicleRepository(context.db), new GeoService());
      for (const value of [NaN, Infinity, -Infinity]) {
        expect(() => service.createDelivery({ ...valid, [field]: value })).toThrow(/finite number/);
      }
    },
  );
});
