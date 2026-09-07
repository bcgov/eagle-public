import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AnalyticsService } from './analytics.service';
import { ConfigService } from '../config.service';

/**
 * penguin-analytics is gone and its ingest paths answer 410, so the only correct amount of network
 * traffic from this service is none. These specs watch every transport the retired plugin used
 * (fetch, sendBeacon, XHR) plus the config key it read, so putting a tracker back here without a
 * live backend turns them red.
 */
describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let beaconSpy: ReturnType<typeof vi.fn>;
  let xhrOpenSpy: ReturnType<typeof vi.fn>;
  let penguinKeyReads: number;

  const originalFetch = globalThis.fetch;
  const originalBeacon = navigator.sendBeacon;
  const originalXhrOpen = XMLHttpRequest.prototype.open;

  /** Every transport the plugin could reach for, counted together. */
  function requestTargets(): unknown[] {
    return [
      ...fetchSpy.mock.calls.map(args => args[0]),
      ...beaconSpy.mock.calls.map(args => args[0]),
      ...xhrOpenSpy.mock.calls.map(args => args[1])
    ];
  }

  beforeEach(() => {
    penguinKeyReads = 0;
    fetchSpy = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    beaconSpy = vi.fn().mockReturnValue(true);
    xhrOpenSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true });
    XMLHttpRequest.prototype.open = xhrOpenSpy as unknown as typeof XMLHttpRequest.prototype.open;

    // The retired penguin key counts its own reads, so a spec can prove nothing looks at it.
    const config: Record<string, unknown> = { ENVIRONMENT: 'dev' };
    Object.defineProperty(config, 'ANALYTICS_API_URL', {
      enumerable: true,
      get: () => {
        penguinKeyReads++;
        return '/analytics';
      }
    });

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: ConfigService, useValue: { config: signal(config), init: () => Promise.resolve() } }
      ]
    });

    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(navigator, 'sendBeacon', { value: originalBeacon, configurable: true });
    XMLHttpRequest.prototype.open = originalXhrOpen;
  });

  it('sends no request when it initializes', () => {
    service.initialize();

    expect(requestTargets()).toEqual([]);
  });

  it('sends no request for tracked events, page views or a reset', () => {
    service.initialize();

    service.track('Document Downloaded', { document_id: '123' });
    service.page('Project Details', { project_id: '456' });
    service.reset();

    expect(requestTargets()).toEqual([]);
  });

  it('keeps working when initialize is called twice', () => {
    service.initialize();
    service.initialize();

    service.track('Document Downloaded');

    expect(requestTargets()).toEqual([]);
  });

  it('never reads the retired ANALYTICS_API_URL config key', () => {
    service.initialize();

    service.track('Document Downloaded');
    service.page('Project Details');
    service.reset();

    expect(penguinKeyReads).toBe(0);
  });
});
