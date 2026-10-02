import React from 'react';
import type { Delivery, Geofence, Vehicle } from '../../../shared/types';
import type { FleetRoute } from '../../../shared/route';
import { pluralize, shortAddress } from '../utils/format';

interface RouteMapProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  deliveries: Delivery[];
  routes: FleetRoute[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

// Flat projection of the Tallinn centre. Longitude is not scaled by latitude
// in the picture: the viewBox ratio matches the real ground ratio instead.
const MIN_LAT = 59.4;
const MAX_LAT = 59.455;
const MIN_LNG = 24.69;
const MAX_LNG = 24.83;
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 770;

const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = KM_PER_DEG_LAT * Math.cos((((MIN_LAT + MAX_LAT) / 2) * Math.PI) / 180);
const PX_PER_KM = MAP_WIDTH / ((MAX_LNG - MIN_LNG) * KM_PER_DEG_LNG);

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function project(lat: number, lng: number): { x: number; y: number } {
  const clampedLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat));
  const clampedLng = Math.max(MIN_LNG, Math.min(MAX_LNG, lng));
  return {
    x: round1(((clampedLng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * MAP_WIDTH),
    y: round1(((MAX_LAT - clampedLat) / (MAX_LAT - MIN_LAT)) * MAP_HEIGHT),
  };
}

const COASTLINE: [number, number][] = [
  [59.4515, 24.69],
  [59.4545, 24.7],
  [59.4475, 24.725],
  [59.4455, 24.745],
  [59.447, 24.78],
  [59.4575, 24.805],
  [59.4665, 24.83],
];

// Ground and water reach far past the viewBox so a pane of any shape is filled.
const FAR = 4000;

const waterPath = (): string => {
  const points = COASTLINE.map(([lat, lng]) => project(lat, lng));
  const first = points[0];
  const last = points[points.length - 1];
  return `M ${-FAR} ${-FAR} L ${-FAR} ${first.y} ${points.map((p) => `L ${p.x} ${p.y}`).join(' ')} L ${FAR} ${last.y} L ${FAR} ${-FAR} Z`;
};

/** Main streets as rough centre lines; the picture is schematic, not a survey. */
const STREETS: { name: string; points: [number, number][]; label: [number, number] }[] = [
  { name: 'Pärnu mnt', points: [[59.4335, 24.7465], [59.4215, 24.7285], [59.4045, 24.7035]], label: [59.4135, 24.7165] },
  { name: 'Tartu mnt', points: [[59.4335, 24.7545], [59.4235, 24.7765], [59.4045, 24.8135]], label: [59.4125, 24.762] },
  { name: 'Narva mnt', points: [[59.4375, 24.7575], [59.4398, 24.782], [59.4455, 24.8105]], label: [59.4405, 24.7885] },
];

/** Plain-language summary of every route, used as the map's text alternative. */
export function describeRoutes(routes: FleetRoute[]): string {
  if (routes.length === 0) return 'No vehicle has an active delivery, so no route is drawn.';
  return routes
    .map((route) => {
      const order = route.stops.map((s) => `${s.sequence} ${shortAddress(s.address)}`).join(', ');
      return `${route.plate_number}: ${pluralize(route.stops.length, 'stop')}, ${route.total_km.toFixed(1)} km straight line. ${order}.`;
    })
    .join(' ');
}

export const RouteMap: React.FC<RouteMapProps> = ({
  vehicles,
  geofences,
  deliveries,
  routes,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const pending = deliveries.filter((d) => d.status === 'pending');
  const water = project(59.404, 24.79);
  const scale = PX_PER_KM;
  const vehicleStroke = (status: Vehicle['status']): string =>
    status === 'en_route' ? 'var(--ok)' : status === 'maintenance' ? 'var(--bad)' : 'var(--ink-3)';

  return (
    <svg
      className="route-map"
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby="route-map-title"
      aria-describedby="route-map-desc"
    >
      <title id="route-map-title">Route map of central Tallinn</title>
      <desc id="route-map-desc">{describeRoutes(routes)}</desc>

      <rect x={-FAR} y={-FAR} width={2 * FAR + MAP_WIDTH} height={2 * FAR + MAP_HEIGHT} fill="var(--ground)" />
      <path d={waterPath()} fill="var(--paper)" />
      <ellipse cx={water.x} cy={water.y} rx={(0.02 / (MAX_LNG - MIN_LNG)) * MAP_WIDTH} ry={(0.008 / (MAX_LAT - MIN_LAT)) * MAP_HEIGHT} fill="var(--paper)" />
      {STREETS.map((street) => (
        <g key={street.name}>
          <polyline points={street.points.map(([lat, lng]) => `${project(lat, lng).x},${project(lat, lng).y}`).join(' ')} className="map-street" />
          <text x={project(...street.label).x} y={project(...street.label).y} className="map-note">
            {street.name}
          </text>
        </g>
      ))}
      <text x={project(59.4525, 24.715).x} y={project(59.4525, 24.715).y} className="map-note">
        Tallinn Bay
      </text>
      <text x={water.x} y={water.y + 4} textAnchor="middle" className="map-note">
        Lake Ülemiste
      </text>

      {geofences.map((gf) => {
        const c = project(gf.center_lat, gf.center_lng);
        const r = (gf.radius_meters / 1000) * scale;
        return (
          <g key={gf.id}>
            <circle cx={c.x} cy={c.y} r={r} className="map-zone" />
            <text x={c.x} y={c.y - r - 6} textAnchor="middle" className="map-zone-label">
              {gf.name}
            </text>
          </g>
        );
      })}

      {pending.map((d) => {
        const p = project(d.dropoff_lat, d.dropoff_lng);
        return (
          <g key={d.id}>
            <circle cx={p.x} cy={p.y} r={6} className="map-pending" />
            <title>{`${d.tracking_code} pending at ${shortAddress(d.destination_address)}`}</title>
          </g>
        );
      })}

      {routes.map((route) => {
        const vehicle = vehicles.find((v) => v.id === route.vehicle_id);
        if (!vehicle) return null;
        const start = project(vehicle.current_lat, vehicle.current_lng);
        const points = [start, ...route.stops.map((s) => project(s.lat, s.lng))];
        const selected = route.vehicle_id === selectedVehicleId;
        return (
          <polyline
            key={route.vehicle_id}
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            className={selected ? 'map-route map-route-selected' : 'map-route'}
          />
        );
      })}

      {routes.map((route) => {
        const selected = route.vehicle_id === selectedVehicleId;
        return route.stops.map((stop) => {
          const p = project(stop.lat, stop.lng);
          return (
            <g key={stop.delivery_id} className={selected ? 'map-stop map-stop-selected' : 'map-stop'}>
              <circle cx={p.x} cy={p.y} r={12} />
              <text x={p.x} y={p.y + 4} textAnchor="middle">
                {stop.sequence}
              </text>
              <title>{`${route.plate_number} stop ${stop.sequence}: ${stop.address}`}</title>
            </g>
          );
        });
      })}

      {vehicles.map((v) => {
        const p = project(v.current_lat, v.current_lng);
        const selected = v.id === selectedVehicleId;
        return (
          <g key={v.id} transform={`translate(${p.x} ${p.y})`} onClick={() => onSelectVehicle(v.id)} className="map-vehicle">
            {selected && <circle r={19} className="map-vehicle-halo" />}
            <g transform={`rotate(${v.heading_deg})`}>
              <path d="M 0 -17 L 5 -10 L -5 -10 Z" fill="var(--ink)" />
            </g>
            <rect x={-8} y={-8} width={16} height={16} rx={3} fill="var(--ink)" stroke={vehicleStroke(v.status)} strokeWidth={3} />
            <text x={14} y={22} className={selected ? 'map-plate map-plate-selected' : 'map-plate'}>
              {v.plate_number}
            </text>
          </g>
        );
      })}

      <g transform={`translate(24 ${MAP_HEIGHT - 28})`}>
        <line x1={0} y1={0} x2={scale} y2={0} stroke="var(--ink)" strokeWidth={2} />
        <line x1={0} y1={-5} x2={0} y2={5} stroke="var(--ink)" strokeWidth={2} />
        <line x1={scale} y1={-5} x2={scale} y2={5} stroke="var(--ink)" strokeWidth={2} />
        <text x={scale + 8} y={4} className="map-note">
          1 km
        </text>
      </g>
    </svg>
  );
};
