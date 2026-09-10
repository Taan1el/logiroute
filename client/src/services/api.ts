import {
  Vehicle,
  Geofence,
  Delivery,
  AlertEvent,
  FleetMetrics,
  VehicleStatus,
  DeliveryStatus,
  CreateDeliveryDto,
  IngestTelemetryDto,
} from '../../../shared/types';

const API_BASE = '/api';

export const api = {
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getVehicles(): Promise<Vehicle[]> {
    const res = await fetch(`${API_BASE}/vehicles`);
    const json = await res.json();
    return json.data || [];
  },

  async updateVehicleStatus(id: string, status: VehicleStatus): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update vehicle');
    return json.data;
  },

  async getGeofences(): Promise<Geofence[]> {
    const res = await fetch(`${API_BASE}/geofences`);
    const json = await res.json();
    return json.data || [];
  },

  async createGeofence(data: Partial<Geofence>): Promise<Geofence> {
    const res = await fetch(`${API_BASE}/geofences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create geofence');
    return json.data;
  },

  async getDeliveries(status?: DeliveryStatus): Promise<Delivery[]> {
    const url = status ? `${API_BASE}/deliveries?status=${status}` : `${API_BASE}/deliveries`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },

  async createDelivery(data: CreateDeliveryDto): Promise<Delivery> {
    const res = await fetch(`${API_BASE}/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create delivery');
    return json.data;
  },

  async updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<Delivery> {
    const res = await fetch(`${API_BASE}/deliveries/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update delivery');
    return json.data;
  },

  async assignVehicle(deliveryId: string, vehicleId: string): Promise<Delivery> {
    const res = await fetch(`${API_BASE}/deliveries/${deliveryId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_id: vehicleId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to assign vehicle');
    return json.data;
  },

  async ingestTelemetry(
    data: IngestTelemetryDto
  ): Promise<{ vehicle: Vehicle; triggeredAlerts: AlertEvent[] }> {
    const res = await fetch(`${API_BASE}/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to ingest telemetry');
    return json.data;
  },

  async getAlerts(limit = 50): Promise<AlertEvent[]> {
    const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
    const json = await res.json();
    return json.data || [];
  },

  async getMetrics(): Promise<FleetMetrics> {
    const res = await fetch(`${API_BASE}/metrics`);
    const json = await res.json();
    return (
      json.data || {
        total_vehicles: 0,
        active_en_route: 0,
        active_deliveries: 0,
        completed_today: 0,
        open_alerts: 0,
        avg_battery_percent: 0,
      }
    );
  },
};
