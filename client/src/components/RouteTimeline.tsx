import React from 'react';
import type { Vehicle } from '../../../shared/types';
import type { FleetRoute } from '../../../shared/route';
import { PLANNING_SPEED_KMH } from '../../../shared/rules';
import { formatCoords, formatKm, pluralize } from '../utils/format';

interface RouteTimelineProps {
  vehicle: Vehicle | null;
  route: FleetRoute | null;
}

export const RouteTimeline: React.FC<RouteTimelineProps> = ({ vehicle, route }) => {
  if (!vehicle) {
    return <p className="empty">No vehicles loaded yet.</p>;
  }
  if (!route) {
    return (
      <p className="empty">
        {vehicle.plate_number} has no dispatched or in-transit delivery, so there is no route to plan. Assign a pending delivery to
        give it one.
      </p>
    );
  }
  return (
    <>
      <p className="section-sub mono">
        {pluralize(route.stops.length, 'stop')} / {formatKm(route.total_km)}
      </p>
      <ol className="timeline">
        <li className="timeline-item timeline-start">
          <span className="timeline-mark" aria-hidden="true" />
          <div>
            <strong>{route.plate_number} now</strong>
            <span className="meta mono">{formatCoords(vehicle.current_lat, vehicle.current_lng)}</span>
          </div>
        </li>
        {route.stops.map((stop) => (
          <li key={stop.delivery_id} className="timeline-item">
            <span className="timeline-mark mono" aria-hidden="true">
              {stop.sequence}
            </span>
            <div>
              <strong>{stop.address}</strong>
              <span className="meta mono">
                {stop.tracking_code} / +{formatKm(stop.leg_km)} / {stop.eta_minutes} min
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="fine">
        Stops are ordered nearest first from the vehicle position, so the order is a heuristic and not the shortest possible
        tour. Distances are straight lines and ETAs assume {PLANNING_SPEED_KMH} km/h.
      </p>
    </>
  );
};
