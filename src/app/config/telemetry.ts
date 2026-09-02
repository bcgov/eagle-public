import type { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';

let appInsights: ApplicationInsights | null = null;
let lastReported: Error | null = null;

/** Query strings carry search terms, which are personal data. */
const QUERY_STRING = /\?.*$/;
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
    return true;
  });

  appInsights = instance;
}

/**
 * Report one error. A no-op until initTelemetry has run.
 *
 * The same Error object twice in a row counts once: the error boundary reports the crash itself
 * (it has the component stack) and then logs it, and the logger reports too.
 */
export function trackException(error: unknown, properties?: Record<string, string>): void {
  if (!appInsights || (error instanceof Error && error === lastReported)) {
    return;
  }
  const exception = error instanceof Error ? error : new Error(String(error));
  lastReported = exception;
  appInsights.trackException({ exception, properties });
}
