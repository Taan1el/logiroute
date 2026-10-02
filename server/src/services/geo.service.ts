import {
  calculateHeading,
  distanceMeters,
  haversineDistanceKm,
  isInsideGeofence,
} from '../../../shared/geo.js';
import { Geofence, GeoPoint } from '../../../shared/types.js';

/** Thin wrapper over the shared geometry helpers so services can be injected. */
export class GeoService {
  haversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
    return haversineDistanceKm(p1, p2);
  }

  distanceMeters(p1: GeoPoint, p2: GeoPoint): number {
    return distanceMeters(p1, p2);
  }

  isInsideGeofence(point: GeoPoint, geofence: Geofence): boolean {
    return isInsideGeofence(point, geofence);
  }

  calculateHeading(p1: GeoPoint, p2: GeoPoint): number {
    return calculateHeading(p1, p2);
  }
}
