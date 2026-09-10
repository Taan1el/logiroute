import React from 'react';
import { AlertEvent } from '../../../shared/types';

interface AlertsFeedProps {
  alerts: AlertEvent[];
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({ alerts }) => {
  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'geofence_entered':
        return '📍';
      case 'geofence_exited':
        return '🚧';
      case 'overspeed_detected':
        return '⚡';
      case 'low_battery':
        return '🪫';
      default:
        return '⚠️';
    }
  };

  return (
    <div className="card alerts-card">
      <div className="card-header">
        <h3>Live Event Alert Stream</h3>
        <span className="badge badge-warning">{alerts.length} Events</span>
      </div>

      <div className="alerts-scroll">
        {alerts.map((alert) => (
          <div key={alert.id} className={`alert-item alert-${alert.severity}`}>
            <div className="alert-icon-wrap">{getAlertIcon(alert.type)}</div>
            <div className="alert-body">
              <div className="alert-meta">
                {alert.vehicle_plate && (
                  <span className="plate-badge-sm">{alert.vehicle_plate}</span>
                )}
                <span className={`alert-type-badge type-${alert.type}`}>
                  {alert.type.replace(/_/g, ' ')}
                </span>
                <span className="alert-time">{formatTime(alert.created_at)}</span>
              </div>
              <p className="alert-message">{alert.message}</p>
              <div className="alert-coords">
                Lat: {alert.lat.toFixed(4)}, Lng: {alert.lng.toFixed(4)}
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="empty-alerts">
            <span>🛡️</span>
            <p>No active anomalies or violations detected across Tallinn fleet corridors.</p>
          </div>
        )}
      </div>
    </div>
  );
};
