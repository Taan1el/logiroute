export interface GeoPoint {
  lat: number;
  lng: number;
}

export type VehicleStatus = 'idle' | 'en_route' | 'maintenance';

export interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  status: VehicleStatus;
  battery_percent: number;
  current_lat: number;
  current_lng: number;
  speed_kmh: number;
  heading_deg: number;
  updated_at: string;
}

export interface Geofence {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  color: string;
}

export type DeliveryStatus = 'pending' | 'dispatched' | 'in_transit' | 'arrived_at_hub' | 'completed';

export interface Delivery {
  id: string;
  tracking_code: string;
  vehicle_id?: string | null;
  vehicle_plate?: string | null;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  destination_address: string;
  status: DeliveryStatus;
  distance_km: number;
  eta_minutes: number;
  created_at: string;
  updated_at: string;
}

export type AlertType = 'geofence_entered' | 'geofence_exited' | 'overspeed_detected' | 'low_battery';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertEvent {
  id: string;
  vehicle_id: string;
  vehicle_plate?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface FleetMetrics {
  total_vehicles: number;
  active_en_route: number;
  active_deliveries: number;
  completed_24h: number;
  alerts_24h: number;
  avg_battery_percent: number;
}

export interface IngestTelemetryDto {
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh?: number;
  battery_percent?: number;
  heading_deg?: number;
}

export interface CreateDeliveryDto {
  destination_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_lat?: number;
  pickup_lng?: number;
  vehicle_id?: string;
}

export interface UpdateDeliveryStatusDto {
  status: DeliveryStatus;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
