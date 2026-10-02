import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pause, Play } from 'lucide-react';
import { api } from './services';
import type {
  AlertEvent,
  CreateDeliveryDto,
  Delivery,
  DeliveryStatus,
  FleetMetrics,
  Geofence,
  IngestTelemetryDto,
  Vehicle,
} from '../../shared/types';
import { buildFleetRoutes, simulateStep } from '../../shared/route';
import { DELIVERY_STATUS_LABEL, formatTime, pluralize } from './utils/format';
import { DemoBar } from './components/DemoBar';
import { RouteMap } from './components/RouteMap';
import { RouteTable } from './components/RouteTable';
import { RouteTimeline } from './components/RouteTimeline';
import { VehicleList } from './components/VehicleList';
import { DeliveryList } from './components/DeliveryList';
import { AlertsList } from './components/AlertsList';
import { PingForm } from './components/PingForm';
import { NewDeliveryDialog } from './components/NewDeliveryDialog';
import { StatusBar } from './components/StatusBar';

export const POLL_INTERVAL_MS = 3500;
const TOAST_MS = 4000;

const EMPTY_METRICS: FleetMetrics = {
  total_vehicles: 0,
  active_en_route: 0,
  active_deliveries: 0,
  completed_24h: 0,
  alerts_24h: 0,
  avg_battery_percent: 0,
};

type MapView = 'map' | 'table';

const errorText = (err: unknown): string => (err instanceof Error ? err.message : 'Something went wrong');

export const App: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [metrics, setMetrics] = useState<FleetMetrics>(EMPTY_METRICS);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [view, setView] = useState<MapView>('map');
  const [enRouteOnly, setEnRouteOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [polling, setPolling] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const mapBody = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // On narrow screens the map is wider than its pane: start in the middle, where the routes are.
  useEffect(() => {
    const el = mapBody.current;
    if (el && view === 'map') el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [view]);

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
      setLoadError(false);
      setLastUpdated(formatTime(new Date().toISOString()));
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void loadData(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [polling, loadData]);

  const act = useCallback(
    async (work: () => Promise<string>) => {
      try {
        showToast(await work());
        await loadData();
      } catch (err) {
        showToast(errorText(err));
      }
    },
    [loadData, showToast],
  );

  const allRoutes = useMemo(() => buildFleetRoutes(vehicles, deliveries), [vehicles, deliveries]);
  const shownVehicles = useMemo(() => (enRouteOnly ? vehicles.filter((v) => v.status === 'en_route') : vehicles), [vehicles, enRouteOnly]);
  const shownRoutes = useMemo(
    () => allRoutes.filter((r) => shownVehicles.some((v) => v.id === r.vehicle_id)),
    [allRoutes, shownVehicles],
  );

  const activeVehicleId = selectedVehicleId ?? allRoutes[0]?.vehicle_id ?? vehicles[0]?.id ?? null;
  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId) ?? null;
  const activeRoute = allRoutes.find((r) => r.vehicle_id === activeVehicleId) ?? null;

  const toggleMaintenance = (vehicle: Vehicle) =>
    act(async () => {
      const next = vehicle.status === 'maintenance' ? 'idle' : 'maintenance';
      await api.updateVehicleStatus(vehicle.id, next);
      return `${vehicle.plate_number} set to ${next === 'idle' ? 'idle' : 'maintenance'}`;
    });

  const updateDelivery = (id: string, status: DeliveryStatus) =>
    act(async () => {
      await api.updateDeliveryStatus(id, status);
      return `Delivery marked ${DELIVERY_STATUS_LABEL[status].toLowerCase()}`;
    });

  const assignVehicle = (deliveryId: string, vehicleId: string) =>
    act(async () => {
      const delivery = await api.assignVehicle(deliveryId, vehicleId);
      return `${delivery.tracking_code} dispatched with ${delivery.vehicle_plate ?? 'a vehicle'}`;
    });

  const sendPing = (dto: IngestTelemetryDto) =>
    act(async () => {
      const result = await api.ingestTelemetry(dto);
      const count = result.triggeredAlerts.length;
      return count > 0 ? `Ping received, ${pluralize(count, 'alert')} raised` : 'Ping received, no alerts';
    });

  const advanceFleet = () =>
    act(async () => {
      const moving = vehicles.filter((v) => v.status === 'en_route');
      if (moving.length === 0) return 'No vehicle is en route';
      for (const vehicle of moving) {
        const route = allRoutes.find((r) => r.vehicle_id === vehicle.id);
        await api.ingestTelemetry({ vehicle_id: vehicle.id, ...simulateStep(vehicle, route?.stops ?? []) });
      }
      return `Moved ${pluralize(moving.length, 'vehicle')} one step`;
    });

  const createDelivery = async (dto: CreateDeliveryDto) => {
    const created = await api.createDelivery(dto);
    showToast(`${created.tracking_code} created`);
    await loadData();
  };

  return (
    <div className="app">
      <DemoBar onReset={() => void loadData()} />
      <header className="top">
        <div className="top-title">
          <h1>LogiRoute</h1>
          <p>Plan the stop order for each vehicle and follow every delivery across Tallinn.</p>
        </div>
        <div className="top-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setPolling((p) => !p)}>
            {polling ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
            {polling ? 'Pause updates' : 'Resume updates'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New delivery
          </button>
        </div>
      </header>

      <main className="stage">
        <section className="map-pane" aria-labelledby="map-heading">
          <div className="map-toolbar">
            <h2 id="map-heading">Routes</h2>
            <div className="map-tools">
              <span className="check-field">
                <input id="en-route-only" type="checkbox" checked={enRouteOnly} onChange={(e) => setEnRouteOnly(e.target.checked)} />
                <label htmlFor="en-route-only">En-route vehicles only</label>
              </span>
              <fieldset className="segmented">
                <legend className="sr-only">Route view</legend>
                <button type="button" className={view === 'map' ? 'seg seg-on' : 'seg'} aria-pressed={view === 'map'} onClick={() => setView('map')}>
                  Map
                </button>
                <button type="button" className={view === 'table' ? 'seg seg-on' : 'seg'} aria-pressed={view === 'table'} onClick={() => setView('table')}>
                  Table
                </button>
              </fieldset>
            </div>
          </div>
          <div
            className="map-body"
            ref={mapBody}
            {...(view === 'map' ? { tabIndex: 0, role: 'region', 'aria-label': 'Route map, scrolls sideways on narrow screens' } : {})}
          >
            {view === 'map' ? (
              <RouteMap
                vehicles={shownVehicles}
                geofences={geofences}
                deliveries={deliveries}
                routes={shownRoutes}
                selectedVehicleId={activeVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            ) : (
              <RouteTable routes={shownRoutes} pending={deliveries.filter((d) => d.status === 'pending')} />
            )}
          </div>
          <ul className="legend">
            <li className="legend-route">Planned route</li>
            <li className="legend-stop">Stop number is the visit order</li>
            <li className="legend-pending">Pending drop-off</li>
            <li className="legend-zone">Zone</li>
          </ul>
        </section>

        <aside className="side" aria-label="Dispatch details" tabIndex={0}>
          <section aria-labelledby="route-heading">
            <h2 id="route-heading">{activeVehicle ? `Route for ${activeVehicle.plate_number}` : 'Route'}</h2>
            <RouteTimeline vehicle={activeVehicle} route={activeRoute} />
          </section>

          <section aria-labelledby="vehicles-heading">
            <h2 id="vehicles-heading">Vehicles</h2>
            <VehicleList
              vehicles={vehicles}
              selectedVehicleId={activeVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              onToggleStatus={(v) => void toggleMaintenance(v)}
            />
          </section>

          <section aria-labelledby="deliveries-heading">
            <h2 id="deliveries-heading">Deliveries</h2>
            <DeliveryList
              deliveries={deliveries}
              vehicles={vehicles}
              onUpdateStatus={(id, status) => void updateDelivery(id, status)}
              onAssignVehicle={(d, v) => void assignVehicle(d, v)}
            />
          </section>

          <section aria-labelledby="alerts-heading">
            <h2 id="alerts-heading">Alerts</h2>
            <AlertsList alerts={alerts} />
          </section>

          <section aria-labelledby="ping-heading">
            <h2 id="ping-heading">Send a position ping</h2>
            <PingForm vehicles={vehicles} onSendPing={sendPing} onAdvanceFleet={advanceFleet} onNotice={showToast} />
          </section>
        </aside>
      </main>

      <StatusBar metrics={metrics} polling={polling} intervalSeconds={POLL_INTERVAL_MS / 1000} loadError={loadError} lastUpdated={lastUpdated} />
      <output className="toast">{toast}</output>
      {dialogOpen && <NewDeliveryDialog vehicles={vehicles} onClose={() => setDialogOpen(false)} onSubmit={createDelivery} />}
    </div>
  );
};
