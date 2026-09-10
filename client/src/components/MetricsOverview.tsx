import React from 'react';
import { FleetMetrics } from '../../../shared/types';

interface MetricsOverviewProps {
  metrics: FleetMetrics;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ metrics }) => {
  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">Total Fleet</span>
        <span className="metric-value">{metrics.total_vehicles}</span>
        <span className="metric-sub">Connected telemetry units</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Vehicles En Route</span>
        <span className="metric-value text-success">{metrics.active_en_route}</span>
        <span className="metric-sub">Active urban transit</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Active Deliveries</span>
        <span className="metric-value text-accent">{metrics.active_deliveries}</span>
        <span className="metric-sub">Dispatched & In Transit</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Completed Today</span>
        <span className="metric-value text-purple">{metrics.completed_today}</span>
        <span className="metric-sub">Successful drops</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Fleet Alerts</span>
        <span className={`metric-value ${metrics.open_alerts > 0 ? 'text-warning' : 'text-muted'}`}>
          {metrics.open_alerts}
        </span>
        <span className="metric-sub">Geofence & speed violations</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Avg Battery State</span>
        <span
          className={`metric-value ${
            metrics.avg_battery_percent < 25
              ? 'text-danger'
              : metrics.avg_battery_percent < 60
              ? 'text-warning'
              : 'text-success'
          }`}
        >
          {metrics.avg_battery_percent}%
        </span>
        <div className="battery-bar-mini">
          <div
            className="battery-fill"
            style={{
              width: `${metrics.avg_battery_percent}%`,
              backgroundColor:
                metrics.avg_battery_percent < 25
                  ? '#ef4444'
                  : metrics.avg_battery_percent < 60
                  ? '#f59e0b'
                  : '#10b981',
            }}
          />
        </div>
      </div>
    </div>
  );
};
