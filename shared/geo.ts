import type { Geofence, GeoPoint } from './types.js';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (Haversine), rounded to 10 m. */
export function haversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const deltaLat = toRad(p2.lat - p1.lat);
  const deltaLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

export function distanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  return Math.round(haversineDistanceKm(p1, p2) * 1000);
}

export function isInsideGeofence(
  point: GeoPoint,
  geofence: Pick<Geofence, 'center_lat' | 'center_lng' | 'radius_meters'>,
): boolean {
  const center = { lat: geofence.center_lat, lng: geofence.center_lng };
  return distanceMeters(point, center) <= geofence.radius_meters;
}

/** Initial compass bearing from p1 to p2 in whole degrees, 0..359. */
export function calculateHeading(p1: GeoPoint, p2: GeoPoint): number {
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const deltaLng = toRad(p2.lng - p1.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360) % 360;
}
