import React from 'react';
import type { FleetMetrics } from '../../../shared/types';
import { pluralize } from '../utils/format';

interface StatusBarProps {
  metrics: FleetMetrics;
  polling: boolean;
  intervalSeconds: number;
  loadError: boolean;
  lastUpdated: string | null;
}

/** One line of fleet counts, always visible at the bottom of the screen. */
export const StatusBar: React.FC<StatusBarProps> = ({ metrics, polling, intervalSeconds, loadError, lastUpdated }) => (
  <footer className="statusbar">
    <span className="mono">{pluralize(metrics.total_vehicles, 'vehicle')}</span>
    <span className="mono">{`${metrics.active_en_route} en route`}</span>
    <span className="mono">{pluralize(metrics.active_deliveries, 'active delivery', 'active deliveries')}</span>
    <span className="mono">{`${metrics.completed_24h} completed in 24 h`}</span>
    <span className="mono">{pluralize(metrics.alerts_24h, 'alert') + ' in 24 h'}</span>
    <span className="mono battery-avg">{`Battery avg ${metrics.avg_battery_percent}%`}</span>
    <output className={loadError ? 'sync sync-bad' : 'sync'}>
      {loadError
        ? 'Cannot reach the API'
        : polling
          ? `Refreshing every ${intervalSeconds} s${lastUpdated ? `, last ${lastUpdated}` : ''}`
          : 'Updates paused'}
    </output>
  </footer>
);
