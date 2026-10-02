import { Request, Response } from 'express';
import { FleetService } from '../services/fleet.service.js';

export class GeofenceController {
  constructor(private fleetService: FleetService) {}

  list = (_req: Request, res: Response): void => {
    try {
      res.json({ success: true, data: this.fleetService.listGeofences() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  create = (req: Request, res: Response): void => {
    try {
      const body = req.body ?? {};
      const created = this.fleetService.createGeofence({
        name: body.name,
        center_lat: body.center_lat,
        center_lng: body.center_lng,
        radius_meters: body.radius_meters,
        alert_on_enter: body.alert_on_enter,
        alert_on_exit: body.alert_on_exit,
        color: body.color,
      });
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };
}
