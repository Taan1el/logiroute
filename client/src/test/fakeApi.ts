import { vi } from 'vitest';
import { createDemoBackend, type DemoBackend } from '../demo/demoBackend';

export const FIXED_NOW = new Date('2026-10-02T12:00:00Z');

/**
 * Stubs `fetch` with a router that answers the REST API from the in-memory demo
 * backend, so the client is tested through its real HTTP code path.
 */
export function installFakeApi(clock: () => Date = () => FIXED_NOW): { backend: DemoBackend; fetchMock: ReturnType<typeof vi.fn> } {
  const backend = createDemoBackend(clock);

  const fetchMock = vi.fn(async (input: string, init?: { method?: string; body?: string }) => {
    const url = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body) : {};
    const path = url.pathname.replace(/^\/api/, '');
    const respond = (data: unknown, ok = true) => ({
      ok,
      status: ok ? 200 : 400,
      json: async () => (ok ? { success: true, data } : { success: false, error: data }),
    });

    try {
      if (method === 'GET' && path === '/vehicles') return respond(await backend.getVehicles());
      if (method === 'GET' && path === '/geofences') return respond(await backend.getGeofences());
      if (method === 'GET' && path === '/deliveries') return respond(await backend.getDeliveries());
      if (method === 'GET' && path === '/alerts') return respond(await backend.getAlerts(Number(url.searchParams.get('limit') ?? 50)));
      if (method === 'GET' && path === '/metrics') return respond(await backend.getMetrics());
      if (method === 'POST' && path === '/deliveries') return respond(await backend.createDelivery(body));
      if (method === 'POST' && path === '/telemetry/ingest') return respond(await backend.ingestTelemetry(body));
      let match = path.match(/^\/vehicles\/([^/]+)\/status$/);
      if (method === 'PATCH' && match) return respond(await backend.updateVehicleStatus(match[1], body.status));
      match = path.match(/^\/deliveries\/([^/]+)\/status$/);
      if (method === 'PATCH' && match) return respond(await backend.updateDeliveryStatus(match[1], body.status));
      match = path.match(/^\/deliveries\/([^/]+)\/assign$/);
      if (method === 'POST' && match) return respond(await backend.assignVehicle(match[1], body.vehicle_id));
      return respond('Not found', false);
    } catch (err) {
      return respond(err instanceof Error ? err.message : 'error', false);
    }
  });

  vi.stubGlobal('fetch', fetchMock);
  return { backend, fetchMock };
}
