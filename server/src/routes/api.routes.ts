import { Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { VehicleRepository } from '../repositories/vehicle.repository.js';
import { GeofenceRepository } from '../repositories/geofence.repository.js';
import { DeliveryRepository } from '../repositories/delivery.repository.js';
import { AlertRepository } from '../repositories/alert.repository.js';
import { GeoService } from '../services/geo.service.js';
import { TelemetryService } from '../services/telemetry.service.js';
import { DeliveryService } from '../services/delivery.service.js';
import { FleetService } from '../services/fleet.service.js';
import { VehicleController } from '../controllers/vehicle.controller.js';
import { GeofenceController } from '../controllers/geofence.controller.js';
import { DeliveryController } from '../controllers/delivery.controller.js';
import { TelemetryController } from '../controllers/telemetry.controller.js';

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router();

  // Repositories
  const vehicleRepo = new VehicleRepository(db);
  const geofenceRepo = new GeofenceRepository(db);
  const deliveryRepo = new DeliveryRepository(db);
  const alertRepo = new AlertRepository(db);

  // Services
  const geoService = new GeoService();
  const telemetryService = new TelemetryService(vehicleRepo, geofenceRepo, alertRepo, deliveryRepo, geoService);
  const deliveryService = new DeliveryService(deliveryRepo, vehicleRepo, geoService);
  const fleetService = new FleetService(vehicleRepo, geofenceRepo, alertRepo);

  // Controllers
  const vehicleController = new VehicleController(fleetService);
  const geofenceController = new GeofenceController(fleetService);
  const deliveryController = new DeliveryController(deliveryService);
  const telemetryController = new TelemetryController(telemetryService, fleetService);

  // Health
  router.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Vehicles
  router.get('/vehicles', vehicleController.list);
  router.get('/vehicles/:id', vehicleController.getById);
  router.patch('/vehicles/:id/status', vehicleController.updateStatus);

  // Geofences
  router.get('/geofences', geofenceController.list);
  router.post('/geofences', geofenceController.create);

  // Deliveries
  router.get('/deliveries', deliveryController.list);
  router.get('/deliveries/:id', deliveryController.getById);
  router.post('/deliveries', deliveryController.create);
  router.patch('/deliveries/:id/status', deliveryController.updateStatus);
  router.post('/deliveries/:id/assign', deliveryController.assignVehicle);

  // Telemetry & Fleet Insights
  router.post('/telemetry/ingest', telemetryController.ingest);
  router.get('/alerts', telemetryController.listAlerts);
  router.get('/metrics', telemetryController.getMetrics);

  return router;
}
