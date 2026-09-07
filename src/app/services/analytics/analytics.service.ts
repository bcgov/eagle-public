import { Injectable } from '@angular/core';

/**
 * Analytics is off on this line.
 *
 * penguin-analytics was decommissioned on 2026-09-07: rproxy answers `/analytics` and
 * `/api/analytics` with 410, and eagle-api's `/api/config` no longer serves ANALYTICS_API_URL as
 * anything but an empty string. Nothing here reads that key any more, so the empty value cannot
 * turn a tracker back on.
 *
 * The methods stay because the ~36 call sites are the record of what the app wants measured. They
 * are no-ops until a replacement client is wired in here; the eagle-analytics client ships on the
 * React line only.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  initialize(): void {
    // No tracker to start.
  }

  page(_name?: string, _properties?: Record<string, unknown>): void {
    // No tracker to send to.
  }

  track(_event: string, _properties?: Record<string, unknown>): void {
    // No tracker to send to.
  }

  reset(): void {
    // No tracker to reset.
  }
}
