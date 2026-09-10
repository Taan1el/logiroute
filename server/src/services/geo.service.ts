import { Geofence, GeoPoint } from '../../../shared/types.js';

const EARTH_RADIUS_KM = 6371;

export class GeoService {
  /**
   * Calculates Great-Circle distance between two coordinates using Haversine formula (km)
   */
  haversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
    const lat1Rad = (p1.lat * Math.PI) / 180;
    const lat2Rad = (p2.lat * Math.PI) / 180;
    const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;

    return Math.round(distance * 100) / 100;
  }

  /**
   * Calculates distance in meters
   */
  distanceMeters(p1: GeoPoint, p2: GeoPoint): number {
    return Math.round(this.haversineDistanceKm(p1, p2) * 1000);
  }

  /**
   * Checks whether a point falls within the circular boundary of a geofence
   */
  isInsideGeofence(point: GeoPoint, geofence: Geofence): boolean {
    const dist = this.distanceMeters(point, { lat: geofence.center_lat, lng: geofence.center_lng });
    return dist <= geofence.radius_meters;
  }

  /**
   * Computes compass heading (azimuth) from p1 to p2 in degrees (0..360)
   */
  calculateHeading(p1: GeoPoint, p2: GeoPoint): number {
    const lat1Rad = (p1.lat * Math.PI) / 180;
    const lat2Rad = (p2.lat * Math.PI) / 180;
    const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

    const y = Math.sin(deltaLng) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLng);

    const bearingRad = Math.atan2(y, x);
    const bearingDeg = (bearingRad * 180) / Math.PI;

    return Math.round((bearingDeg + 360) % 360);
  }
}
