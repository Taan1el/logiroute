import React, { useState } from 'react';
import { Vehicle, Geofence, Delivery } from '../../../shared/types';

interface LogisticsMapProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  deliveries: Delivery[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

// Coordinate projection bounds for Tallinn Urban Corridor
const MIN_LAT = 59.395;
const MAX_LAT = 59.455;
const MIN_LNG = 24.690;
const MAX_LNG = 24.830;

const WIDTH = 840;
const HEIGHT = 520;

export const LogisticsMap: React.FC<LogisticsMapProps> = ({
  vehicles,
  geofences,
  deliveries,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Project geographic coordinates into SVG canvas
  const project = (lat: number, lng: number) => {
    const clampedLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat));
    const clampedLng = Math.max(MIN_LNG, Math.min(MAX_LNG, lng));

    const x = ((clampedLng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WIDTH;
    // Invert Y because SVG coordinates increase downwards
    const y = ((MAX_LAT - clampedLat) / (MAX_LAT - MIN_LAT)) * HEIGHT;

    return { x, y };
  };

  // Convert geofence radius in meters to approximate SVG pixel radius
  const radiusToPixels = (meters: number) => {
    const latSpanMeters = (MAX_LAT - MIN_LAT) * 111320; // 1 deg lat ~ 111.32 km
    const pixelsPerMeter = HEIGHT / latSpanMeters;
    return Math.max(14, meters * pixelsPerMeter);
  };

  const activeDeliveries = deliveries.filter(
    (d) => d.status === 'in_transit' || d.status === 'dispatched'
  );

  const displayedVehicles = filterActiveOnly
    ? vehicles.filter((v) => v.status === 'en_route')
    : vehicles;

  return (
    <div className="card map-card">
      <div className="card-header map-card-header">
        <div>
          <h3>Tallinn Urban Fleet Dispatch Radar</h3>
          <p className="subtitle">Real-time GPS telemetry, geofence barriers & corridor transit paths</p>
        </div>
        <div className="map-controls">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
            />
            Show En Route Only ({vehicles.filter((v) => v.status === 'en_route').length})
          </label>
        </div>
      </div>

      <div className="map-container">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="radar-svg"
          aria-label="Tallinn Logistics Map Radar"
        >
          <defs>
            <radialGradient id="hubGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
            </radialGradient>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            </pattern>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Background Grid */}
          <rect width={WIDTH} height={HEIGHT} fill="#090d16" />
          <rect width={WIDTH} height={HEIGHT} fill="url(#gridPattern)" />

          {/* Tallinn Coastline / Water Hint */}
          <path
            d="M 0,0 L 840,0 L 840,75 C 680,105 520,80 340,110 C 210,130 90,80 0,60 Z"
            fill="#0f172a"
            opacity="0.75"
          />
          <text x="380" y="45" fill="#475569" fontSize="11" letterSpacing="2" fontWeight="600">
            TALLINNA LAHT / GULF OF FINLAND
          </text>
          <text x="660" y="480" fill="#334155" fontSize="10" letterSpacing="1.5">
            ÜLEMISTE JÄRV
          </text>

          {/* Geofences */}
          {geofences.map((gf) => {
            const { x, y } = project(gf.center_lat, gf.center_lng);
            const r = radiusToPixels(gf.radius_meters);
            return (
              <g key={gf.id} className="geofence-group">
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={gf.color}
                  fillOpacity="0.12"
                  stroke={gf.color}
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  className="geofence-circle"
                />
                <circle cx={x} cy={y} r="3" fill={gf.color} />
                <text
                  x={x}
                  y={y - r - 6}
                  textAnchor="middle"
                  fill={gf.color}
                  fontSize="11"
                  fontWeight="600"
                  className="geofence-label"
                >
                  {gf.name}
                </text>
                <text
                  x={x}
                  y={y + r + 13}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                >
                  r={gf.radius_meters}m
                </text>
              </g>
            );
          })}

          {/* Transit Trajectories (Active Deliveries) */}
          {activeDeliveries.map((del) => {
            const p1 = project(del.pickup_lat, del.pickup_lng);
            const p2 = project(del.dropoff_lat, del.dropoff_lng);
            return (
              <g key={del.id} className="delivery-trajectory">
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  opacity="0.65"
                  markerEnd="url(#arrow)"
                />
                {/* Pickup Hub Dot */}
                <circle cx={p1.x} cy={p1.y} r="4" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
                {/* Dropoff Destination Pin */}
                <circle cx={p2.x} cy={p2.y} r="5" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                <text
                  x={p2.x + 8}
                  y={p2.y + 3}
                  fill="#fda4af"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {del.destination_address.split(',')[0]} ({del.eta_minutes}m)
                </text>
              </g>
            );
          })}

          {/* Vehicles */}
          {displayedVehicles.map((v) => {
            const { x, y } = project(v.current_lat, v.current_lng);
            const isSelected = selectedVehicleId === v.id;
            const statusColor =
              v.status === 'en_route' ? '#10b981' : v.status === 'idle' ? '#94a3b8' : '#ef4444';

            return (
              <g
                key={v.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectVehicle(v.id)}
                className={`vehicle-marker ${isSelected ? 'selected' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                {/* Ping ring for en-route vehicles */}
                {v.status === 'en_route' && (
                  <circle r="16" fill="none" stroke={statusColor} strokeWidth="1.5" opacity="0.4" className="pulse-ring" />
                )}

                {/* Outer halo */}
                <circle r={isSelected ? '12' : '9'} fill="#0f172a" stroke={isSelected ? '#38bdf8' : statusColor} strokeWidth="2.5" />

                {/* Inner status dot */}
                <circle r="4" fill={statusColor} />

                {/* Heading Arrow Pointer */}
                <g transform={`rotate(${v.heading_deg})`}>
                  <path d="M 0 -11 L 3 -6 L -3 -6 Z" fill={statusColor} />
                </g>

                {/* Vehicle Plate Tag */}
                <g transform="translate(0, 16)">
                  <rect
                    x="-26"
                    y="-6"
                    width="52"
                    height="14"
                    rx="3"
                    fill="#1e293b"
                    stroke={isSelected ? '#38bdf8' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#f1f5f9"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {v.plate_number}
                  </text>
                </g>

                {/* Speed indicator */}
                {v.speed_kmh > 0 && (
                  <text
                    x="0"
                    y="-14"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="8"
                    fontWeight="600"
                  >
                    {Math.round(v.speed_kmh)} km/h
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-badge badge-green">●</span> En Route
        </div>
        <div className="legend-item">
          <span className="legend-badge badge-gray">●</span> Idle
        </div>
        <div className="legend-item">
          <span className="legend-badge badge-red">●</span> Maintenance
        </div>
        <div className="legend-item">
          <span className="legend-line">┅┅</span> Active Corridor Route
        </div>
        <div className="legend-item">
          <span className="legend-circle">○</span> Geofence Perimeter
        </div>
      </div>
    </div>
  );
};
