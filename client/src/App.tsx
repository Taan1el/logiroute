import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import {
  Vehicle,
  Geofence,
  Delivery,
  AlertEvent,
  FleetMetrics,
  DeliveryStatus,
  CreateDeliveryDto,
  IngestTelemetryDto,
} from '../../shared/types';
import { MetricsOverview } from './components/MetricsOverview';
import { LogisticsMap } from './components/LogisticsMap';
import { VehicleList } from './components/VehicleList';
import { DeliveryList } from './components/DeliveryList';
import { AlertsFeed } from './components/AlertsFeed';
import { TelemetrySimulator } from './components/TelemetrySimulator';
import { CreateDeliveryModal } from './components/CreateDeliveryModal';
import './App.css';

export const App: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [metrics, setMetrics] = useState<FleetMetrics>({
    total_vehicles: 0,
    active_en_route: 0,
    active_deliveries: 0,
    completed_today: 0,
    open_alerts: 0,
    avg_battery_percent: 0,
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const [vList, gList, dList, aList, mData] = await Promise.all([
        api.getVehicles(),
        api.getGeofences(),
        api.getDeliveries(),
        api.getAlerts(30),
        api.getMetrics(),
      ]);

      setVehicles(vList);
      setGeofences(gList);
      setDeliveries(dList);
      setAlerts(aList);
      setMetrics(mData);
    } catch (err: any) {
      console.error('Failed to poll fleet state:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling loop
  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(loadData, 3500);
    return () => clearInterval(interval);
  }, [autoPoll, loadData]);

  const handleToggleVehicleStatus = async (vehicle: Vehicle) => {
    try {
      const nextStatus = vehicle.status === 'maintenance' ? 'idle' : 'maintenance';
      await api.updateVehicleStatus(vehicle.id, nextStatus);
      showToast(`Vehicle ${vehicle.plate_number} status changed to ${nextStatus}`);
      await loadData();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleUpdateDeliveryStatus = async (id: string, status: DeliveryStatus) => {
    try {
      await api.updateDeliveryStatus(id, status);
      showToast(`Delivery status updated to ${status}`);
      await loadData();
    } catch (err: any) {
      alert(`Error updating delivery: ${err.message}`);
    }
  };

  const handleAssignVehicle = async (deliveryId: string, vehicleId: string) => {
    try {
      await api.assignVehicle(deliveryId, vehicleId);
      showToast('Vehicle assigned and delivery dispatched');
      await loadData();
    } catch (err: any) {
      alert(`Error assigning vehicle: ${err.message}`);
    }
  };

  const handleIngestTelemetry = async (dto: IngestTelemetryDto) => {
    try {
      const res = await api.ingestTelemetry(dto);
      if (res.triggeredAlerts && res.triggeredAlerts.length > 0) {
        showToast(`Telemetry ingested: ${res.triggeredAlerts.length} rule alert(s) triggered!`);
      } else {
        showToast('Telemetry ingested successfully');
      }
      await loadData();
    } catch (err: any) {
      alert(`Telemetry ingestion failed: ${err.message}`);
    }
  };

  const handleBatchSimulateStep = async () => {
    const enRouteVehicles = vehicles.filter((v) => v.status === 'en_route');
    if (enRouteVehicles.length === 0) {
      showToast('No active en-route vehicles to advance');
      return;
    }

    for (const v of enRouteVehicles) {
      // Find assigned delivery destination if any
      const delivery = deliveries.find(
        (d) => d.vehicle_id === v.id && (d.status === 'in_transit' || d.status === 'dispatched')
      );

      let targetLat = v.current_lat;
      let targetLng = v.current_lng;

      if (delivery) {
        // Move 15% closer to destination dropoff
        targetLat = v.current_lat + (delivery.dropoff_lat - v.current_lat) * 0.2;
        targetLng = v.current_lng + (delivery.dropoff_lng - v.current_lng) * 0.2;
      } else {
        // Jitter movement
        targetLat += (Math.random() - 0.5) * 0.003;
        targetLng += (Math.random() - 0.5) * 0.003;
      }

      await api.ingestTelemetry({
        vehicle_id: v.id,
        lat: targetLat,
        lng: targetLng,
        speed_kmh: Math.floor(25 + Math.random() * 20),
        battery_percent: Math.max(5, v.battery_percent - 1),
      });
    }

    showToast(`Simulated transit step for ${enRouteVehicles.length} vehicles`);
    await loadData();
  };

  const handleCreateDelivery = async (dto: CreateDeliveryDto) => {
    await api.createDelivery(dto);
    showToast('New delivery order created and scheduled');
    await loadData();
  };

  return (
    <div className="app-container">
      {/* Top Banner */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">LR</div>
          <div>
            <h1>LogiRoute</h1>
            <p className="header-subtitle">
              Fleet Logistics, Real-time Geofence Alerts & Telemetry Engine • Tallinn Corridor
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="live-status">
            <span className={`status-indicator ${autoPoll ? 'live' : 'paused'}`} />
            <span>{autoPoll ? 'Telemetry Live (3.5s)' : 'Polling Paused'}</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setAutoPoll(!autoPoll)}
          >
            {autoPoll ? 'Pause Live Sync' : 'Resume Live Sync'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Create Delivery
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && <div className="toast-notification">{notification}</div>}

      <main className="dashboard-content">
        {/* Fleet KPI Metrics Cards */}
        <MetricsOverview metrics={metrics} />

        {/* Radar Map & Alerts Section */}
        <div className="map-alerts-grid">
          <div className="map-column">
            <LogisticsMap
              vehicles={vehicles}
              geofences={geofences}
              deliveries={deliveries}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
            />
          </div>
          <div className="alerts-column">
            <AlertsFeed alerts={alerts} />
          </div>
        </div>

        {/* Telemetry Simulator Controls */}
        <TelemetrySimulator
          vehicles={vehicles}
          onIngestTelemetry={handleIngestTelemetry}
          onBatchSimulateStep={handleBatchSimulateStep}
        />

        {/* Deliveries & Vehicles Management */}
        <div className="tables-grid">
          <VehicleList
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            onToggleStatus={handleToggleVehicleStatus}
          />
          <DeliveryList
            deliveries={deliveries}
            vehicles={vehicles}
            onUpdateStatus={handleUpdateDeliveryStatus}
            onAssignVehicle={handleAssignVehicle}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        </div>
      </main>

      {/* Dispatch Modal */}
      <CreateDeliveryModal
        isOpen={isCreateModalOpen}
        vehicles={vehicles}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateDelivery}
      />
    </div>
  );
};
