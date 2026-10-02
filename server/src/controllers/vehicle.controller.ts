import { Request, Response } from 'express';
import { FleetService } from '../services/fleet.service.js';

export class VehicleController {
  constructor(private fleetService: FleetService) {}

  list = (_req: Request, res: Response): void => {
    try {
      const vehicles = this.fleetService.listVehicles();
      res.json({ success: true, data: vehicles });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  getById = (req: Request, res: Response): void => {
    try {
      const vehicle = this.fleetService.getVehicleById(req.params.id);
      if (!vehicle) {
        res.status(404).json({ success: false, error: 'Vehicle not found' });
        return;
      }
      res.json({ success: true, data: vehicle });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  updateStatus = (req: Request, res: Response): void => {
    try {
      const { status } = req.body;
      if (!status || !['idle', 'en_route', 'maintenance'].includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status. Must be idle, en_route, or maintenance' });
        return;
      }
      const updated = this.fleetService.updateVehicleStatus(req.params.id, status);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(String(err.message).startsWith('Vehicle not found') ? 404 : 400).json({ success: false, error: err.message });
    }
  };
}
