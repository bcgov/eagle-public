import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// app.config pulls in the route table, whose map component reads the Leaflet global that
// index.html loads from a script tag. jsdom has no such tag, and the icons are built at module load.
vi.hoisted(() => { (globalThis as any).L = { icon: () => ({}) }; });

import { ConfigService } from './config.service';
import { LoggingService } from './logging.service';
import { initializeApp } from '../app.config';

/**
 * CONTENT_SEARCH decides whether the Document Content tab and route are offered at all, so a
 * truthy-but-not-true value must not turn it on: the runtime config is hand-edited and the string
 * "false" is truthy.
 */
describe('ConfigService.contentSearchEnabled', () => {
  const original = (window as any).__env;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  afterEach(() => {
    (window as any).__env = original;
  });

  async function serviceWith(env: Record<string, unknown>): Promise<ConfigService> {
    (window as any).__env = { logLevel: 4, ...env };
    const service = TestBed.inject(ConfigService);
    await service.init();
    return service;
  }

  it('is off when the flag is absent', async () => {
    expect((await serviceWith({})).contentSearchEnabled()).toBe(false);
  });

  it('is on when the flag is true', async () => {
    expect((await serviceWith({ CONTENT_SEARCH: true })).contentSearchEnabled()).toBe(true);
  });

  it('is off when the flag is false', async () => {
    expect((await serviceWith({ CONTENT_SEARCH: false })).contentSearchEnabled()).toBe(false);
  });

  it('is off for a value that is merely truthy', async () => {
    expect((await serviceWith({ CONTENT_SEARCH: 'false' as any })).contentSearchEnabled()).toBe(false);
  });
});

/** eagle-api serves no public read, so an unset path must land on DEMI, never on `/api`. */
describe('ConfigService DEMI paths', () => {
  const original = (window as any).__env;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => {
    (window as any).__env = original;
  });

  async function serviceWith(env: Record<string, unknown>): Promise<ConfigService> {
    (window as any).__env = { logLevel: 4, ...env };
    const service = TestBed.inject(ConfigService);
    await service.init();
    return service;
  }

  it('reads search from /demi-search when SEARCH_API_PATH is unset', async () => {
    expect((await serviceWith({})).getSearchApiPath()).toBe('/demi-search');
  });

  it('reads search from /demi-search when SEARCH_API_PATH is empty', async () => {
    expect((await serviceWith({ SEARCH_API_PATH: '' })).getSearchApiPath()).toBe('/demi-search');
  });

  it('honours a configured SEARCH_API_PATH', async () => {
    expect((await serviceWith({ SEARCH_API_PATH: 'https://demi.example/api' })).getSearchApiPath()).toBe('https://demi.example/api');
  });

  it('reads projects from /demi-projects when DEMI_PROJECTS_PATH is unset', async () => {
    expect((await serviceWith({})).getDemiProjectsPath()).toBe('/demi-projects');
  });

  it('reads projects from /demi-projects when DEMI_PROJECTS_PATH is blank', async () => {
    expect((await serviceWith({ DEMI_PROJECTS_PATH: '  ' })).getDemiProjectsPath()).toBe('/demi-projects');
  });

  it('drops a trailing slash from DEMI_PROJECTS_PATH', async () => {
    expect((await serviceWith({ DEMI_PROJECTS_PATH: '/projects-api/' })).getDemiProjectsPath()).toBe('/projects-api');
  });

  it('loads the lists from the demi-search List dataset', async () => {
    const service = await serviceWith({});
    const lists = firstValueFrom(service.lists);
    TestBed.inject(HttpTestingController)
      .expectOne('/demi-search/search?pageSize=1000&dataset=List')
      .flush([{ searchResults: [{ _id: 'l1', name: 'Approved' }], meta: [] }]);
    expect((await lists).map((row: any) => row.name)).toEqual(['Approved']);
  });

  it('warns when the List page holds fewer rows than demi-search counted', async () => {
    const service = await serviceWith({});
    const warn = vi.spyOn(TestBed.inject(LoggingService), 'warn');
    const lists = firstValueFrom(service.lists);
    TestBed.inject(HttpTestingController)
      .expectOne('/demi-search/search?pageSize=1000&dataset=List')
      .flush([{ searchResults: [{ _id: 'l1' }], meta: [{ searchResultsTotal: 1001 }] }]);
    await lists;
    expect(warn).toHaveBeenCalledWith('List answered 1 of 1001 rows; the rest are not shown', 'config');
  });

  it('stays quiet when the List page holds every row', async () => {
    const service = await serviceWith({});
    const warn = vi.spyOn(TestBed.inject(LoggingService), 'warn');
    const lists = firstValueFrom(service.lists);
    TestBed.inject(HttpTestingController)
      .expectOne('/demi-search/search?pageSize=1000&dataset=List')
      .flush([{ searchResults: [{ _id: 'l1' }], meta: [{ searchResultsTotal: 1 }] }]);
    await lists;
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * The deployed app reads its runtime config from demi-search, never eagle-api. env.js ships
 * ACCESS_GATE false, so a config that cannot be loaded whole is retried, then fails the boot
 * instead of opening the curtain.
 */
describe('ConfigService runtime config', () => {
  const original = (window as any).__env;
  const originalFetch = globalThis.fetch;
  const WHOLE = { ENVIRONMENT: 'test', ACCESS_GATE: true, SEARCH_API_PATH: '/demi-search' };
  // Backoff is 1 s then 2 s; each attempt aborts at 12 s.
  const ALL_RETRIES_MS = 3 * 12_000 + 3_000;
  let fetchSpy: ReturnType<typeof vi.fn>;

  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(LoggingService.prototype, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    (window as any).__env = original;
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  function serviceAnswering(env: Record<string, unknown>, ...answers: ((url: string, init?: RequestInit) => Promise<Response>)[]): ConfigService {
    fetchSpy = vi.fn();
    answers.forEach((answer) => fetchSpy.mockImplementationOnce(answer));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    (window as any).__env = { logLevel: 4, configEndpoint: true, ENVIRONMENT: 'dev', ACCESS_GATE: false, ...env };
    return TestBed.inject(ConfigService);
  }

  async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
    const outcome = promise.then((value) => ({ value }), (error) => ({ error }));
    await vi.advanceTimersByTimeAsync(ALL_RETRIES_MS);
    return outcome;
  }

  const askedFor = () => fetchSpy.mock.calls.map(([url]) => url);
  const networkError = () => Promise.reject(new TypeError('Failed to fetch'));
  const serverError = () => Promise.resolve(new Response('nope', { status: 502, statusText: 'Bad Gateway' }));
  const neverAnswers = (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));

  it('asks /demi-search/config and merges the answer', async () => {
    const service = serviceAnswering({}, async () => ok(WHOLE));
    await settle(service.init());
    expect(askedFor()).toEqual(['/demi-search/config']);
    expect(service.config().ACCESS_GATE).toBe(true);
    expect(service.config().ENVIRONMENT).toBe('test');
  });

  it('ignores a CONFIG_PATH left in an old env.js', async () => {
    await settle(serviceAnswering({ CONFIG_PATH: '/other/config' }, async () => ok(WHOLE)).init());
    expect(askedFor()).toEqual(['/demi-search/config']);
  });

  it('does not fetch when the config endpoint is off', async () => {
    const service = serviceAnswering({ configEndpoint: false });
    expect(await settle(service.init())).toEqual({ value: undefined });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(service.config().ENVIRONMENT).toBe('dev');
  });

  it('retries after a network error and merges the second answer', async () => {
    const service = serviceAnswering({}, networkError, async () => ok(WHOLE));
    expect(await settle(service.init())).toEqual({ value: undefined });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(service.config().ACCESS_GATE).toBe(true);
  });

  it('waits 1 s before the second attempt and 2 s before the third', async () => {
    const pending = serviceAnswering({}, networkError, networkError, async () => ok(WHOLE)).init();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    await pending;
  });

  it.each([400, 401, 403, 404])('fails at once on a %i, which asking again will not change', async (status) => {
    const refused = () => Promise.resolve(new Response('no', { status }));
    const { error } = await settle(serviceAnswering({}, refused, refused, refused).init());
    expect(String(error)).toContain(`HTTP ${status}`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([408, 429])('retries a %i, which can clear on its own', async (status) => {
    const busy = () => Promise.resolve(new Response('busy', { status }));
    const service = serviceAnswering({}, busy, async () => ok(WHOLE));
    expect(await settle(service.init())).toEqual({ value: undefined });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('warns on each retried attempt and leaves the final failure to the boot catch', async () => {
    const warn = vi.spyOn(LoggingService.prototype, 'warn').mockImplementation(() => undefined);
    await settle(serviceAnswering({}, networkError, networkError, networkError).init());
    expect(warn).toHaveBeenCalledTimes(2);
    expect(LoggingService.prototype.error).not.toHaveBeenCalled();
  });

  it('rejects after three network errors, keeping the curtain shut', async () => {
    const service = serviceAnswering({}, networkError, networkError, networkError);
    const { error } = await settle(service.init());
    expect(error).toBeInstanceOf(TypeError);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('rejects after three non-200 answers', async () => {
    const { error } = await settle(serviceAnswering({}, serverError, serverError, serverError).init());
    expect(String(error)).toContain('HTTP 502');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('rejects after three attempts that time out', async () => {
    // jsdom's AbortSignal.timeout runs on a real timer, out of reach of the fake clock.
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('signal timed out', 'TimeoutError')), ms);
      return controller.signal;
    });
    const { error } = await settle(serviceAnswering({}, neverAnswers, neverAnswers, neverAnswers).init());
    expect((error as DOMException)?.name).toBe('TimeoutError');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('rejects a body with no boolean ACCESS_GATE', async () => {
    const partial = async () => ok({ ENVIRONMENT: 'test', ACCESS_GATE: 'true' });
    const { error } = await settle(serviceAnswering({}, partial, partial, partial).init());
    expect(String(error)).toContain('ACCESS_GATE');
  });

  it('rejects a body with no ENVIRONMENT', async () => {
    const partial = async () => ok({ ACCESS_GATE: true });
    const { error } = await settle(serviceAnswering({}, partial, partial, partial).init());
    expect(String(error)).toContain('ENVIRONMENT');
  });

  it('shows the unavailable page and halts bootstrap after three failures', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    serviceAnswering({}, networkError, networkError, networkError);
    const { error } = await settle(TestBed.runInInjectionContext(() => initializeApp()));
    expect(error).toBeInstanceOf(TypeError);
    expect(document.querySelector('app-root h1')?.textContent).toBe('EPIC is temporarily unavailable');
  });

  it('shows a static Loading message until the app replaces it', () => {
    const page = new DOMParser().parseFromString(readFileSync(resolve(__dirname, '../../index.html'), 'utf-8'), 'text/html');
    expect(page.querySelector('app-root')?.textContent?.trim()).toBe('Loading…');
  });

  it('leaves the page alone when the config loads', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    serviceAnswering({}, async () => ok(WHOLE));
    expect(await settle(TestBed.runInInjectionContext(() => initializeApp()))).toEqual({ value: undefined });
    expect(document.querySelector('app-root')?.innerHTML).toBe('');
  });
});
