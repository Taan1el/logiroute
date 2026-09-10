import React, { useState } from 'react';
import { Vehicle } from '../../../shared/types';

interface TelemetrySimulatorProps {
  vehicles: Vehicle[];
  onIngestTelemetry: (dto: {
    vehicle_id: string;
    lat: number;
    lng: number;
    speed_kmh?: number;
    battery_percent?: number;
    heading_deg?: number;
  }) => Promise<void>;
  onBatchSimulateStep: () => Promise<void>;
}

export const TelemetrySimulator: React.FC<TelemetrySimulatorProps> = ({
  vehicles,
  onIngestTelemetry,
  onBatchSimulateStep,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [lat, setLat] = useState<string>('59.4338');
  const [lng, setLng] = useState<string>('24.7453');
  const [speed, setSpeed] = useState<string>('45');
  const [battery, setBattery] = useState<string>('85');
  const [isSimulating, setIsSimulating] = useState(false);

  // Sync selected vehicle coordinates if changed
  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    const v = vehicles.find((veh) => veh.id === id);
    if (v) {
      setLat(v.current_lat.toString());
      setLng(v.current_lng.toString());
      setSpeed(v.speed_kmh.toString());
      setBattery(v.battery_percent.toString());
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;

    await onIngestTelemetry({
      vehicle_id: selectedVehicleId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      speed_kmh: parseFloat(speed),
      battery_percent: parseInt(battery, 10),
    });
  };

  const handleSimulateOverspeed = async () => {
    const target = vehicles.find((v) => v.status === 'en_route') || vehicles[0];
    if (!target) return;

    await onIngestTelemetry({
      vehicle_id: target.id,
      lat: target.current_lat + 0.001,
      lng: target.current_lng + 0.001,
      speed_kmh: 74, // Exceeds 50 km/h urban threshold
      battery_percent: target.battery_percent,
    });
  };

  const handleSimulateLowBattery = async () => {
    const target = vehicles[0];
    if (!target) return;

    await onIngestTelemetry({
      vehicle_id: target.id,
      lat: target.current_lat,
      lng: target.current_lng,
      battery_percent: 8, // Triggers critical low battery alert
    });
  };

  const handleStepMovement = async () => {
    setIsSimulating(true);
    try {
      await onBatchSimulateStep();
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>Interactive Telemetry Sandbox</h3>
          <p className="subtitle">Simulate real-time GPS pings, speed threshold violations & geofence transitions</p>
        </div>
        <div className="quick-action-buttons">
          <button
            className="btn btn-outline-accent"
            onClick={handleStepMovement}
            disabled={isSimulating}
          >
            {isSimulating ? 'Simulating...' : '⏩ Advance Fleet Trajectory'}
          </button>
          <button className="btn btn-outline-warning" onClick={handleSimulateOverspeed}>
            ⚡ Trigger Overspeed (74 km/h)
          </button>
          <button className="btn btn-outline-danger" onClick={handleSimulateLowBattery}>
            🪫 Trigger Critical Battery (8%)
          </button>
        </div>
      </div>

      <form onSubmit={handleManualSubmit} className="simulator-form">
        <div className="form-group">
          <label>Target Vehicle</label>
          <select
            value={selectedVehicleId}
            onChange={(e) => handleSelectVehicle(e.target.value)}
            className="form-control"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} — {v.model} ({v.status})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label>Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label>Speed (km/h)</label>
          <input
            type="number"
            min="0"
            max="160"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label>Battery (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={battery}
            onChange={(e) => setBattery(e.target.value)}
            className="form-control"
            required
          />
        </div>

        <div className="form-group form-submit">
          <button type="submit" className="btn btn-primary w-full">
            Transmit GPS Telemetry
          </button>
        </div>
      </form>
    </div>
  );
};
