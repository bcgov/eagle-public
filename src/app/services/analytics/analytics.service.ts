import { Injectable, inject } from '@angular/core';
import Analytics from 'analytics';
import type { AnalyticsInstance, AnalyticsPlugin } from 'analytics';
import { originalSourcePlugin } from '@analytics/original-source-plugin';
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
    const enhancedTracking = config.ANALYTICS_ENHANCED_TRACKING ?? false;
    const trafficTracking = config.ANALYTICS_TRAFFIC_TRACKING ?? false;

    const plugins: AnalyticsPlugin[] = [];

    // Add traffic source plugin first (if enabled) - stores source in localStorage
    if (trafficTracking) {
      plugins.push(originalSourcePlugin());
    }

    // Add penguin analytics plugin - sends events to backend
    const plugin = penguinAnalyticsPlugin({ 
      apiUrl, 
      sourceApp: 'eagle-public', 
      debug,
      enhancedTracking 
    });
    plugins.push(plugin);
    
    this.plugin = plugin as unknown as PluginWithStartTracking;
    this.analytics = Analytics({ app: 'eagle-public', debug, plugins });
    this.initialized = true;
    
    console.log('Analytics initialized with API URL:', apiUrl);
    if (debug) {
      console.log('Enhanced tracking (browser context):', enhancedTracking ? 'enabled' : 'disabled');
      console.log('Traffic source tracking:', trafficTracking ? 'enabled' : 'disabled');
    }
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
