import { haversineDistanceKm } from './geo.js';
import { PLANNING_SPEED_KMH } from './rules.js';
import type { Delivery, GeoPoint, Vehicle } from './types.js';

export interface PlannedStop {
  delivery_id: string;
  tracking_code: string;
  address: string;
  lat: number;
  lng: number;
  /** 1-based position in the planned order. */
  sequence: number;
  /** Straight-line distance from the previous stop (or the vehicle) in km. */
  leg_km: number;
  /** Straight-line distance summed from the vehicle to this stop in km. */
  cumulative_km: number;
  /** Minutes from now at the planning speed, no traffic or service time. */
  eta_minutes: number;
}

export interface FleetRoute {
  vehicle_id: string;
  plate_number: string;
  stops: PlannedStop[];
  total_km: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Orders stops with a nearest-neighbour heuristic: from the current position
 * always drive to the closest remaining stop. It is fast and predictable but
 * not optimal; ties go to the stop that was listed first.
 */
export function planRoute(
  start: GeoPoint,
  deliveries: Pick<Delivery, 'id' | 'tracking_code' | 'destination_address' | 'dropoff_lat' | 'dropoff_lng'>[],
): PlannedStop[] {
  const remaining = [...deliveries];
  const planned: PlannedStop[] = [];
  let position = start;
  let cumulative = 0;

  while (remaining.length > 0) {
    let best = 0;
    let bestKm = Infinity;
    remaining.forEach((candidate, index) => {
      const km = haversineDistanceKm(position, { lat: candidate.dropoff_lat, lng: candidate.dropoff_lng });
      if (km < bestKm) {
        best = index;
        bestKm = km;
      }
    });
    const [next] = remaining.splice(best, 1);
    cumulative += bestKm;
    planned.push({
      delivery_id: next.id,
      tracking_code: next.tracking_code,
      address: next.destination_address,
      lat: next.dropoff_lat,
      lng: next.dropoff_lng,
      sequence: planned.length + 1,
      leg_km: round2(bestKm),
      cumulative_km: round2(cumulative),
      eta_minutes: Math.round((cumulative / PLANNING_SPEED_KMH) * 60),
    });
    position = { lat: next.dropoff_lat, lng: next.dropoff_lng };
  }
  return planned;
}

/** One route per vehicle that has dispatched or in-transit deliveries. */
export function buildFleetRoutes(vehicles: Vehicle[], deliveries: Delivery[]): FleetRoute[] {
  const routes: FleetRoute[] = [];
  for (const vehicle of vehicles) {
    const active = deliveries.filter(
      (d) => d.vehicle_id === vehicle.id && (d.status === 'dispatched' || d.status === 'in_transit'),
    );
    if (active.length === 0) continue;
    const stops = planRoute({ lat: vehicle.current_lat, lng: vehicle.current_lng }, active);
    routes.push({
      vehicle_id: vehicle.id,
      plate_number: vehicle.plate_number,
      stops,
      total_km: stops[stops.length - 1].cumulative_km,
    });
  }
  return routes;
}
