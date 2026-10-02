import { describe, expect, it } from 'vitest';
import { createDemoBackend } from '../demo/demoBackend';
import { buildSampleData } from '../demo/sample';

const NOW = new Date('2026-10-02T12:00:00Z');
const make = () => createDemoBackend(() => NOW);

describe('demo backend', () => {
  it('starts from the same sample data every time', async () => {
    const a = await make().getDeliveries();
    const b = await make().getDeliveries();
    expect(a).toEqual(b);
    expect(a.map((d) => d.tracking_code)).toContain('LR-TLN-481201');
    expect(buildSampleData(NOW).vehicles).toHaveLength(4);
  });

  it('creates pending and dispatched deliveries with sequential tracking codes', async () => {
    const api = make();
    const pending = await api.createDelivery({ destination_address: ' Pirita tee 1 ', dropoff_lat: 59.46, dropoff_lng: 24.82 });
    expect(pending).toMatchObject({ tracking_code: 'LR-TLN-481210', status: 'pending', vehicle_id: null, destination_address: 'Pirita tee 1' });
    const dispatched = await api.createDelivery({ destination_address: 'Endla 1', dropoff_lat: 59.43, dropoff_lng: 24.73, vehicle_id: 'veh-803' });
    expect(dispatched).toMatchObject({ tracking_code: 'LR-TLN-481211', status: 'dispatched', vehicle_plate: 'TLN-803' });
    expect((await api.getVehicles()).find((v) => v.id === 'veh-803')?.status).toBe('en_route');
  });

  it('rejects invalid input, unknown vehicles and vehicles in maintenance', async () => {
    const api = make();
    await expect(api.createDelivery({ destination_address: '  ', dropoff_lat: 1, dropoff_lng: 1 })).rejects.toThrow(/non-empty/);
    await expect(api.createDelivery({ destination_address: 'x', dropoff_lat: 95, dropoff_lng: 1 })).rejects.toThrow(/dropoff_lat/);
    await expect(api.createDelivery({ destination_address: 'x', dropoff_lat: 1, dropoff_lng: 1, vehicle_id: 'nope' })).rejects.toThrow(/Vehicle not found/);
    await expect(api.createDelivery({ destination_address: 'x', dropoff_lat: 1, dropoff_lng: 1, vehicle_id: 'veh-804' })).rejects.toThrow(/maintenance/);
  });

  it('moves statuses one step at a time and frees the vehicle after the last delivery', async () => {
    const api = make();
    const created = await api.createDelivery({ destination_address: 'Endla 1', dropoff_lat: 59.43, dropoff_lng: 24.73, vehicle_id: 'veh-803' });
    await expect(api.updateDeliveryStatus(created.id, 'completed')).rejects.toThrow(/Cannot move a delivery from dispatched to completed/);
    await api.updateDeliveryStatus(created.id, 'in_transit');
    await api.updateDeliveryStatus(created.id, 'arrived_at_hub');
    expect((await api.getVehicles()).find((v) => v.id === 'veh-803')?.status).toBe('en_route');
    const done = await api.updateDeliveryStatus(created.id, 'completed');
    expect(done).toMatchObject({ status: 'completed', eta_minutes: 0 });
    expect((await api.getVehicles()).find((v) => v.id === 'veh-803')?.status).toBe('idle');
    await expect(api.updateDeliveryStatus('missing', 'dispatched')).rejects.toThrow(/Delivery not found/);
    await expect(api.updateDeliveryStatus(created.id, 'bogus' as never)).rejects.toThrow(/Unknown delivery status/);
  });

  it('assigns only pending deliveries to vehicles that can work', async () => {
    const api = make();
    const assigned = await api.assignVehicle('del-481206', 'veh-803');
    expect(assigned).toMatchObject({ status: 'dispatched', vehicle_plate: 'TLN-803' });
    await expect(api.assignVehicle('del-481206', 'veh-803')).rejects.toThrow(/Only pending deliveries/);
    await expect(api.assignVehicle('del-481207', 'veh-804')).rejects.toThrow(/maintenance/);
  });

  it('keeps vehicles with active deliveries en route', async () => {
    const api = make();
    await expect(api.updateVehicleStatus('veh-801', 'idle')).rejects.toThrow(/must stay en route/);
    expect((await api.updateVehicleStatus('veh-803', 'maintenance')).status).toBe('maintenance');
    await expect(api.updateVehicleStatus('nope', 'idle')).rejects.toThrow(/Vehicle not found/);
  });

  it('applies the alert rules to pings', async () => {
    const api = make();
    const fast = await api.ingestTelemetry({ vehicle_id: 'veh-803', lat: 59.439, lng: 24.73, speed_kmh: 74 });
    expect(fast.triggeredAlerts.map((a) => a.type)).toEqual(['overspeed_detected']);
    const low = await api.ingestTelemetry({ vehicle_id: 'veh-803', lat: 59.439, lng: 24.73, speed_kmh: 10, battery_percent: 8 });
    expect(low.triggeredAlerts.map((a) => a.type)).toEqual(['low_battery']);
    const again = await api.ingestTelemetry({ vehicle_id: 'veh-803', lat: 59.439, lng: 24.73, battery_percent: 7 });
    expect(again.triggeredAlerts).toEqual([]);
    const zone = await api.ingestTelemetry({ vehicle_id: 'veh-803', lat: 59.5, lng: 24.9, speed_kmh: 10 });
    expect(zone.triggeredAlerts.map((a) => a.type)).toEqual(['geofence_exited']);
    const alerts = await api.getAlerts(3);
    expect(alerts).toHaveLength(3);
    expect(alerts[0].type).toBe('geofence_exited');
    await expect(api.ingestTelemetry({ vehicle_id: 'nope', lat: 0, lng: 0 })).rejects.toThrow(/Vehicle not found/);
    await expect(api.ingestTelemetry({ vehicle_id: 'veh-803', lat: 200, lng: 0 })).rejects.toThrow(/lat/);
  });

  it('marks an in-transit delivery as arrived when the vehicle reaches the drop-off', async () => {
    const api = make();
    await api.ingestTelemetry({ vehicle_id: 'veh-801', lat: 59.4398, lng: 24.729, speed_kmh: 5 });
    const deliveries = await api.getDeliveries();
    expect(deliveries.find((d) => d.id === 'del-481201')).toMatchObject({ status: 'arrived_at_hub', eta_minutes: 0 });
    expect(deliveries.find((d) => d.id === 'del-481202')?.status).toBe('dispatched');
  });

  it('reports metrics from the shared rules and can be reset', async () => {
    const api = make();
    expect(await api.getMetrics()).toMatchObject({ total_vehicles: 4, active_en_route: 2, active_deliveries: 5, completed_24h: 1, alerts_24h: 2, avg_battery_percent: 68 });
    await api.createDelivery({ destination_address: 'Endla 1', dropoff_lat: 59.43, dropoff_lng: 24.73 });
    await api.ingestTelemetry({ vehicle_id: 'veh-803', lat: 59.439, lng: 24.73, speed_kmh: 90 });
    api.reset();
    expect((await api.getDeliveries()).some((d) => d.tracking_code === 'LR-TLN-481210')).toBe(false);
    expect(await api.getAlerts()).toHaveLength(2);
    const next = await api.createDelivery({ destination_address: 'Endla 1', dropoff_lat: 59.43, dropoff_lng: 24.73 });
    expect(next.tracking_code).toBe('LR-TLN-481210');
  });

  it('filters deliveries by status and rejects unknown statuses', async () => {
    const api = make();
    expect(await api.getDeliveries('pending')).toHaveLength(2);
    await expect(api.getDeliveries('bogus' as never)).rejects.toThrow(/Unknown delivery status/);
    expect(await api.getGeofences()).toHaveLength(4);
  });
});
