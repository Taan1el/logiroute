import { Request, Response } from 'express';
import { DeliveryService } from '../services/delivery.service.js';
import { DeliveryStatus } from '../../../shared/types.js';

export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  list = (req: Request, res: Response): void => {
    try {
      const status = req.query.status as DeliveryStatus | undefined;
      const deliveries = this.deliveryService.listDeliveries(status);
      res.json({ success: true, data: deliveries });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  getById = (req: Request, res: Response): void => {
    try {
      const delivery = this.deliveryService.getDeliveryById(req.params.id);
      if (!delivery) {
        res.status(404).json({ success: false, error: 'Delivery not found' });
        return;
      }
      res.json({ success: true, data: delivery });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  create = (req: Request, res: Response): void => {
    try {
      const delivery = this.deliveryService.createDelivery(req.body);
      res.status(201).json({ success: true, data: delivery });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };

  updateStatus = (req: Request, res: Response): void => {
    try {
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ success: false, error: 'status is required' });
        return;
      }
      const updated = this.deliveryService.updateDeliveryStatus(req.params.id, status);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(String(err.message).startsWith('Delivery not found') ? 404 : 400).json({ success: false, error: err.message });
    }
  };

  assignVehicle = (req: Request, res: Response): void => {
    try {
      const { vehicle_id } = req.body;
      if (!vehicle_id) {
        res.status(400).json({ success: false, error: 'vehicle_id is required' });
        return;
      }
      const updated = this.deliveryService.assignVehicle(req.params.id, vehicle_id);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(String(err.message).startsWith('Delivery not found') ? 404 : 400).json({ success: false, error: err.message });
    }
  };
}
