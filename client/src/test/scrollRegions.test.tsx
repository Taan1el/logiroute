import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { installFakeApi } from './fakeApi';

beforeEach(() => {
  installFakeApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function expectKeyboardRegions(container: HTMLElement, selector: string, minimum: number) {
  const found = container.querySelectorAll(selector);
  expect(found.length).toBeGreaterThanOrEqual(minimum);
  found.forEach((el) => {
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect((el.getAttribute('aria-label') ?? '').trim()).not.toBe('');
  });
}

describe('scrollable regions', () => {
  it('makes the map scroller reachable by keyboard on the map view', async () => {
    const { container } = render(<App />);
    await screen.findByText('4 vehicles');
    expectKeyboardRegions(container, '.map-body', 1);
  });

  it('makes the table scroller reachable by keyboard on the table view', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('4 vehicles');
    await user.click(screen.getByRole('button', { name: 'Table' }));
    expectKeyboardRegions(container, '.table-scroll', 1);
  });

  it('keeps the dispatch column focusable and named', async () => {
    const { container } = render(<App />);
    await screen.findByText('4 vehicles');
    const side = container.querySelector('.side');
    expect(side?.getAttribute('tabindex')).toBe('0');
    expect((side?.getAttribute('aria-label') ?? '').trim()).not.toBe('');
  });

  it('keeps the new delivery dialog named', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('4 vehicles');
    await user.click(screen.getByRole('button', { name: 'New delivery' }));
    expect(screen.getByRole('dialog', { name: 'New delivery' })).toBeInTheDocument();
  });
});
