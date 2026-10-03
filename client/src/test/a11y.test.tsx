import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { installFakeApi } from './fakeApi';
import { axe } from './axe';

beforeEach(() => {
  installFakeApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('accessibility', () => {
  it('has no violations on the map view', async () => {
    const { container } = render(<App />);
    await screen.findByText('4 vehicles');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations on the table view', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('4 vehicles');
    await user.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in the new delivery dialog', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('4 vehicles');
    await user.click(screen.getByRole('button', { name: 'New delivery' }));
    expect(screen.getByRole('dialog', { name: 'New delivery' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
