import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary';
import { initTelemetry } from 'app/config/telemetry';

/**
 * A render crash must leave a usable page behind and reach Application Insights exactly once —
 * the boundary reports it with the component stack, and the logger must not report it again.
 */
const sdk = vi.hoisted(() => ({
  loadAppInsights: vi.fn(),
  addTelemetryInitializer: vi.fn(),
  trackException: vi.fn(),
}));

vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: class {
    loadAppInsights = sdk.loadAppInsights;
    addTelemetryInitializer = sdk.addTelemetryInitializer;
    trackException = sdk.trackException;
  },
}));

function Boom(): never {
  throw new Error('render blew up');
}

beforeEach(async () => {
  sdk.trackException.mockClear();
  // React prints the caught error itself; the noise is not the test's.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await initTelemetry('InstrumentationKey=00000000-0000-0000-0000-000000000000', 'eagle-public', [
    'epic.example.gov.bc.ca',
  ]);
});

afterEach(() => vi.restoreAllMocks());

describe('the error boundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>the app</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(sdk.trackException).not.toHaveBeenCalled();
  });

  it('shows a fallback with a way out when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('reports the crash once, with the component stack', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(sdk.trackException).toHaveBeenCalledTimes(1);
    expect(sdk.trackException).toHaveBeenCalledWith({
      exception: expect.objectContaining({ message: 'render blew up' }),
      properties: { componentStack: expect.stringContaining('Boom') },
    });
  });
});
