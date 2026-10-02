import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { installFakeApi } from './fakeApi';

type Fake = ReturnType<typeof installFakeApi>;
let fake: Fake;

const route = (plate: string) => screen.getByRole('region', { name: `Route for ${plate}` });
const section = (name: string) => screen.getByRole('region', { name });
const ready = () => screen.findByText('4 vehicles');

beforeEach(() => {
  fake = installFakeApi();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('dispatch console', () => {
  it('shows the wordmark and the fleet counts in the status bar', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'LogiRoute' })).toBeInTheDocument();
    await ready();
    expect(screen.getByText('2 en route')).toBeInTheDocument();
    expect(screen.getByText('5 active deliveries')).toBeInTheDocument();
    expect(screen.getByText('1 completed in 24 h')).toBeInTheDocument();
    expect(screen.getByText('2 alerts in 24 h')).toBeInTheDocument();
  });

  it('lists the stops of the first route in nearest-first order', async () => {
    render(<App />);
    await ready();
    const items = within(route('TLN-801')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('TLN-801 now'),
      expect.stringContaining('Rotermanni 8'),
      expect.stringContaining('Telliskivi 60a'),
      expect.stringContaining('Endla 45'),
    ]);
    expect(route('TLN-801')).toHaveTextContent('heuristic');
  });

  it('switches the route when another vehicle is selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(within(section('Vehicles')).getByRole('button', { name: /TLN-802/ }));
    expect(route('TLN-802')).toHaveTextContent('Sadama 25');
    await user.click(within(section('Vehicles')).getByRole('button', { name: /TLN-803/ }));
    expect(route('TLN-803')).toHaveTextContent('no route to plan');
  });

  it('describes the map in text and offers the same data as a table', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    const map = screen.getByRole('img', { name: 'Route map of central Tallinn' });
    expect(map).toHaveAccessibleDescription(expect.stringContaining('TLN-801: 3 stops'));
    await user.click(screen.getByRole('button', { name: 'Table' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByText('LR-TLN-481204')).toBeInTheDocument();
  });

  it('limits the map to en-route vehicles on request', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    const map = () => screen.getByRole('img', { name: 'Route map of central Tallinn' });
    expect(map()).toHaveTextContent('TLN-803');
    await user.click(screen.getByLabelText('En-route vehicles only'));
    expect(map()).not.toHaveTextContent('TLN-803');
    expect(map()).toHaveTextContent('TLN-801');
  });

  it('moves a delivery to the next status through the API', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(within(section('Deliveries')).getAllByRole('button', { name: 'Start trip' })[0]);
    expect(await screen.findByText('Delivery marked in transit')).toBeInTheDocument();
    const patch = fake.fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/status') && init?.method === 'PATCH');
    expect(JSON.parse(patch![1].body)).toEqual({ status: 'in_transit' });
  });

  it('assigns an idle vehicle to a pending delivery', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    const [assign] = within(section('Deliveries')).getAllByLabelText('Assign vehicle');
    await user.selectOptions(assign, within(assign).getByRole('option', { name: /TLN-803/ }));
    await user.click(within(section('Deliveries')).getAllByRole('button', { name: 'Dispatch' })[0]);
    expect(await screen.findByText(/dispatched with TLN-803/)).toBeInTheDocument();
    expect(await screen.findByText('3 en route')).toBeInTheDocument();
  });

  it('shows the API message when a vehicle with active deliveries is set to maintenance', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    const rows = within(section('Vehicles')).getAllByRole('button', { name: 'Set maintenance' });
    await user.click(rows[0]);
    expect(await screen.findByText(/has active deliveries and must stay en route/)).toBeInTheDocument();
    await user.click(rows[2]);
    expect(await screen.findByText('TLN-803 set to maintenance')).toBeInTheDocument();
  });

  it('raises an overspeed alert from a ping', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(screen.getByRole('button', { name: /Send overspeed ping/ }));
    expect(await screen.findByText('Ping received, 1 alert raised')).toBeInTheDocument();
    expect(await within(section('Alerts')).findByText('Overspeed')).toBeInTheDocument();
  });

  it('sends the ping form values for the chosen vehicle', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await waitFor(() => expect(screen.getByLabelText('Latitude')).toHaveValue(59.435));
    await user.clear(screen.getByLabelText('Speed (km/h)'));
    await user.type(screen.getByLabelText('Speed (km/h)'), '20');
    await user.click(screen.getByRole('button', { name: 'Send ping' }));
    expect(await screen.findByText('Ping received, no alerts')).toBeInTheDocument();
    const ping = fake.fetchMock.mock.calls.find(([url]) => String(url).endsWith('/telemetry/ingest'));
    expect(JSON.parse(ping![1].body)).toMatchObject({ vehicle_id: 'veh-801', speed_kmh: 20, battery_percent: 88 });
  });

  it('moves every en-route vehicle one step toward its first stop', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Move en-route vehicles one step' }));
    expect(await screen.findByText('Moved 2 vehicles one step')).toBeInTheDocument();
    const [vehicle] = await fake.backend.getVehicles();
    expect(vehicle.battery_percent).toBe(87);
    expect(vehicle.current_lng).toBeCloseTo(24.748 + (24.757 - 24.748) * 0.2, 5);
  });
});

describe('new delivery dialog', () => {
  it('creates a delivery and lists it as pending', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'New delivery' }));
    const dialog = screen.getByRole('dialog', { name: 'New delivery' });
    expect(within(dialog).getByLabelText('Destination address')).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Create delivery' }));
    expect(await screen.findByText('LR-TLN-481210 created')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(section('Deliveries')).getAllByText('LR-TLN-481210')).toHaveLength(1);
  });

  it('keeps the dialog open and shows the validation message', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'New delivery' }));
    const dialog = screen.getByRole('dialog');
    const lat = within(dialog).getByLabelText('Drop-off latitude');
    await user.clear(lat);
    await user.type(lat, '95');
    await user.click(within(dialog).getByRole('button', { name: 'Create delivery' }));
    expect(await within(dialog).findByText(/dropoff_lat must be a finite number/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fills the form from a known address and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'New delivery' }));
    await user.click(screen.getByRole('button', { name: 'Endla 45' }));
    expect(screen.getByLabelText('Destination address')).toHaveValue('Endla 45, Tallinn');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New delivery' })).toHaveFocus();
  });
});

describe('refresh loop', () => {
  const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

  it('reloads every 3.5 seconds until paused', async () => {
    vi.useFakeTimers();
    render(<App />);
    await flush();
    const afterLoad = fake.fetchMock.mock.calls.length;
    expect(afterLoad).toBe(5);

    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(fake.fetchMock.mock.calls.length).toBe(afterLoad + 5);

    fireEvent.click(screen.getByRole('button', { name: 'Pause updates' }));
    const paused = fake.fetchMock.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(fake.fetchMock.mock.calls.length).toBe(paused);
    expect(screen.getByText('Updates paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume updates' })).toBeInTheDocument();
  });

  it('clears the notice after four seconds', async () => {
    vi.useFakeTimers();
    render(<App />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /Send overspeed ping/ }));
    await flush();
    expect(screen.getByText('Ping received, 1 alert raised')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.queryByText('Ping received, 1 alert raised')).not.toBeInTheDocument();
  });

  it('says so when the API cannot be reached', async () => {
    fake.fetchMock.mockRejectedValue(new Error('offline'));
    render(<App />);
    expect(await screen.findByText('Cannot reach the API')).toBeInTheDocument();
  });
});
