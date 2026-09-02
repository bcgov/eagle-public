import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ITelemetryItem } from '@microsoft/applicationinsights-web';

/**
 * Application Insights bills per item and the app's URLs carry search terms, so the initializer is
 * the load-bearing part: it must drop successful dependency calls and strip every query string.
 */
const sdk = vi.hoisted(() => ({
  loadAppInsights: vi.fn(),
  addTelemetryInitializer: vi.fn(),
  trackException: vi.fn(),
  constructed: vi.fn()
}));

vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: class {
    loadAppInsights = sdk.loadAppInsights;
    addTelemetryInitializer = sdk.addTelemetryInitializer;
    trackException = sdk.trackException;
    constructor(options: unknown) {
      sdk.constructed(options);
    }
  }
}));

const CONNECTION_STRING = 'InstrumentationKey=00000000-0000-0000-0000-000000000000';

type Initializer = (item: ITelemetryItem) => boolean | void;

/** Fresh module graph per test — the SDK instance is module state. */
async function telemetry() {
  vi.resetModules();
  return import('./telemetry');
}

async function initialized(): Promise<Initializer> {
  const { initTelemetry } = await telemetry();
  await initTelemetry(CONNECTION_STRING, 'eagle-public', ['epic.example.gov.bc.ca']);
  return sdk.addTelemetryInitializer.mock.calls[0]?.[0] as Initializer;
}

function dependency(baseData: Record<string, unknown>): ITelemetryItem {
  return { name: 'dependency', baseType: 'RemoteDependencyData', baseData };
}

beforeEach(() => {
  sdk.loadAppInsights.mockClear();
  sdk.addTelemetryInitializer.mockClear();
  sdk.trackException.mockClear();
  sdk.constructed.mockClear();
});

describe('initTelemetry', () => {
  it('loads nothing without a connection string', async () => {
    const { initTelemetry } = await telemetry();
    await initTelemetry('', 'eagle-public', ['epic.example.gov.bc.ca']);
    await initTelemetry(undefined, 'eagle-public', ['epic.example.gov.bc.ca']);
    expect(sdk.constructed).not.toHaveBeenCalled();
    expect(sdk.loadAppInsights).not.toHaveBeenCalled();
  });

  it('loads the SDK once a connection string is configured', async () => {
    await initialized();
    expect(sdk.loadAppInsights).toHaveBeenCalledTimes(1);
    expect(sdk.constructed).toHaveBeenCalledWith({
      config: expect.objectContaining({
        connectionString: CONNECTION_STRING,
        correlationHeaderDomains: ['epic.example.gov.bc.ca'],
        enableAutoRouteTracking: false
      })
    });
  });
});

describe('the telemetry initializer', () => {
  it('drops a successful request and keeps a failed one', async () => {
    const initializer = await initialized();
    expect(initializer(dependency({ success: true, responseCode: 200 }))).toBe(false);
    expect(initializer(dependency({ success: false, responseCode: 500 }))).toBe(true);
  });

  it('keeps telemetry that is not a request', async () => {
    const initializer = await initialized();
    expect(initializer({ name: 'exception', baseType: 'ExceptionData', baseData: {} })).toBe(true);
  });

  it('strips query strings, which hold search terms', async () => {
    const initializer = await initialized();
    const item = dependency({
      success: false,
      uri: 'https://epic.example.gov.bc.ca/api/search?q=secret',
      target: 'epic.example.gov.bc.ca?q=secret',
      name: 'GET /api/search?q=secret',
      message: 'GET /api/search?q=secret failed'
    });

    initializer(item);

    expect(item.baseData).toEqual({
      success: false,
      uri: 'https://epic.example.gov.bc.ca/api/search',
      target: 'epic.example.gov.bc.ca',
      name: 'GET /api/search',
      message: 'GET /api/search failed'
    });
  });

  it('strips query strings from exception message and stack, everywhere they appear', async () => {
    const initializer = await initialized();
    const item: ITelemetryItem = {
      name: 'exception',
      baseType: 'ExceptionData',
      baseData: {
        exceptions: [
          {
            message: 'HTTP GET /api/projects?token=SECRET 401',
            stack:
              'Error: HTTP GET /api/projects?token=SECRET 401\n    at x (http://h/app.js?v=1:1:1)'
          }
        ]
      }
    };

    initializer(item);

    const baseData = item.baseData as { exceptions: [{ message: string; stack: string }] };
    const [exception] = baseData.exceptions;
    expect(exception.message).not.toContain('token=SECRET');
    expect(exception.stack).not.toContain('token=SECRET');
    expect(exception.stack).not.toContain('?v=1');
    expect(exception.message).toContain('/api/projects');
    expect(exception.message).toContain('401');
    expect(exception.stack).toContain('/api/projects');
    expect(exception.stack).toContain('401');
  });

  it('strips a query string token and keeps the rest of the message', async () => {
    const initializer = await initialized();
    const item = dependency({ message: 'HTTP GET /api/x?q=a 500 tail', success: false });

    initializer(item);

    expect((item.baseData as { message: string }).message).toBe('HTTP GET /api/x 500 tail');
  });

  it('stamps the cloud role', async () => {
    const initializer = await initialized();
    const item: ITelemetryItem = { name: 'exception', baseType: 'ExceptionData', baseData: {} };
    initializer(item);
    expect(item.tags?.['ai.cloud.role']).toBe('eagle-public');
  });
});

describe('trackException', () => {
  it('does nothing before initialization', async () => {
    const { trackException } = await telemetry();
    trackException(new Error('boom'));
    expect(sdk.trackException).not.toHaveBeenCalled();
  });

  it('reports an error with its properties', async () => {
    await initialized();
    const { trackException } = await import('./telemetry');
    const error = new Error('boom');

    trackException(error, { source: 'test' });

    expect(sdk.trackException).toHaveBeenCalledWith({ exception: error, properties: { source: 'test' } });
  });

  it('wraps a value that is not an Error', async () => {
    await initialized();
    const { trackException } = await import('./telemetry');

    trackException('just a string');

    expect(sdk.trackException).toHaveBeenCalledWith({
      exception: expect.objectContaining({ message: 'just a string' }),
      properties: undefined
    });
  });

  it('reports the same error object only once', async () => {
    await initialized();
    const { trackException } = await import('./telemetry');
    const error = new Error('boom');

    trackException(error, { componentStack: 'x' });
    trackException(error, { source: 'logger' });

    expect(sdk.trackException).toHaveBeenCalledTimes(1);
  });

  it('flushes errors reported before initialization once the SDK is up', async () => {
    const { trackException, initTelemetry } = await telemetry();

    trackException(new Error('early'));
    expect(sdk.trackException).not.toHaveBeenCalled();

    await initTelemetry(CONNECTION_STRING, 'eagle-public', ['epic.example.gov.bc.ca']);

    expect(sdk.trackException).toHaveBeenCalledTimes(1);
    expect(sdk.trackException).toHaveBeenCalledWith(
      expect.objectContaining({ exception: expect.objectContaining({ message: 'early' }) })
    );
  });

  it('drops buffered errors beyond the cap', async () => {
    const { trackException, initTelemetry } = await telemetry();

    for (let i = 0; i < 21; i++) {
      trackException(new Error(`early-${i}`));
    }

    await initTelemetry(CONNECTION_STRING, 'eagle-public', ['epic.example.gov.bc.ca']);

    expect(sdk.trackException).toHaveBeenCalledTimes(20);
  });
});
