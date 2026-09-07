import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AnalyticsService } from './analytics.service';
import { ConfigService } from '../config.service';
import { LoggingService } from '../logging.service';

/**
 * The eagle-analytics client batches, so nothing leaves on the `track()` call itself. A `pagehide`
 * drains the queue, which is the same path a real tab takes when it closes.
 *
 * jsdom has no `navigator.sendBeacon` and its `Blob` has no `text()`, so the beacon is stubbed as
 * unavailable and every assertion reads the client's `keepalive` fetch fallback, whose body is a
 * plain JSON string. Both transports carry the same batch.
 */
describe('AnalyticsService', () => {
  // The shape /api/config actually serves: relative, so rproxy keeps ingest same-origin.
  const EAGLE_URL = '/api/usage';

  interface SentEvent {
    eventType: string;
    sessionId: string;
    sourceApp: string;
    userId?: string;
    properties?: Record<string, any>;
  }

  let service: AnalyticsService;
  let configSignal: ReturnType<typeof signal<Record<string, unknown>>>;
  let logger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let fetchSpy: ReturnType<typeof vi.fn>;
  let beaconSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let penguinKeyReads: number;

  const originalFetch = globalThis.fetch;
  const originalBeacon = navigator.sendBeacon;

  /** Drain the queue the way a closing tab would, and read back the batch that went out. */
  function flushedEvents(): SentEvent[] {
    window.dispatchEvent(new Event('pagehide'));
    return fetchSpy.mock.calls.flatMap(([, init]) => JSON.parse(init.body).events as SentEvent[]);
  }

  /** Click a real anchor, which is what the client's enhanced tracking listens for. */
  function clickLink(href: string, label: string): void {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    // jsdom cannot navigate; swallow the default so it does not log "Not implemented".
    link.addEventListener('click', event => event.preventDefault());
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    link.remove();
  }

  /**
   * Config whose retired penguin key counts its own reads, so a spec can prove nothing looks at
   * ANALYTICS_API_URL any more. eagle-api serves it as an empty string and rproxy answers
   * `/analytics` with 410, so a read here would be a live bug, not a style point.
   */
  function setConfig(values: Record<string, unknown>): void {
    const config: Record<string, unknown> = { ...values };
    Object.defineProperty(config, 'ANALYTICS_API_URL', {
      enumerable: true,
      get: () => {
        penguinKeyReads++;
        return '/analytics';
      }
    });
    configSignal.set(config);
  }

  beforeEach(() => {
    // One session per tab: clear the store so each spec starts as a fresh tab would.
    sessionStorage.clear();
    localStorage.clear();
    penguinKeyReads = 0;
    configSignal = signal<Record<string, unknown>>({});
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    fetchSpy = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    beaconSpy = vi.fn().mockReturnValue(false);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true });

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: ConfigService, useValue: { config: configSignal } },
        { provide: LoggingService, useValue: logger }
      ]
    });

    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    // The client holds document listeners and intervals; drop them, or every later spec sees a
    // second copy of each auto-tracked event.
    service.ngOnDestroy();
    globalThis.fetch = originalFetch;
    Object.defineProperty(navigator, 'sendBeacon', { value: originalBeacon, configurable: true });
    warnSpy.mockRestore();
  });

  it('queues tracked events to the client and posts them to EAGLE_ANALYTICS_URL', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();

    service.track('Document Downloaded', { document_id: '123' });

    // Batched, not sent per call.
    expect(fetchSpy).not.toHaveBeenCalled();

    const events = flushedEvents();
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([`${EAGLE_URL}/events`]);
    expect(beaconSpy).toHaveBeenCalled();

    const tracked = events.find(e => e.eventType === 'Document Downloaded');
    expect(tracked?.properties?.['document_id']).toBe('123');
    expect(tracked?.sourceApp).toBe('eagle-public');
    expect(logger.info).toHaveBeenCalledWith(
      `Analytics initialized with API URL: ${EAGLE_URL}`,
      'AnalyticsService'
    );
  });

  it('queues page views to the client with the page name', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();

    service.page('Project Details', { project_id: '456' });

    const viewed = flushedEvents().find(e => e.eventType === 'Page Viewed');
    expect(viewed?.properties?.['page_name']).toBe('Project Details');
    expect(viewed?.properties?.['project_id']).toBe('456');
    expect(viewed?.sourceApp).toBe('eagle-public');
    // trafficTracking is off, so no utm or referrer attribution rides along.
    expect(Object.keys(viewed?.properties ?? {}).filter(k => k.startsWith('traffic_'))).toEqual([]);
    expect(sessionStorage.getItem('eagle_analytics.first_touch')).toBeNull();
  });

  it('stays anonymous: no identify method and no user id on any event', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();

    service.track('Document Downloaded');
    service.page('Project Details');

    const events = flushedEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.filter(e => 'userId' in e)).toEqual([]);
    expect('identify' in service).toBe(false);
  });

  it('keeps the session in sessionStorage only, and reset() starts a new one', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();

    service.track('Document Downloaded');
    const sessionBefore = flushedEvents()[0].sessionId;
    expect(sessionStorage.getItem('eagle_analytics.session_id')).toBe(sessionBefore);
    // Per tab, so nothing that outlives the tab may hold the id.
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe('');

    service.reset();
    service.track('Document Downloaded');

    const after = flushedEvents().filter(e => e.eventType === 'Document Downloaded');
    const sessionAfter = after[after.length - 1].sessionId;
    expect(sessionAfter).not.toBe(sessionBefore);
    expect(sessionStorage.getItem('eagle_analytics.session_id')).toBe(sessionAfter);
  });

  it('auto-tracks link clicks, because enhanced tracking is on', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();

    clickLink('/projects', 'All Projects');

    const clicked = flushedEvents().filter(e => e.eventType === 'Link Clicked');
    expect(clicked).toHaveLength(1);
    expect(clicked[0].properties?.['link_url']).toBe('/projects');
    expect(clicked[0].properties?.['link_text']).toBe('All Projects');
  });

  it('builds one client only, so a second initialize does not double every auto event', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();
    service.initialize();

    clickLink('/projects', 'All Projects');
    service.track('Document Downloaded');

    const events = flushedEvents();
    expect(events.filter(e => e.eventType === 'Link Clicked')).toHaveLength(1);
    expect(events.filter(e => e.eventType === 'Document Downloaded')).toHaveLength(1);
  });

  it('sends nothing anywhere when EAGLE_ANALYTICS_URL is empty', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: '' });
    service.initialize();

    service.track('Document Downloaded', { document_id: '123' });
    service.page('Project Details');
    service.reset();

    expect(flushedEvents()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      'Analytics disabled: no EAGLE_ANALYTICS_URL configured',
      'AnalyticsService'
    );
  });

  it('sends nothing anywhere when EAGLE_ANALYTICS_URL is absent', () => {
    setConfig({ ENVIRONMENT: 'test' });
    service.initialize();

    service.track('Document Downloaded');

    expect(flushedEvents()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs client send failures to the console only in local dev', async () => {
    setConfig({ ENVIRONMENT: 'local', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();
    fetchSpy.mockRejectedValue(new Error('ingest down'));

    service.track('Document Downloaded');
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());

    expect(warnSpy.mock.calls[0][0]).toContain('[analytics]');
  });

  it('keeps client send failures off the console in a deployed environment', async () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();
    fetchSpy.mockRejectedValue(new Error('ingest down'));

    service.track('Document Downloaded');
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never reads the retired ANALYTICS_API_URL config key', () => {
    setConfig({ ENVIRONMENT: 'test', EAGLE_ANALYTICS_URL: EAGLE_URL });
    service.initialize();

    service.track('Document Downloaded');
    service.page('Project Details');
    service.reset();
    flushedEvents();

    expect(penguinKeyReads).toBe(0);
  });
});
