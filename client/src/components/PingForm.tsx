import React, { useEffect, useState } from 'react';
import type { IngestTelemetryDto, Vehicle } from '../../../shared/types';
import { LOW_BATTERY_PERCENT, OVERSPEED_KMH } from '../../../shared/rules';

interface PingFormProps {
  vehicles: Vehicle[];
  onSendPing: (dto: IngestTelemetryDto) => Promise<void>;
  onAdvanceFleet: () => Promise<void>;
  onNotice: (message: string) => void;
}

const OVERSPEED_TEST_KMH = 74;
const LOW_BATTERY_TEST_PERCENT = 8;

export const PingForm: React.FC<PingFormProps> = ({ vehicles, onSendPing, onAdvanceFleet, onNotice }) => {
  const [vehicleId, setVehicleId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [speed, setSpeed] = useState('');
  const [battery, setBattery] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = (id: string, list: Vehicle[] = vehicles): void => {
    setVehicleId(id);
    const v = list.find((item) => item.id === id);
    if (v) {
      setLat(String(v.current_lat));
      setLng(String(v.current_lng));
      setSpeed(String(Math.round(v.speed_kmh)));
      setBattery(String(v.battery_percent));
    }
  };

  useEffect(() => {
    if (!vehicleId && vehicles.length > 0) pick(vehicles[0].id, vehicles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, vehicleId]);

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!vehicleId) return;
    void run(() =>
      onSendPing({
        vehicle_id: vehicleId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        speed_kmh: parseFloat(speed),
        battery_percent: parseInt(battery, 10),
      }),
    );
  };

  const sendOverspeed = (): void => {
    const target = vehicles.find((v) => v.status === 'en_route') ?? vehicles[0];
    if (!target) return;
    void run(() =>
      onSendPing({
        vehicle_id: target.id,
        lat: target.current_lat + 0.001,
        lng: target.current_lng + 0.001,
        speed_kmh: OVERSPEED_TEST_KMH,
        battery_percent: target.battery_percent,
      }),
    );
  };

  const sendLowBattery = (): void => {
    // The alert fires when the level crosses the threshold, so pick a vehicle that is still above it.
    const target = vehicles.find((v) => v.battery_percent >= LOW_BATTERY_PERCENT);
    if (!target) {
      onNotice(`Every vehicle is already below ${LOW_BATTERY_PERCENT}% battery`);
      return;
    }
    void run(() =>
      onSendPing({
        vehicle_id: target.id,
        lat: target.current_lat,
        lng: target.current_lng,
        battery_percent: LOW_BATTERY_TEST_PERCENT,
      }),
    );
  };

  return (
    <>
      <form onSubmit={submit} className="ping-form">
        <label className="field field-wide">
          <span>Vehicle</span>
          <select value={vehicleId} onChange={(e) => pick(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} ({v.model})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Latitude</span>
          <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} required />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} required />
        </label>
        <label className="field">
          <span>Speed (km/h)</span>
          <input type="number" min="0" max="300" value={speed} onChange={(e) => setSpeed(e.target.value)} required />
        </label>
        <label className="field">
          <span>Battery (%)</span>
          <input type="number" min="0" max="100" value={battery} onChange={(e) => setBattery(e.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary field-wide" disabled={busy || !vehicleId}>
          Send ping
        </button>
      </form>
      <div className="ping-shortcuts">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(onAdvanceFleet)}>
          Move en-route vehicles one step
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={sendOverspeed}>
          {`Send overspeed ping (${OVERSPEED_TEST_KMH} km/h)`}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={sendLowBattery}>
          {`Send low-battery ping (${LOW_BATTERY_TEST_PERCENT}%)`}
        </button>
      </div>
      <p className="fine">
        A ping is one position report. The rules flag zone entry and exit, speed above {OVERSPEED_KMH} km/h and battery that drops
        below {LOW_BATTERY_PERCENT}%.
      </p>
    </>
  );
};
