import { Request, Response } from 'express';
import { TelemetryService } from '../services/telemetry.service.js';
import { FleetService } from '../services/fleet.service.js';

export class TelemetryController {
  constructor(
    private telemetryService: TelemetryService,
    private fleetService: FleetService
  ) {}

  ingest = (req: Request, res: Response): void => {
    try {
      const body = req.body ?? {};
      const result = this.telemetryService.ingest({
        vehicle_id: body.vehicle_id,
        lat: body.lat,
        lng: body.lng,
        speed_kmh: body.speed_kmh,
        battery_percent: body.battery_percent,
        heading_deg: body.heading_deg,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      const status = String(err.message).startsWith('Vehicle not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  };

  listAlerts = (req: Request, res: Response): void => {
    try {
      const requested = Number(req.query.limit);
      const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 500) : 50;
      res.json({ success: true, data: this.fleetService.listAlerts(limit) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  getMetrics = (_req: Request, res: Response): void => {
    try {
      res.json({ success: true, data: this.fleetService.getMetrics() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}
