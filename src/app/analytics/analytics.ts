import Analytics from 'analytics';
import type { AnalyticsInstance, AnalyticsPlugin } from 'analytics';
import { originalSourcePlugin } from '@analytics/original-source-plugin';
import {
  createAnalytics,
  type Analytics as EagleAnalyticsClient,
} from '@digitalspace/eagle-analytics-client';
import { penguinAnalyticsPlugin } from './penguin-analytics-plugin';
import type { EnvConfig } from '../config/config';
import { logger } from '../config/logging';

interface PluginWithStartTracking {
  startTracking?: () => void;
}

/**
 * Anonymous tracking (no PII).
 * Auto-tracks: page views, link clicks, button clicks, user activity.
 *
 * Two backends run side by side while eagle-analytics takes over from penguin: ANALYTICS_API_URL
 * drives the penguin plugin, EAGLE_ANALYTICS_URL drives the eagle-analytics client, and each is
 * off when its URL is empty.
 */
let analytics: AnalyticsInstance | null = null;
let eagle: EagleAnalyticsClient | null = null;
let initialized = false;

/** Initialize both analytics backends. Each skips silently when its URL is empty. */
export function initAnalytics(config: EnvConfig): void {
  if (initialized) return;
  initialized = true;

  const debug = config.ANALYTICS_DEBUG ?? config.ENVIRONMENT !== 'prod';
  const enhancedTracking = config.ANALYTICS_ENHANCED_TRACKING ?? false;
  const trafficTracking = config.ANALYTICS_TRAFFIC_TRACKING ?? false;

  // An empty apiUrl gets the client's own no-op instance, so no switch is needed here.
  eagle = createAnalytics({
    apiUrl: config.EAGLE_ANALYTICS_URL || '',
    sourceApp: 'eagle-public',
    debug,
    enhancedTracking,
    trafficTracking,
  });

  const apiUrl = config.ANALYTICS_API_URL || '';
  if (!apiUrl) return;

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

  // Deployed configs ship LOG_LEVEL 0, so the level gate alone would print this in production.
  if (debug && import.meta.env.DEV) {
    logger.debug('Analytics initialized', 'analytics', {
      apiUrl,
      enhancedTracking,
      trafficTracking,
    });
  }

  (plugin as unknown as PluginWithStartTracking).startTracking?.();
}

// The eagle-analytics client never auto-captures page views, not even under enhancedTracking, so
// the route-change call in app-shell is its only source and cannot double-count.
export function page(name?: string, properties?: Record<string, unknown>): void {
  analytics?.page({ name, ...properties });
  eagle?.page(name, properties);
}

export function track(event: string, properties?: Record<string, unknown>): void {
  analytics?.track(event, properties);
  eagle?.track(event, properties);
}

export function reset(): void {
  analytics?.reset();
  eagle?.reset();
}
