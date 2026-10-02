import type { AlertEvent, Delivery, Geofence, Vehicle } from '../../../shared/types';

export interface SampleData {
  vehicles: Vehicle[];
  geofences: Geofence[];
  deliveries: Delivery[];
  alerts: AlertEvent[];
}

const MINUTE = 60 * 1000;

/** First tracking number handed out to deliveries created in the demo. */
export const FIRST_NEW_TRACKING_NUMBER = 481210;

/**
 * Fixed sample fleet for the browser demo. Ids, positions and addresses never
 * change; only the timestamps are offsets from `now` so the 24 hour counters
 * make sense whenever the page is opened.
 */
export function buildSampleData(now: Date): SampleData {
  const at = (minutesAgo: number): string => new Date(now.getTime() - minutesAgo * MINUTE).toISOString();

  const vehicle = (v: Omit<Vehicle, 'updated_at'> & { age: number }): Vehicle => {
    const { age, ...rest } = v;
    return { ...rest, updated_at: at(age) };
  };

  const vehicles: Vehicle[] = [
    vehicle({ id: 'veh-801', plate_number: 'TLN-801', model: 'Bolt Rapid Courier EV', status: 'en_route', battery_percent: 88, current_lat: 59.435, current_lng: 24.748, speed_kmh: 42, heading_deg: 120, age: 0 }),
    vehicle({ id: 'veh-802', plate_number: 'TLN-802', model: 'Autonomous Pod Rover', status: 'en_route', battery_percent: 74, current_lat: 59.4245, current_lng: 24.801, speed_kmh: 18, heading_deg: 45, age: 0 }),
    vehicle({ id: 'veh-803', plate_number: 'TLN-803', model: 'Nordic Heavy Cargo Van', status: 'idle', battery_percent: 98, current_lat: 59.439, current_lng: 24.73, speed_kmh: 0, heading_deg: 0, age: 0 }),
    vehicle({ id: 'veh-804', plate_number: 'TLN-804', model: 'Express Delivery Bike', status: 'maintenance', battery_percent: 12, current_lat: 59.443, current_lng: 24.762, speed_kmh: 0, heading_deg: 0, age: 20 }),
  ];

  const geofences: Geofence[] = [
    { id: 'geo-vabaduse', name: 'Vabaduse Central Hub', center_lat: 59.4338, center_lng: 24.7453, radius_meters: 650, alert_on_enter: true, alert_on_exit: true, color: '#4d7c0f' },
    { id: 'geo-ulemiste', name: 'Ülemiste Depot', center_lat: 59.423, center_lng: 24.803, radius_meters: 900, alert_on_enter: true, alert_on_exit: true, color: '#4d7c0f' },
    { id: 'geo-telliskivi', name: 'Telliskivi Creative Hub', center_lat: 59.4398, center_lng: 24.729, radius_meters: 500, alert_on_enter: true, alert_on_exit: true, color: '#4d7c0f' },
    { id: 'geo-port', name: 'Passenger Port Terminal', center_lat: 59.4445, center_lng: 24.764, radius_meters: 450, alert_on_enter: true, alert_on_exit: true, color: '#4d7c0f' },
  ];

  const delivery = (
    n: number,
    d: Pick<Delivery, 'destination_address' | 'dropoff_lat' | 'dropoff_lng' | 'status' | 'distance_km' | 'eta_minutes'> & {
      vehicle: Vehicle | null;
      created: number;
      updated: number;
    },
  ): Delivery => ({
    id: `del-${n}`,
    tracking_code: `LR-TLN-${n}`,
    vehicle_id: d.vehicle?.id ?? null,
    vehicle_plate: d.vehicle?.plate_number ?? null,
    pickup_lat: 59.4338,
    pickup_lng: 24.7453,
    dropoff_lat: d.dropoff_lat,
    dropoff_lng: d.dropoff_lng,
    destination_address: d.destination_address,
    status: d.status,
    distance_km: d.distance_km,
    eta_minutes: d.eta_minutes,
    created_at: at(d.created),
    updated_at: at(d.updated),
  });

  const [v801, v802, v803] = vehicles;
  const deliveries: Delivery[] = [
    delivery(481201, { destination_address: 'Telliskivi 60a, Tallinn', dropoff_lat: 59.4398, dropoff_lng: 24.729, status: 'in_transit', distance_km: 1.2, eta_minutes: 7, vehicle: v801, created: 40, updated: 6 }),
    delivery(481202, { destination_address: 'Rotermanni 8, Tallinn', dropoff_lat: 59.4385, dropoff_lng: 24.757, status: 'dispatched', distance_km: 0.9, eta_minutes: 9, vehicle: v801, created: 30, updated: 12 }),
    delivery(481203, { destination_address: 'Endla 45, Tallinn', dropoff_lat: 59.427, dropoff_lng: 24.724, status: 'dispatched', distance_km: 1.4, eta_minutes: 11, vehicle: v801, created: 28, updated: 12 }),
    delivery(481204, { destination_address: 'Sadama 25, Tallinn', dropoff_lat: 59.4445, dropoff_lng: 24.764, status: 'dispatched', distance_km: 1.3, eta_minutes: 14, vehicle: v802, created: 25, updated: 5 }),
    delivery(481205, { destination_address: 'Tartu mnt 80, Tallinn', dropoff_lat: 59.428, dropoff_lng: 24.782, status: 'dispatched', distance_km: 2.1, eta_minutes: 12, vehicle: v802, created: 22, updated: 5 }),
    delivery(481206, { destination_address: 'Mustamäe tee 3, Tallinn', dropoff_lat: 59.4125, dropoff_lng: 24.7005, status: 'pending', distance_km: 3.7, eta_minutes: 14, vehicle: null, created: 3, updated: 3 }),
    delivery(481207, { destination_address: 'Pärnu mnt 139, Tallinn', dropoff_lat: 59.4205, dropoff_lng: 24.7385, status: 'pending', distance_km: 1.6, eta_minutes: 8, vehicle: null, created: 2, updated: 2 }),
    delivery(481200, { destination_address: 'Narva mnt 7, Tallinn', dropoff_lat: 59.4372, dropoff_lng: 24.7585, status: 'completed', distance_km: 1.1, eta_minutes: 0, vehicle: v803, created: 190, updated: 120 }),
  ];

  const alerts: AlertEvent[] = [
    { id: 'alert-2', vehicle_id: 'veh-804', vehicle_plate: 'TLN-804', type: 'low_battery', severity: 'critical', message: 'Battery low: 12% remaining. Plan a charging stop for this vehicle.', lat: 59.443, lng: 24.762, created_at: at(20) },
    { id: 'alert-1', vehicle_id: 'veh-801', vehicle_plate: 'TLN-801', type: 'geofence_entered', severity: 'info', message: 'Vehicle entered geofence: Vabaduse Central Hub', lat: 59.4338, lng: 24.7453, created_at: at(35) },
  ];

  return { vehicles, geofences, deliveries, alerts };
}
