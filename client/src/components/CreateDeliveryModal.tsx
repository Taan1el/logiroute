import React, { useState } from 'react';
import { CreateDeliveryDto, Vehicle } from '../../../shared/types';

interface CreateDeliveryModalProps {
  isOpen: boolean;
  vehicles: Vehicle[];
  onClose: () => void;
  onSubmit: (dto: CreateDeliveryDto) => Promise<void>;
}

const PRESET_DESTINATIONS = [
  {
    address: 'Rotermanni Kvartal, Rotermanni 8, Tallinn',
    lat: 59.4385,
    lng: 24.757,
  },
  {
    address: 'Tehnopol Science Park, Akadeemia tee 21/1, Tallinn',
    lat: 59.397,
    lng: 24.671,
  },
  {
    address: 'Kristiine Keskus, Endla 45, Tallinn',
    lat: 59.427,
    lng: 24.724,
  },
  {
    address: 'Pirita Marina Yacht Club, Regati pst 1, Tallinn',
    lat: 59.467,
    lng: 24.825,
  },
];

export const CreateDeliveryModal: React.FC<CreateDeliveryModalProps> = ({
  isOpen,
  vehicles,
  onClose,
  onSubmit,
}) => {
  const [address, setAddress] = useState(PRESET_DESTINATIONS[0].address);
  const [dropoffLat, setDropoffLat] = useState(PRESET_DESTINATIONS[0].lat.toString());
  const [dropoffLng, setDropoffLng] = useState(PRESET_DESTINATIONS[0].lng.toString());
  const [vehicleId, setVehicleId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESET_DESTINATIONS[0]) => {
    setAddress(preset.address);
    setDropoffLat(preset.lat.toString());
    setDropoffLng(preset.lng.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        destination_address: address,
        dropoff_lat: parseFloat(dropoffLat),
        dropoff_lng: parseFloat(dropoffLng),
        pickup_lat: 59.4338,
        pickup_lng: 24.7453,
        vehicle_id: vehicleId || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableVehicles = vehicles.filter((v) => v.status === 'idle');

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Dispatch New Delivery</h3>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group mb-3">
            <label>Quick Preset Destinations (Tallinn Commercial Hubs)</label>
            <div className="preset-buttons">
              {PRESET_DESTINATIONS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn-preset"
                  onClick={() => handleSelectPreset(p)}
                >
                  {p.address.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Destination Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="form-control"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Dropoff Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={dropoffLat}
                onChange={(e) => setDropoffLat(e.target.value)}
                className="form-control"
                required
              />
            </div>
            <div className="form-group">
              <label>Dropoff Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={dropoffLng}
                onChange={(e) => setDropoffLng(e.target.value)}
                className="form-control"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Assign Vehicle (Optional)</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="form-control"
            >
              <option value="">Leave Unassigned (Pending Pool)</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} — {v.model} (Battery: {v.battery_percent}%)
                </option>
              ))}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Confirm & Dispatch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
