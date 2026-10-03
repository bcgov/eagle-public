import { Injectable, OnDestroy, inject } from '@angular/core';
import { createAnalytics, type Analytics as EagleAnalytics } from '@digitalspace/eagle-analytics-client';
import { ConfigService } from '../config.service';
import { LoggingService } from '../logging.service';

/**
 * Analytics service backed by the eagle-analytics client.
 *
 * This is the public app, so it stays anonymous: it never calls the client's `identify()` and has no
 * user id to attach. The client's session id is a random UUID in `sessionStorage`, so it is per tab
 * and gone when the tab closes — no cookie, no `localStorage`, nothing to consent to.
 *
 * ## Auto-tracked events (no code needed)
 * Page view context, link clicks, button clicks, session start and end, activity heartbeat.
 *
 * ## Manual tracking
 * Use "Object + Past Verb" names: `track('Document Downloaded', { document_id })`.
 *
 * `trafficTracking` is off, matching eagle-admin: nobody has asked for campaign attribution, and it
 * would add utm and referrer fields plus a second `sessionStorage` key.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService implements OnDestroy {
  private configService = inject(ConfigService);
  private logger = inject(LoggingService);
  private eagleAnalytics: EagleAnalytics | null = null;
  private initialized = false;

  /**
   * Build the client from ConfigService. Called from the app initializer once
   * `ConfigService.init()` has resolved, so `/api/config` values are already merged in.
   */
  initialize(): void {
    if (this.initialized) return;

    const config = this.configService.config();
    const debug = config.ENVIRONMENT === 'local';
    const apiUrl = config.EAGLE_ANALYTICS_URL || '';

    // An empty apiUrl yields a no-op instance, so an unset EAGLE_ANALYTICS_URL leaves the client
    // off and no environment needs a second switch to keep tracking down.
    this.eagleAnalytics = createAnalytics({
      apiUrl,
      sourceApp: 'eagle-public',
      debug,
      enhancedTracking: true,
      trafficTracking: false
    });
    this.initialized = true;

    this.logger.info(
      apiUrl
        ? `Analytics initialized with API URL: ${apiUrl}`
        : 'Analytics disabled: no EAGLE_ANALYTICS_URL configured',
      'AnalyticsService'
    );
  }

  /** Track a page view. */
  page(name?: string, properties?: Record<string, unknown>): void {
    this.eagleAnalytics?.page(name, properties);
  }

  /** Track a custom event. Use "Object + Past Verb" naming. */
  track(event: string, properties?: Record<string, unknown>): void {
    this.eagleAnalytics?.track(event, properties);
  }

  /** End the session and start a fresh session id. No user id here to forget. */
  reset(): void {
    this.eagleAnalytics?.reset();
  }

  /**
   * The client owns document listeners and two intervals, so hand them back rather than leaving a
   * second set behind when the app injector is torn down. Also flushes what is still queued.
   */
  ngOnDestroy(): void {
    this.eagleAnalytics?.destroy();
    this.eagleAnalytics = null;
    this.initialized = false;
  }
}
