import React from 'react';
import type { FleetRoute } from '../../../shared/route';
import type { Delivery } from '../../../shared/types';
import { PLANNING_SPEED_KMH } from '../../../shared/rules';
import { formatKm } from '../utils/format';

interface RouteTableProps {
  routes: FleetRoute[];
  pending: Delivery[];
}

/** The map's route data as a table: the text alternative and a denser view. */
export const RouteTable: React.FC<RouteTableProps> = ({ routes, pending }) => (
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Planned stops for every vehicle">
    {routes.length === 0 ? (
      <p className="empty">No vehicle has an active delivery, so there is no route to list.</p>
    ) : (
      <>
      <table className="route-table">
        <thead>
          <tr>
            <th scope="col">Vehicle</th>
            <th scope="col">Stop</th>
            <th scope="col">Delivery</th>
            <th scope="col">Address</th>
            <th scope="col">Leg</th>
            <th scope="col">Total</th>
            <th scope="col">ETA</th>
          </tr>
        </thead>
        <tbody>
          {routes.flatMap((route) =>
            route.stops.map((stop) => (
              <tr key={stop.delivery_id}>
                <td className="mono">{route.plate_number}</td>
                <td className="mono">{stop.sequence}</td>
                <td className="mono">{stop.tracking_code}</td>
                <td>{stop.address}</td>
                <td className="mono">{formatKm(stop.leg_km)}</td>
                <td className="mono">{formatKm(stop.cumulative_km)}</td>
                <td className="mono">{stop.eta_minutes} min</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="fine">
        Straight-line distances, nearest stop first, at {PLANNING_SPEED_KMH} km/h with no traffic or service time.
      </p>
      </>
    )}
    <h3 className="table-heading">Waiting for a vehicle</h3>
    {pending.length === 0 ? (
      <p className="empty">Every delivery has a vehicle.</p>
    ) : (
      <ul className="rows">
        {pending.map((d) => (
          <li key={d.id} className="pending-row">
            <span className="mono">{d.tracking_code}</span>
            <span>{d.destination_address}</span>
            <span className="mono">{formatKm(d.distance_km)} from pickup</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);
