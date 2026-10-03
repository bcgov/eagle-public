import {
  createAnalytics,
  type Analytics as EagleAnalyticsClient,
} from '@digitalspace/eagle-analytics-client';
import type { EnvConfig } from '../config/config';
import { logger } from '../config/logging';

/**
 * Anonymous tracking (no PII) through @digitalspace/eagle-analytics-client.
 * Under enhanced tracking the client also captures link and button clicks, an activity heartbeat,
 * and session start and end.
 *
 * EAGLE_ANALYTICS_URL is the ingest base. Empty or unset gives the client its own no-op instance,
 * so there is no switch here and every call site stays live.
 */
let eagle: EagleAnalyticsClient | null = null;
let initialized = false;

export function initAnalytics(config: EnvConfig): void {
  if (initialized) return;
  initialized = true;

  const apiUrl = config.EAGLE_ANALYTICS_URL || '';
  const debug = config.ANALYTICS_DEBUG ?? config.ENVIRONMENT !== 'prod';
  const enhancedTracking = config.ANALYTICS_ENHANCED_TRACKING ?? false;
  const trafficTracking = config.ANALYTICS_TRAFFIC_TRACKING ?? false;

  eagle = createAnalytics({
    apiUrl,
    sourceApp: 'eagle-public',
    debug,
    enhancedTracking,
    trafficTracking,
  });

  // Deployed configs ship LOG_LEVEL 0, so the level gate alone would print this in production.
  if (debug && import.meta.env.DEV) {
    logger.debug('Analytics initialized', 'analytics', {
      apiUrl,
      enhancedTracking,
      trafficTracking,
    });
  }
}

// The client never auto-captures page views, not even under enhancedTracking, so the route-change
// call in app-shell is its only source and cannot double-count.
export function page(name?: string, properties?: Record<string, unknown>): void {
  eagle?.page(name, properties);
}

export function track(event: string, properties?: Record<string, unknown>): void {
  eagle?.track(event, properties);
}

export function reset(): void {
  eagle?.reset();
}
