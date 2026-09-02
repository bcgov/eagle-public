import type { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';

let appInsights: ApplicationInsights | null = null;
let lastReported: Error | null = null;

const MAX_BUFFERED = 20;
/** Errors reported before initTelemetry finishes. Flushed through trackException once the SDK is up. */
const buffered: { error: unknown; properties?: Record<string, string> }[] = [];

/** Query strings carry search terms, which are personal data. Global: strips every `?...` token, including inside multi-line stacks. */
const QUERY_STRING = /\?\S*/g;
const REDACTED_FIELDS = ['uri', 'target', 'name', 'message'];

/**
 * Send browser errors to Application Insights. No connection string means no telemetry, which is
 * how local dev and any environment that has not been given one stay silent.
 *
 * The SDK is imported dynamically so it lands in its own chunk, off the critical path.
 */
export async function initTelemetry(
  connectionString: string | undefined,
  role: string,
  correlationHosts: string[]
): Promise<void> {
  if (!connectionString || appInsights) {
    return;
  }

  const { ApplicationInsights } = await import('@microsoft/applicationinsights-web');
  const instance = new ApplicationInsights({
    config: {
      connectionString,
      enableCorsCorrelation: true,
      correlationHeaderDomains: correlationHosts,
      disableFetchTracking: false,
      // Off by default in the SDK, and rejections are half of what a React app throws.
      enableUnhandledPromiseRejectionTracking: true,
      enableAutoRouteTracking: false
    }
  });
  instance.loadAppInsights();

  instance.addTelemetryInitializer((item: ITelemetryItem) => {
    item.tags = item.tags || {};
    item.tags['ai.cloud.role'] = role;

    const data = item.baseData;
    if (!data) {
      return true;
    }
    // Successful requests are the cost driver and nobody reads them. Only failures are wanted.
    if (item.baseType === 'RemoteDependencyData' && data['success'] !== false) {
      return false;
    }
    for (const field of REDACTED_FIELDS) {
      const value: unknown = data[field];
      if (typeof value === 'string') {
        data[field] = value.replace(QUERY_STRING, '');
      }
    }
    const exceptions: unknown = data['exceptions'];
    if (Array.isArray(exceptions)) {
      for (const exception of exceptions as Record<string, unknown>[]) {
        for (const field of ['message', 'stack']) {
          const value: unknown = exception[field];
          if (typeof value === 'string') {
            exception[field] = value.replace(QUERY_STRING, '');
          }
        }
        const parsedStack: unknown = exception['parsedStack'];
        if (Array.isArray(parsedStack)) {
          for (const frame of parsedStack as Record<string, unknown>[]) {
            for (const field of ['fileName', 'assembly']) {
              const value: unknown = frame[field];
              if (typeof value === 'string') {
                frame[field] = value.replace(QUERY_STRING, '');
              }
            }
          }
        }
      }
    }
    return true;
  });

  appInsights = instance;

  const toFlush = buffered.splice(0, buffered.length);
  for (const item of toFlush) {
    trackException(item.error, item.properties);
  }
}

/**
 * Report one error. A no-op until initTelemetry has run.
 *
 * The same Error object twice in a row counts once: the error boundary reports the crash itself
 * (it has the component stack) and then logs it, and the logger reports too.
 */
export function trackException(error: unknown, properties?: Record<string, string>): void {
  if (!appInsights) {
    if (buffered.length < MAX_BUFFERED) {
      buffered.push({ error, properties });
    }
    return;
  }
  if (error instanceof Error && error === lastReported) {
    return;
  }
  const exception = error instanceof Error ? error : new Error(String(error));
  lastReported = exception;
  appInsights.trackException({ exception, properties });
}
