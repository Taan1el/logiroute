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
      const { vehicle_id, lat, lng } = req.body;
      if (!vehicle_id || lat === undefined || lng === undefined) {
        res.status(400).json({ success: false, error: 'vehicle_id, lat, and lng are required' });
        return;
      }

      const result = this.telemetryService.ingest({
        vehicle_id,
        lat: Number(lat),
        lng: Number(lng),
        speed_kmh: req.body.speed_kmh !== undefined ? Number(req.body.speed_kmh) : undefined,
        battery_percent: req.body.battery_percent !== undefined ? Number(req.body.battery_percent) : undefined,
        heading_deg: req.body.heading_deg !== undefined ? Number(req.body.heading_deg) : undefined,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  listAlerts = (req: Request, res: Response): void => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const alerts = this.fleetService.listAlerts(limit);
      res.json({ success: true, data: alerts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  getMetrics = (_req: Request, res: Response): void => {
    try {
      const metrics = this.fleetService.getMetrics();
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}
