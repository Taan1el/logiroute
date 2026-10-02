import type { AlertType, DeliveryStatus, VehicleStatus } from '../../../shared/types';

export { pluralize } from '../../../shared/rules';

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  idle: 'Idle',
  en_route: 'En route',
  maintenance: 'Maintenance',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  arrived_at_hub: 'Arrived',
  completed: 'Completed',
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  geofence_entered: 'Entered zone',
  geofence_exited: 'Left zone',
  overspeed_detected: 'Overspeed',
  low_battery: 'Low battery',
};

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Street part of an address ("Telliskivi 60a, Tallinn" gives "Telliskivi 60a"). */
export function shortAddress(address: string): string {
  return address.split(',')[0].trim();
}
