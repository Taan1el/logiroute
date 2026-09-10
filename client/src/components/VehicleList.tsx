import React from 'react';
import { Vehicle } from '../../../shared/types';

interface VehicleListProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  onToggleStatus: (vehicle: Vehicle) => void;
}

export const VehicleList: React.FC<VehicleListProps> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onToggleStatus,
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Fleet Telemetry Directory</h3>
        <span className="badge badge-info">{vehicles.length} Units</span>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Plate</th>
              <th>Model</th>
              <th>Status</th>
              <th>Battery</th>
              <th>Speed</th>
              <th>GPS Position</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const isSelected = selectedVehicleId === v.id;
              const batColor =
                v.battery_percent < 20 ? 'danger' : v.battery_percent < 50 ? 'warning' : 'success';

              return (
                <tr
                  key={v.id}
                  className={`table-row ${isSelected ? 'row-selected' : ''}`}
                  onClick={() => onSelectVehicle(v.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className="plate-badge">{v.plate_number}</span>
                  </td>
                  <td className="text-secondary">{v.model}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        v.status === 'en_route'
                          ? 'pill-en-route'
                          : v.status === 'idle'
                          ? 'pill-idle'
                          : 'pill-maintenance'
                      }`}
                    >
                      {v.status === 'en_route'
                        ? 'En Route'
                        : v.status === 'idle'
                        ? 'Idle'
                        : 'Maintenance'}
                    </span>
                  </td>
                  <td>
                    <div className="battery-display">
                      <div className="battery-bar-container">
                        <div
                          className={`battery-bar-fill bg-${batColor}`}
                          style={{ width: `${v.battery_percent}%` }}
                        />
                      </div>
                      <span className={`battery-text text-${batColor}`}>{v.battery_percent}%</span>
                    </div>
                  </td>
                  <td className="font-mono">
                    {v.speed_kmh > 0 ? (
                      <span className={v.speed_kmh > 50 ? 'text-danger font-bold' : ''}>
                        {Math.round(v.speed_kmh)} km/h
                      </span>
                    ) : (
                      <span className="text-muted">0 km/h</span>
                    )}
                  </td>
                  <td className="font-mono text-sm">
                    {v.current_lat.toFixed(4)}, {v.current_lng.toFixed(4)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`btn-action btn-${v.status === 'maintenance' ? 'secondary' : 'warning'}`}
                      onClick={() => onToggleStatus(v)}
                      title="Toggle between Maintenance and Idle"
                    >
                      {v.status === 'maintenance' ? 'Set Idle' : 'Maintenance'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
