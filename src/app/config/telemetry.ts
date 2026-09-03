import type { ApplicationInsights, ITelemetryItem } from '@microsoft/applicationinsights-web';

let appInsights: ApplicationInsights | null = null;
let lastReported: Error | null = null;

const MAX_BUFFERED = 20;
/** Errors reported before initTelemetry finishes. Flushed through trackException once the SDK is up. */
const buffered: { error: unknown; properties?: Record<string, string> }[] = [];

/**
 * Query strings carry search terms, which are personal data. Global: strips every `?key=value...`
 * token, including chained `&key=value` and multi-line stacks, without eating prose
 * ("Unexpected token '?'") that a bare `?\S*` would swallow. Value chars are unbounded except
 * whitespace/`)#'"`, so a stack frame with a query loses its trailing `:line:col)`; hashed
 * production bundles carry no query and keep line/col in their own `parsedStack` fields.
 */
const QUERY_STRING = /\?[\w%.~-]+=[^\s)#'"]*/g;
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
  correlationHosts: string[],
): Promise<void> {
  if (!connectionString || appInsights) {
    return;
  }

  let instance: ApplicationInsights;
  try {
    const { ApplicationInsights } = await import('@microsoft/applicationinsights-web');
    instance = new ApplicationInsights({
      config: {
        connectionString,
        enableCorsCorrelation: true,
        correlationHeaderDomains: correlationHosts,
        disableFetchTracking: false,
        // Off by default in the SDK, and rejections are half of what a React app throws.
        enableUnhandledPromiseRejectionTracking: true,
        enableAutoRouteTracking: false,
        // Skip the remote config-sync fetch on every load; nothing here needs it.
        extensionConfig: { AppInsightsCfgSyncPlugin: { cfgUrl: '', blkCdnCfg: true } },
      },
    });
    instance.loadAppInsights();
  } catch {
    // Stale hashed chunk after a redeploy, or the SDK itself throwing. Telemetry stays off;
    // the app must not fail to start over it. Buffered errors stay buffered, capped at MAX_BUFFERED.
    return;
  }

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
