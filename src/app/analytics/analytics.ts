import Analytics from 'analytics';
import type { AnalyticsInstance, AnalyticsPlugin } from 'analytics';
import { originalSourcePlugin } from '@analytics/original-source-plugin';
import { penguinAnalyticsPlugin } from './penguin-analytics-plugin';
import type { EnvConfig } from '../config/config';
import { logger } from '../config/logging';

interface PluginWithStartTracking {
  startTracking?: () => void;
}

/**
 * Anonymous tracking (no PII).
 * Auto-tracks: page views, link clicks, button clicks, user activity.
 */
let analytics: AnalyticsInstance | null = null;
let initialized = false;

/** Initialize analytics. Skips silently if ANALYTICS_API_URL is empty. */
export function initAnalytics(config: EnvConfig): void {
  if (initialized) return;

  const apiUrl = config.ANALYTICS_API_URL || '';

  if (!apiUrl) {
    initialized = true;
    return;
  }

  const debug = config.ANALYTICS_DEBUG ?? config.ENVIRONMENT !== 'prod';
  const enhancedTracking = config.ANALYTICS_ENHANCED_TRACKING ?? false;
  const trafficTracking = config.ANALYTICS_TRAFFIC_TRACKING ?? false;

  const plugins: AnalyticsPlugin[] = [];

  // Traffic source plugin first (if enabled) - stores source in localStorage
  if (trafficTracking) {
    plugins.push(originalSourcePlugin());
  }

  // Penguin analytics plugin - sends events to backend
  const plugin = penguinAnalyticsPlugin({
    apiUrl,
    sourceApp: 'eagle-public',
    debug,
    enhancedTracking,
  });
  plugins.push(plugin);

  analytics = Analytics({ app: 'eagle-public', debug, plugins });
  initialized = true;

  if (debug) {
    logger.debug('Analytics initialized', 'analytics', {
      apiUrl,
      enhancedTracking,
      trafficTracking,
    });
  }

  (plugin as unknown as PluginWithStartTracking).startTracking?.();
}

export function page(name?: string, properties?: Record<string, unknown>): void {
  analytics?.page({ name, ...properties });
}

export function track(event: string, properties?: Record<string, unknown>): void {
  analytics?.track(event, properties);
}

export function reset(): void {
  analytics?.reset();
}
