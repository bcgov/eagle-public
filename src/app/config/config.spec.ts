import { describe, it, expect, afterEach, vi } from 'vitest';
import { bulkDownloadEnabled, contentSearchEnabled, getConfig, getNotifyUrl, loadConfig, notifySubscribeUrl } from './config';

/**
 * CONTENT_SEARCH decides whether the Document Content tab and route are offered at all, so a
 * truthy-but-not-true value must not turn it on: `/api/config` is hand-edited in Mongo and the
 * string "false" is truthy.
 */
describe('contentSearchEnabled', () => {
  const original = window.__env;

  afterEach(async () => {
    window.__env = original;
  });

  async function configuredWith(env: Record<string, unknown>): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  it('is off when the flag is absent', async () => {
    await configuredWith({});
    expect(contentSearchEnabled()).toBe(false);
  });

  it('is on when the flag is true', async () => {
    await configuredWith({ CONTENT_SEARCH: true });
    expect(contentSearchEnabled()).toBe(true);
  });

  it('is off when the flag is false', async () => {
    await configuredWith({ CONTENT_SEARCH: false });
    expect(contentSearchEnabled()).toBe(false);
  });

  it('is off for a value that is merely truthy', async () => {
    await configuredWith({ CONTENT_SEARCH: 'false' });
    expect(contentSearchEnabled()).toBe(false);
  });
});

/** The subscribe links join this base to `/#/?s=...`, so a trailing slash would double the one there. */
describe('getNotifyUrl', () => {
  const original = window.__env;

  afterEach(async () => {
    window.__env = original;
    await loadConfig();
  });

  it('is empty when unset', async () => {
    window.__env = { logLevel: 4 };
    await loadConfig();
    expect(getNotifyUrl()).toBe('');
  });

  it('trims the value and drops trailing slashes', async () => {
    window.__env = { logLevel: 4, NOTIFY_URL: '  https://notify.example//  ' };
    await loadConfig();
    expect(getNotifyUrl()).toBe('https://notify.example');
  });

  /** eagle-notify is hash-routed, so the `/#/` between the base and the query is load-bearing. */
  it('builds the hash-routed subscribe link', async () => {
    window.__env = { logLevel: 4, NOTIFY_URL: 'https://notify.example/' };
    await loadConfig();
    expect(notifySubscribeUrl('project:proj-1')).toBe('https://notify.example/#/?s=project:proj-1');
  });

  it('builds no link when unset, so the pages hide theirs', async () => {
    window.__env = { logLevel: 4 };
    await loadConfig();
    expect(notifySubscribeUrl('eao:updates')).toBe('');
  });
});

/**
 * The bulk download routes live on the DEMI search base. No search path means no DEMI, so the UI
 * has to hide rather than post to eagle-api, which has no such route.
 */
describe('bulkDownloadEnabled', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
  });

  async function configuredWith(env: Record<string, unknown>): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  it('is off when SEARCH_API_PATH is absent', async () => {
    await configuredWith({});
    expect(bulkDownloadEnabled()).toBe(false);
  });

  it('is off when SEARCH_API_PATH is empty, which is the kill switch', async () => {
    await configuredWith({ SEARCH_API_PATH: '' });
    expect(bulkDownloadEnabled()).toBe(false);
  });

  it('is on when SEARCH_API_PATH names a backend', async () => {
    await configuredWith({ SEARCH_API_PATH: '/demi-search' });
    expect(bulkDownloadEnabled()).toBe(true);
  });
});

/**
 * env.js ships ACCESS_GATE false and an empty search path, so a silent fallback to it would open
 * the curtain and point search at the wrong backend. A failed /api/config is retried, then fatal.
 */
describe('loadConfig with a config endpoint', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('merges /api/config over env.js', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ACCESS_GATE: true })));
    window.__env = { logLevel: 4, configEndpoint: true, ACCESS_GATE: false };
    await loadConfig();
    expect(getConfig().ACCESS_GATE).toBe(true);
  });

  it('retries, then rejects instead of falling back to env.js', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(null, { status: 502, statusText: 'Bad Gateway' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.__env = { logLevel: 4, configEndpoint: true, ACCESS_GATE: false };

    const pending = loadConfig();
    const outcome = pending.then(() => 'resolved', () => 'rejected');
    await vi.runAllTimersAsync();

    expect(await outcome).toBe('rejected');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
