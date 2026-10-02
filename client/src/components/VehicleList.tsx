import React from 'react';
import type { Vehicle } from '../../../shared/types';
import { LOW_BATTERY_PERCENT, OVERSPEED_KMH } from '../../../shared/rules';
import { VEHICLE_STATUS_LABEL } from '../utils/format';

interface VehicleListProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  onToggleStatus: (vehicle: Vehicle) => void;
}

export const VehicleList: React.FC<VehicleListProps> = ({ vehicles, selectedVehicleId, onSelectVehicle, onToggleStatus }) => (
  <ul className="rows">
    {vehicles.map((v) => {
      const low = v.battery_percent < LOW_BATTERY_PERCENT;
      return (
        <li key={v.id} className="vehicle-row">
          <button
            type="button"
            className={v.id === selectedVehicleId ? 'row-select row-select-on' : 'row-select'}
            aria-pressed={v.id === selectedVehicleId}
            onClick={() => onSelectVehicle(v.id)}
          >
            <span className="mono plate">{v.plate_number}</span>
            <span className="model">{v.model}</span>
          </button>
          <div className="vehicle-meta">
          <span className={`status status-${v.status}`}>{VEHICLE_STATUS_LABEL[v.status]}</span>
          <span className="battery" title="Battery">
            <span className="meter-track" aria-hidden="true">
              <span className={low ? 'meter-fill meter-low' : 'meter-fill'} style={{ width: `${v.battery_percent}%` }} />
            </span>
            <span className="mono">{`${v.battery_percent}%`}</span>
          </span>
          <span className={v.speed_kmh > OVERSPEED_KMH ? 'mono speed speed-over' : 'mono speed'}>{`${Math.round(v.speed_kmh)} km/h`}</span>
          </div>
          <button type="button" className="btn btn-quiet" onClick={() => onToggleStatus(v)}>
            {v.status === 'maintenance' ? 'Return to idle' : 'Set maintenance'}
          </button>
        </li>
      );
    })}
  </ul>
);
