import React, { useEffect, useRef, useState } from 'react';
import type { CreateDeliveryDto, Vehicle } from '../../../shared/types';

interface NewDeliveryDialogProps {
  vehicles: Vehicle[];
  onClose: () => void;
  onSubmit: (dto: CreateDeliveryDto) => Promise<void>;
}

const PRESETS = [
  { address: 'Rotermanni 8, Tallinn', lat: 59.4385, lng: 24.757 },
  { address: 'Mustamäe tee 3, Tallinn', lat: 59.4125, lng: 24.7005 },
  { address: 'Endla 45, Tallinn', lat: 59.427, lng: 24.724 },
  { address: 'Kopli 25, Tallinn', lat: 59.4515, lng: 24.7075 },
];

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';

export const NewDeliveryDialog: React.FC<NewDeliveryDialogProps> = ({ vehicles, onClose, onSubmit }) => {
  const [address, setAddress] = useState(PRESETS[0].address);
  const [lat, setLat] = useState(String(PRESETS[0].lat));
  const [lng, setLng] = useState(String(PRESETS[0].lng));
  const [vehicleId, setVehicleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('input')?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        destination_address: address,
        dropoff_lat: parseFloat(lat),
        dropoff_lng: parseFloat(lng),
        vehicle_id: vehicleId || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The delivery could not be created');
    } finally {
      setBusy(false);
    }
  };

  const idle = vehicles.filter((v) => v.status === 'idle');

  return (
    <div className="dialog-backdrop" onKeyDown={onKeyDown}>
      <div className="dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="new-delivery-title">
        <h2 id="new-delivery-title">New delivery</h2>
        <form onSubmit={(e) => void submit(e)}>
          <label className="field">
            <span>Destination address</span>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </label>
          <div className="field-pair">
            <label className="field">
              <span>Drop-off latitude</span>
              <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} required />
            </label>
            <label className="field">
              <span>Drop-off longitude</span>
              <input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} required />
            </label>
          </div>
          <div className="presets">
            <span className="fine">Fill from a known address</span>
            <div className="preset-row">
              {PRESETS.map((p) => (
                <button
                  key={p.address}
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setAddress(p.address);
                    setLat(String(p.lat));
                    setLng(String(p.lng));
                  }}
                >
                  {p.address.split(',')[0]}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Vehicle (optional)</span>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Leave pending</option>
              {idle.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} ({v.model})
                </option>
              ))}
            </select>
          </label>
          {error && <output className="form-error">{error}</output>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {vehicleId ? 'Create and dispatch' : 'Create delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
