import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { Vehicle, Geofence, Delivery, AlertEvent, FleetMetrics } from '../../../shared/types';

const mockVehicles: Vehicle[] = [
  {
    id: 'veh-1',
    plate_number: 'TLN-801',
    model: 'Bolt Rapid Courier EV',
    status: 'en_route',
    battery_percent: 88,
    current_lat: 59.435,
    current_lng: 24.748,
    speed_kmh: 42,
    heading_deg: 120,
    updated_at: '2026-09-10T12:00:00Z',
  },
  {
    id: 'veh-2',
    plate_number: 'TLN-802',
    model: 'Autonomous Pod Rover',
    status: 'idle',
    battery_percent: 74,
    current_lat: 59.4245,
    current_lng: 24.801,
    speed_kmh: 0,
    heading_deg: 45,
    updated_at: '2026-09-10T12:00:00Z',
  },
];

const mockGeofences: Geofence[] = [
  {
    id: 'geo-1',
    name: 'Vabaduse Central Hub',
    center_lat: 59.4338,
    center_lng: 24.7453,
    radius_meters: 650,
    alert_on_enter: true,
    alert_on_exit: true,
    color: '#38bdf8',
  },
];

const mockDeliveries: Delivery[] = [
  {
    id: 'del-1',
    tracking_code: 'LR-TLN-9812',
    vehicle_id: 'veh-1',
    vehicle_plate: 'TLN-801',
    pickup_lat: 59.4338,
    pickup_lng: 24.7453,
    dropoff_lat: 59.4398,
    dropoff_lng: 24.729,
    destination_address: 'Telliskivi 60a, 10412 Tallinn',
    status: 'in_transit',
    distance_km: 3.2,
    eta_minutes: 7,
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
  },
];

const mockAlerts: AlertEvent[] = [
  {
    id: 'alt-1',
    vehicle_id: 'veh-1',
    vehicle_plate: 'TLN-801',
    type: 'geofence_entered',
    severity: 'info',
    message: 'Vehicle TLN-801 entered geofence zone: Vabaduse Central Hub',
    lat: 59.4338,
    lng: 24.7453,
    created_at: '2026-09-10T12:00:00Z',
  },
];

const mockMetrics: FleetMetrics = {
  total_vehicles: 2,
  active_en_route: 1,
  active_deliveries: 1,
  completed_today: 0,
  open_alerts: 1,
  avg_battery_percent: 81,
};

describe('LogiRoute Dashboard Client Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/vehicles')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockVehicles }) });
        }
        if (url.includes('/api/geofences')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockGeofences }) });
        }
        if (url.includes('/api/deliveries')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockDeliveries }) });
        }
        if (url.includes('/api/alerts')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockAlerts }) });
        }
        if (url.includes('/api/metrics')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockMetrics }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      })
    );
  });

  it('renders application brand title and Tallinn urban corridor context', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /LogiRoute/i })).toBeInTheDocument();
    expect(screen.getByText(/Tallinn Corridor/i)).toBeInTheDocument();
  });

  it('renders fleet KPI metrics overview cards', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Total Fleet')).toBeInTheDocument();
      expect(screen.getByText('Vehicles En Route')).toBeInTheDocument();
      expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
      expect(screen.getByText('81%')).toBeInTheDocument();
    });
  });

  it('displays vehicles in telemetry directory with license plates', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('TLN-801').length).toBeGreaterThan(0);
      expect(screen.getAllByText('TLN-802').length).toBeGreaterThan(0);
      expect(screen.getByText('Bolt Rapid Courier EV')).toBeInTheDocument();
      expect(screen.getByText('Autonomous Pod Rover')).toBeInTheDocument();
    });
  });

  it('renders deliveries table with tracking codes and destination', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('LR-TLN-9812')).toBeInTheDocument();
      expect(screen.getByText('Telliskivi 60a, 10412 Tallinn')).toBeInTheDocument();
      expect(screen.getByText('7 min')).toBeInTheDocument();
    });
  });

  it('renders radar map with geofence label', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Vabaduse Central Hub')).toBeInTheDocument();
      expect(screen.getByText(/TALLINNA LAHT/i)).toBeInTheDocument();
    });
  });

  it('renders live alert event item in the stream', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Vehicle TLN-801 entered geofence zone/i)).toBeInTheDocument();
    });
  });
});
