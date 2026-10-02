import { describe, expect, it } from 'vitest';
import {
  checkTransition,
  computeMetrics,
  evaluateTelemetry,
  initialEtaMinutes,
  liveEtaMinutes,
  nextDeliveryStatus,
  pluralize,
  checkAssignable,
  checkAssignableVehicle,
  checkVehicleStatusChange,
  progressDeliveries,
  validateDeliveryInput,
  validateGeofenceInput,
  validateTelemetryInput,
} from '../../shared/rules.js';
import { haversineDistanceKm } from '../../shared/geo.js';
import { buildFleetRoutes, planRoute, simulateStep } from '../../shared/route.js';
import type { AlertEvent, Delivery, Geofence, Vehicle } from '../../shared/types.js';

const vehicle: Vehicle = {
  id: 'v1', plate_number: 'TLN-1', model: 'Van', status: 'en_route', battery_percent: 50,
  current_lat: 59.4, current_lng: 24.7, speed_kmh: 20, heading_deg: 90, updated_at: '2026-10-01T10:00:00Z',
};
const hub: Geofence = {
  id: 'g1', name: 'Hub', center_lat: 59.4, center_lng: 24.7, radius_meters: 500,
  alert_on_enter: true, alert_on_exit: true, color: '#000000',
};
const delivery = (over: Partial<Delivery>): Delivery => ({
  id: 'd1', tracking_code: 'LR-1', vehicle_id: 'v1', vehicle_plate: 'TLN-1', pickup_lat: 59.4, pickup_lng: 24.7,
  dropoff_lat: 59.41, dropoff_lng: 24.72, destination_address: 'Somewhere 1', status: 'dispatched',
  distance_km: 1, eta_minutes: 5, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', ...over,
});

describe('delivery status rules', () => {
  it('moves one step at a time and ends at completed', () => {
    expect(nextDeliveryStatus('pending')).toBe('dispatched');
    expect(nextDeliveryStatus('arrived_at_hub')).toBe('completed');
    expect(nextDeliveryStatus('completed')).toBeNull();
  });

  it('rejects skips, repeats and moves without a vehicle', () => {
    expect(checkTransition({ status: 'dispatched', vehicle_id: 'v1' }, 'in_transit')).toBeNull();
    expect(checkTransition({ status: 'dispatched', vehicle_id: 'v1' }, 'completed')).toMatch(/Cannot move/);
    expect(checkTransition({ status: 'completed', vehicle_id: 'v1' }, 'pending')).toMatch(/Cannot move/);
    expect(checkTransition({ status: 'pending', vehicle_id: null }, 'dispatched')).toMatch(/Assign a vehicle/);
  });
});

describe('estimates', () => {
  it('uses the planning speed plus a buffer and never goes below 5 minutes', () => {
    expect(initialEtaMinutes(0)).toBe(5);
    expect(initialEtaMinutes(15)).toBe(35);
  });

  it('floors the speed used for live ETAs and the result at one minute', () => {
    expect(liveEtaMinutes(10, 0)).toBe(24);
    expect(liveEtaMinutes(10, 50)).toBe(12);
    expect(liveEtaMinutes(0, 50)).toBe(1);
  });
});

describe('input validation', () => {
  it('accepts a minimal delivery and rejects bad coordinates', () => {
    expect(validateDeliveryInput({ destination_address: 'A', dropoff_lat: 1, dropoff_lng: 2 })).toBeNull();
    expect(validateDeliveryInput({ destination_address: 'A', dropoff_lat: 91, dropoff_lng: 2 })).toMatch(/dropoff_lat/);
    expect(validateDeliveryInput(null)).toMatch(/object/);
  });

  it('checks telemetry ranges', () => {
    const ok = { vehicle_id: 'v1', lat: 59, lng: 24 };
    expect(validateTelemetryInput(ok)).toBeNull();
    expect(validateTelemetryInput({ ...ok, lat: NaN })).toMatch(/lat/);
    expect(validateTelemetryInput({ ...ok, speed_kmh: -1 })).toMatch(/speed_kmh/);
    expect(validateTelemetryInput({ ...ok, battery_percent: 101 })).toMatch(/battery_percent/);
    expect(validateTelemetryInput({ ...ok, heading_deg: 361 })).toMatch(/heading_deg/);
    expect(validateTelemetryInput({ lat: 1, lng: 1 })).toMatch(/vehicle_id/);
  });

  it('checks geofence input', () => {
    const ok = { name: 'Dock', center_lat: 59, center_lng: 24, radius_meters: 300 };
    expect(validateGeofenceInput(ok)).toBeNull();
    expect(validateGeofenceInput({ ...ok, name: ' ' })).toMatch(/name/);
    expect(validateGeofenceInput({ ...ok, radius_meters: 0 })).toMatch(/radius_meters/);
    expect(validateGeofenceInput({ ...ok, center_lng: 181 })).toMatch(/center_lng/);
  });
});

describe('telemetry rules', () => {
  it('reports exit and entry once each when crossing a boundary', () => {
    const out = evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.45, lng: 24.7 }, [hub]);
    expect(out.alerts.map((a) => a.type)).toEqual(['geofence_exited']);
    const back = evaluateTelemetry({ ...vehicle, current_lat: 59.45 }, { vehicle_id: 'v1', lat: 59.4, lng: 24.7 }, [hub]);
    expect(back.alerts.map((a) => a.type)).toEqual(['geofence_entered']);
  });

  it('stays quiet inside the fence and respects disabled directions', () => {
    expect(evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.401, lng: 24.7 }, [hub]).alerts).toEqual([]);
    const muted = { ...hub, alert_on_exit: false };
    expect(evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.45, lng: 24.7 }, [muted]).alerts).toEqual([]);
  });

  it('flags speed above 50 but not exactly 50', () => {
    expect(evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.4, lng: 24.7, speed_kmh: 50 }, []).alerts).toEqual([]);
    const out = evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.4, lng: 24.7, speed_kmh: 50.4 }, []);
    expect(out.alerts[0]).toMatchObject({ type: 'overspeed_detected', severity: 'warning' });
  });

  it('raises low battery only when crossing below 15 percent', () => {
    const low = (prev: number, next: number) =>
      evaluateTelemetry({ ...vehicle, battery_percent: prev }, { vehicle_id: 'v1', lat: 59.4, lng: 24.7, battery_percent: next }, []).alerts;
    expect(low(15, 14)[0]).toMatchObject({ type: 'low_battery', severity: 'critical' });
    expect(low(14, 10)).toEqual([]);
    expect(low(30, 15)).toEqual([]);
  });

  it('derives heading from movement, or keeps the previous one when parked', () => {
    expect(evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.5, lng: 24.7 }, []).heading_deg).toBe(0);
    expect(evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.4, lng: 24.7 }, []).heading_deg).toBe(90);
    expect(evaluateTelemetry(vehicle, { vehicle_id: 'v1', lat: 59.5, lng: 24.7, heading_deg: 200 }, []).heading_deg).toBe(200);
  });

  it('updates ETAs and flags arrival only for in-transit deliveries', () => {
    const near = { lat: 59.41, lng: 24.72 };
    const list = [
      delivery({ id: 'a', status: 'in_transit' }),
      delivery({ id: 'b', status: 'dispatched' }),
      delivery({ id: 'c', status: 'pending', vehicle_id: null }),
    ];
    expect(progressDeliveries(list, 'v1', near, 30, haversineDistanceKm)).toEqual([
      { id: 'a', eta_minutes: 1, arrived: true },
      { id: 'b', eta_minutes: 1, arrived: false },
    ]);
  });
});

describe('fleet metrics', () => {
  it('counts only the last 24 hours and averages battery', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const alerts = [
      { created_at: '2026-10-02T11:00:00Z' },
      { created_at: '2026-10-01T12:00:00Z' },
      { created_at: '2026-10-01T11:59:59Z' },
    ] as AlertEvent[];
    const deliveries = [
      delivery({ id: 'a', status: 'completed', updated_at: '2026-10-02T09:00:00Z' }),
      delivery({ id: 'b', status: 'completed', updated_at: '2026-09-30T09:00:00Z' }),
      delivery({ id: 'c', status: 'in_transit' }),
    ];
    const vehicles = [vehicle, { ...vehicle, id: 'v2', status: 'idle' as const, battery_percent: 25 }];
    expect(computeMetrics(vehicles, deliveries, alerts, now)).toEqual({
      total_vehicles: 2, active_en_route: 1, active_deliveries: 1, completed_24h: 1, alerts_24h: 2, avg_battery_percent: 37.5,
    });
  });

  it('handles an empty fleet', () => {
    expect(computeMetrics([], [], [], new Date()).avg_battery_percent).toBe(0);
  });
});

describe('route planning heuristic', () => {
  const stop = (id: string, lat: number, lng: number) =>
    delivery({ id, tracking_code: id, dropoff_lat: lat, dropoff_lng: lng });

  it('visits the nearest remaining stop first', () => {
    const plan = planRoute({ lat: 59.4, lng: 24.7 }, [stop('far', 59.5, 24.7), stop('near', 59.41, 24.7), stop('mid', 59.45, 24.7)]);
    expect(plan.map((s) => s.delivery_id)).toEqual(['near', 'mid', 'far']);
    expect(plan.map((s) => s.sequence)).toEqual([1, 2, 3]);
    expect(plan[2].cumulative_km).toBeCloseTo(plan[0].leg_km + plan[1].leg_km + plan[2].leg_km, 1);
  });

  it('is not guaranteed to be optimal: it can pick a worse first leg', () => {
    const lat = (km: number) => 59.4 + km / 111.19;
    const plan = planRoute({ lat: 59.4, lng: 24.7 }, [stop('a', lat(1), 24.7), stop('b', lat(-1.1), 24.7), stop('c', lat(2.2), 24.7)]);
    expect(plan.map((s) => s.delivery_id)).toEqual(['a', 'c', 'b']);
  });

  it('breaks ties by input order and handles no stops', () => {
    const plan = planRoute({ lat: 59.4, lng: 24.7 }, [stop('x', 59.4, 24.7), stop('y', 59.4, 24.7)]);
    expect(plan.map((s) => s.delivery_id)).toEqual(['x', 'y']);
    expect(planRoute({ lat: 0, lng: 0 }, [])).toEqual([]);
  });

  it('builds one route per vehicle with active deliveries', () => {
    const routes = buildFleetRoutes([vehicle, { ...vehicle, id: 'v2', plate_number: 'TLN-2' }], [
      delivery({ id: 'a' }),
      delivery({ id: 'b', status: 'pending', vehicle_id: null }),
      delivery({ id: 'c', status: 'completed' }),
    ]);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ vehicle_id: 'v1', plate_number: 'TLN-1' });
    expect(routes[0].stops).toHaveLength(1);
  });
});

describe('pluralize', () => {
  it('handles zero, one and many', () => {
    expect(pluralize(0, 'stop')).toBe('0 stops');
    expect(pluralize(1, 'stop')).toBe('1 stop');
    expect(pluralize(2, 'vehicle')).toBe('2 vehicles');
    expect(pluralize(2, 'delivery', 'deliveries')).toBe('2 deliveries');
  });
});

describe('simulation step and assignment checks', () => {
  it('moves a fifth of the way to the nearest stop and uses one percent of battery', () => {
    const next = simulateStep({ ...vehicle, current_lat: 59.4, current_lng: 24.7, battery_percent: 50 }, [{ lat: 59.5, lng: 24.9 }]);
    expect(next.lat).toBeCloseTo(59.42, 5);
    expect(next.lng).toBeCloseTo(24.74, 5);
    expect(next).toMatchObject({ speed_kmh: 32, battery_percent: 49 });
  });

  it('keeps a vehicle without stops in place and never drains below 5 percent', () => {
    const next = simulateStep({ ...vehicle, battery_percent: 5 }, []);
    expect(next).toMatchObject({ lat: vehicle.current_lat, lng: vehicle.current_lng, speed_kmh: 0, battery_percent: 5 });
  });

  it('blocks maintenance vehicles, non-pending deliveries and status changes with active work', () => {
    expect(checkAssignableVehicle({ plate_number: 'TLN-1', status: 'maintenance' })).toMatch(/maintenance/);
    expect(checkAssignableVehicle({ plate_number: 'TLN-1', status: 'idle' })).toBeNull();
    expect(checkAssignable({ status: 'pending' })).toBeNull();
    expect(checkAssignable({ status: 'completed' })).toMatch(/completed/);
    expect(checkVehicleStatusChange({ plate_number: 'TLN-1' }, 'idle', true)).toMatch(/must stay en route/);
    expect(checkVehicleStatusChange({ plate_number: 'TLN-1' }, 'idle', false)).toBeNull();
  });
});
