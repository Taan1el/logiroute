import React from 'react';
import type { AlertEvent } from '../../../shared/types';
import { ALERT_TYPE_LABEL, formatTime } from '../utils/format';

interface AlertsListProps {
  alerts: AlertEvent[];
}

export const AlertsList: React.FC<AlertsListProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return <p className="empty">No alerts yet. Alerts appear when a vehicle enters or leaves a zone, speeds or runs low on battery.</p>;
  }
  return (
    <ol className="alerts">
      {alerts.map((alert) => (
        <li key={alert.id} className={`alert alert-${alert.severity}`}>
          <span className="mono alert-time">{formatTime(alert.created_at)}</span>
          <div>
            <span className="alert-head">
              {alert.vehicle_plate && <span className="mono">{alert.vehicle_plate}</span>}
              <span className="alert-type">{ALERT_TYPE_LABEL[alert.type]}</span>
            </span>
            <p className="alert-message">{alert.message}</p>
          </div>
        </li>
      ))}
    </ol>
  );
};
