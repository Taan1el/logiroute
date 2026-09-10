import React, { useState } from 'react';
import { Delivery, DeliveryStatus, Vehicle } from '../../../shared/types';

interface DeliveryListProps {
  deliveries: Delivery[];
  vehicles: Vehicle[];
  onUpdateStatus: (id: string, nextStatus: DeliveryStatus) => void;
  onAssignVehicle: (deliveryId: string, vehicleId: string) => void;
  onOpenCreateModal: () => void;
}

export const DeliveryList: React.FC<DeliveryListProps> = ({
  deliveries,
  vehicles,
  onUpdateStatus,
  onAssignVehicle,
  onOpenCreateModal,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredDeliveries = deliveries.filter((d) => {
    if (filter === 'active') return d.status !== 'completed';
    if (filter === 'completed') return d.status === 'completed';
    return true;
  });

  const availableVehicles = vehicles.filter((v) => v.status === 'idle');

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>Consignment Deliveries</h3>
          <div className="tab-pills">
            <button
              className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({deliveries.length})
            </button>
            <button
              className={`tab-btn ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active ({deliveries.filter((d) => d.status !== 'completed').length})
            </button>
            <button
              className={`tab-btn ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed ({deliveries.filter((d) => d.status === 'completed').length})
            </button>
          </div>
        </div>
        <button className="btn btn-primary" onClick={onOpenCreateModal}>
          + New Delivery
        </button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tracking Code</th>
              <th>Destination Address</th>
              <th>Assigned Unit</th>
              <th>Distance</th>
              <th>ETA</th>
              <th>Status</th>
              <th>Lifecycle Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.map((del) => (
              <tr key={del.id}>
                <td>
                  <span className="font-mono tracking-code">{del.tracking_code}</span>
                </td>
                <td>
                  <div className="address-cell">
                    <span className="address-main">{del.destination_address}</span>
                    <span className="text-muted text-xs">
                      {del.dropoff_lat.toFixed(4)}, {del.dropoff_lng.toFixed(4)}
                    </span>
                  </div>
                </td>
                <td>
                  {del.vehicle_plate ? (
                    <span className="plate-badge">{del.vehicle_plate}</span>
                  ) : (
                    <select
                      className="select-mini"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          onAssignVehicle(del.id, e.target.value);
                        }
                      }}
                    >
                      <option value="" disabled>
                        Assign Vehicle...
                      </option>
                      {availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate_number} ({v.model})
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="font-mono">{del.distance_km.toFixed(1)} km</td>
                <td>
                  {del.status === 'completed' ? (
                    <span className="text-success font-semibold">Done</span>
                  ) : (
                    <span className="eta-badge">{del.eta_minutes} min</span>
                  )}
                </td>
                <td>
                  <span className={`status-pill pill-${del.status.replace(/_/g, '-')}`}>
                    {del.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  {del.status === 'pending' && (
                    <span className="text-muted text-xs">Awaiting vehicle assignment</span>
                  )}
                  {del.status === 'dispatched' && (
                    <button
                      className="btn-action btn-accent"
                      onClick={() => onUpdateStatus(del.id, 'in_transit')}
                    >
                      Dispatch In Transit
                    </button>
                  )}
                  {del.status === 'in_transit' && (
                    <button
                      className="btn-action btn-success"
                      onClick={() => onUpdateStatus(del.id, 'arrived_at_hub')}
                    >
                      Mark Arrived
                    </button>
                  )}
                  {del.status === 'arrived_at_hub' && (
                    <button
                      className="btn-action btn-success"
                      onClick={() => onUpdateStatus(del.id, 'completed')}
                    >
                      Complete Delivery
                    </button>
                  )}
                  {del.status === 'completed' && (
                    <span className="text-success text-xs font-semibold">Delivered</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredDeliveries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-muted">
                  No deliveries found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
