import { httpApi, type Backend } from './api';
import { createDemoBackend, type DemoBackend } from '../demo/demoBackend';

/** True in the GitHub Pages build (`vite --mode pages`): no server, sample data in memory. */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const demo: DemoBackend | null = isDemoMode ? createDemoBackend() : null;

export const api: Backend = demo ?? httpApi;

export function resetDemoData(): void {
  demo?.reset();
}
