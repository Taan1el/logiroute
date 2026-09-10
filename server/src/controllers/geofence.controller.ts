import { Request, Response } from 'express';
import { FleetService } from '../services/fleet.service.js';

export class GeofenceController {
  constructor(private fleetService: FleetService) {}

  list = (_req: Request, res: Response): void => {
    try {
      const geofences = this.fleetService.listGeofences();
      res.json({ success: true, data: geofences });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  create = (req: Request, res: Response): void => {
    try {
      const { name, center_lat, center_lng, radius_meters, alert_on_enter, alert_on_exit, color } = req.body;
      if (!name || center_lat === undefined || center_lng === undefined || !radius_meters) {
        res.status(400).json({
          success: false,
          error: 'name, center_lat, center_lng, and radius_meters are required',
        });
        return;
      }

      const created = this.fleetService.createGeofence({
        name,
        center_lat: Number(center_lat),
        center_lng: Number(center_lng),
        radius_meters: Number(radius_meters),
        alert_on_enter,
        alert_on_exit,
        color,
      });

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };
}
