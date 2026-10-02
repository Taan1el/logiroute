import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock('../services');
});

describe('demo bar', () => {
  it('renders nothing outside the demo build', async () => {
    const { DemoBar } = await import('../components/DemoBar');
    const { container } = render(<DemoBar onReset={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the demo wording, resets the sample data and links to the source', async () => {
    const resetDemoData = vi.fn();
    vi.doMock('../services', () => ({ isDemoMode: true, resetDemoData }));
    const { DemoBar } = await import('../components/DemoBar');
    const onReset = vi.fn();
    render(<DemoBar onReset={onReset} />);
    expect(screen.getByText('Demo: everything runs in your browser with sample data.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset sample data' }));
    expect(resetDemoData).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute('href', 'https://github.com/Taan1el/logiroute');
  });
});
