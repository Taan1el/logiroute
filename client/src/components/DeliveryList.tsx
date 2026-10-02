import React, { useState } from 'react';
import type { Delivery, DeliveryStatus, Vehicle } from '../../../shared/types';
import { nextDeliveryStatus } from '../../../shared/rules';
import { DELIVERY_STATUS_LABEL, formatKm } from '../utils/format';

interface DeliveryListProps {
  deliveries: Delivery[];
  vehicles: Vehicle[];
  onUpdateStatus: (id: string, status: DeliveryStatus) => void;
  onAssignVehicle: (deliveryId: string, vehicleId: string) => void;
}

type Filter = 'all' | 'open' | 'done';

const ACTION_LABEL: Partial<Record<DeliveryStatus, string>> = {
  in_transit: 'Start trip',
  arrived_at_hub: 'Mark arrived',
  completed: 'Complete delivery',
};

const AssignControl: React.FC<{ vehicles: Vehicle[]; onAssign: (vehicleId: string) => void }> = ({ vehicles, onAssign }) => {
  const [choice, setChoice] = useState('');
  return (
    <div className="assign">
      <label className="field-inline">
        <span>Assign vehicle</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">{vehicles.length ? 'Choose idle vehicle' : 'No idle vehicle'}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate_number} ({v.model})
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-secondary" disabled={!choice} onClick={() => onAssign(choice)}>
        Dispatch
      </button>
    </div>
  );
};

export const DeliveryList: React.FC<DeliveryListProps> = ({ deliveries, vehicles, onUpdateStatus, onAssignVehicle }) => {
  const [filter, setFilter] = useState<Filter>('open');
  const open = deliveries.filter((d) => d.status !== 'completed');
  const done = deliveries.filter((d) => d.status === 'completed');
  const shown = filter === 'all' ? deliveries : filter === 'open' ? open : done;
  const assignable = vehicles.filter((v) => v.status === 'idle');

  const tabs: { id: Filter; label: string }[] = [
    { id: 'open', label: `Open ${open.length}` },
    { id: 'done', label: `Completed ${done.length}` },
    { id: 'all', label: `All ${deliveries.length}` },
  ];

  return (
    <>
      <fieldset className="segmented">
        <legend className="sr-only">Filter deliveries</legend>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={filter === tab.id ? 'seg seg-on' : 'seg'}
            aria-pressed={filter === tab.id}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </fieldset>
      <ul className="rows">
        {shown.map((d) => {
          const next = nextDeliveryStatus(d.status);
          const action = next ? ACTION_LABEL[next] : undefined;
          return (
            <li key={d.id} className="delivery-row">
              <div className="delivery-main">
                <span className="mono">{d.tracking_code}</span>
                <span className={`status status-${d.status}`}>{DELIVERY_STATUS_LABEL[d.status]}</span>
              </div>
              <div className="delivery-address">{d.destination_address}</div>
              <div className="delivery-meta mono">
                {d.vehicle_plate ? d.vehicle_plate : 'No vehicle'} / {formatKm(d.distance_km)}
                {d.status !== 'completed' && d.status !== 'arrived_at_hub' ? ` / ETA ${d.eta_minutes} min` : ''}
              </div>
              <div className="delivery-action">
                {d.status === 'pending' && <AssignControl vehicles={assignable} onAssign={(vehicleId) => onAssignVehicle(d.id, vehicleId)} />}
                {next && action && d.status !== 'pending' && (
                  <button type="button" className="btn btn-secondary" onClick={() => onUpdateStatus(d.id, next)}>
                    {action}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {shown.length === 0 && <li className="empty">No deliveries in this view.</li>}
      </ul>
    </>
  );
};
