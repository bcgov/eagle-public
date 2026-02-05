import { Injectable, inject } from '@angular/core';
import Analytics from 'analytics';
import type { AnalyticsInstance } from 'analytics';
import { penguinAnalyticsPlugin } from './penguin-analytics-plugin';
import { ConfigService } from '../config.service';

interface PluginWithStartTracking {
  startTracking?: () => void;
}

/**
 * Analytics service for anonymous tracking (no PII).
 * Auto-tracks: page views, link clicks, button clicks, user activity.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private configService = inject(ConfigService);
  private analytics: AnalyticsInstance | null = null;
  private plugin: PluginWithStartTracking | null = null;
  private initialized = false;

  /**
   * Initialize analytics with configuration from ConfigService.
   * Called after ConfigService.init() completes.
   */
  initialize(): void {
    if (this.initialized) return;

    const config = this.configService.config();
    const apiUrl = config.ANALYTICS_API_URL;
    
    // Skip analytics if no API URL configured
    if (!apiUrl) {
      console.log('Analytics disabled: ANALYTICS_API_URL not configured');
      this.initialized = true;
      return;
    }

    const debug = config.ANALYTICS_DEBUG ?? (config.ENVIRONMENT !== 'prod');

    const plugin = penguinAnalyticsPlugin({ apiUrl, sourceApp: 'eagle-public', debug });
    this.plugin = plugin as unknown as PluginWithStartTracking;
    this.analytics = Analytics({ app: 'eagle-public', debug, plugins: [plugin] });
    this.initialized = true;
    
    console.log('Analytics initialized with API URL:', apiUrl);
  }

  startTracking(): void {
    if (!this.initialized) {
      console.warn('Analytics not initialized, call initialize() first');
      return;
    }
    this.plugin?.startTracking?.();
  }

  page(name?: string, properties?: Record<string, unknown>): void {
    this.analytics?.page({ name, ...properties });
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.analytics?.track(event, properties);
  }

  reset(): void {
    this.analytics?.reset();
  }
}
