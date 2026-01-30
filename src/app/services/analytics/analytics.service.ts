import { Injectable } from '@angular/core';
import Analytics from 'analytics';
import type { AnalyticsInstance } from 'analytics';
import { penguinAnalyticsPlugin } from './penguin-analytics-plugin';

interface PluginWithStartTracking {
  startTracking?: () => void;
}

/**
 * Analytics service for anonymous tracking (no PII).
 * Auto-tracks: page views, link clicks, button clicks, user activity.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private analytics: AnalyticsInstance;
  private plugin: PluginWithStartTracking | null = null;

  constructor() {
    const apiUrl = window.localStorage.getItem('from_public_server--analytics_api_url') || '/api/analytics';
    const debug = window.localStorage.getItem('from_public_server--deployment_env') === 'local';

    const plugin = penguinAnalyticsPlugin({ apiUrl, sourceApp: 'eagle-public', debug });
    this.plugin = plugin as unknown as PluginWithStartTracking;
    this.analytics = Analytics({ app: 'eagle-public', debug, plugins: [plugin] });
  }

  startTracking(): void {
    this.plugin?.startTracking?.();
  }

  page(name?: string, properties?: Record<string, unknown>): void {
    this.analytics.page({ name, ...properties });
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.analytics.track(event, properties);
  }

  reset(): void {
    this.analytics.reset();
  }
}
