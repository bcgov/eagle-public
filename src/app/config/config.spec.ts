import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  adminUrl,
  bannerColour,
  bulkDownloadEnabled,
  contentSearchEnabled,
  env,
  getConfig,
  getNotifyApi,
  loadConfig,
  showSurveyBanner,
  surveyUrl,
} from './config';

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

/** The form posts to `${base}/api/subscriptions`, so a trailing slash would double the one there. */
describe('getNotifyApi', () => {
  const original = window.__env;

  afterEach(async () => {
    window.__env = original;
    await loadConfig();
  });

  it('is empty when unset, so the pages hide the subscribe control', async () => {
    window.__env = { logLevel: 4 };
    await loadConfig();
    expect(getNotifyApi()).toBe('');
  });

  it('trims the value and drops trailing slashes', async () => {
    window.__env = { logLevel: 4, NOTIFY_API: '  https://notify-api.example//  ' };
    await loadConfig();
    expect(getNotifyApi()).toBe('https://notify-api.example');
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ACCESS_GATE: true })),
    );
    window.__env = { logLevel: 4, configEndpoint: true, ACCESS_GATE: false };
    await loadConfig();
    expect(getConfig().ACCESS_GATE).toBe(true);
  });

  it('retries, then rejects instead of falling back to env.js', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 502, statusText: 'Bad Gateway' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.__env = { logLevel: 4, configEndpoint: true, ACCESS_GATE: false };

    const pending = loadConfig();
    const outcome = pending.then(
      () => 'resolved',
      () => 'rejected',
    );
    await vi.runAllTimersAsync();

    expect(await outcome).toBe('rejected');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

/**
 * Deployed configs ship logLevel 0, so the level alone must not decide whether the merged config
 * lands in every visitor's console.
 */
describe('config dumps', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('stay out of a production build even at log level 0', async () => {
    vi.stubEnv('DEV', false);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    window.__env = { logLevel: 0 };

    await loadConfig();

    expect(log).not.toHaveBeenCalled();
  });
});

describe('config getters', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
  });

  async function configuredWith(env: Record<string, unknown>): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  it('fall back to local defaults when the config is empty', async () => {
    await configuredWith({});
    expect(env()).toBe('local');
    expect(adminUrl()).toBe('http://localhost:4200/admin/');
    expect(bannerColour()).toBe('red');
    expect(surveyUrl()).toBeNull();
    expect(showSurveyBanner()).toBe(false);
  });

  it('read the configured values', async () => {
    await configuredWith({
      ENVIRONMENT: 'test',
      ADMIN_PATH: '/admin/',
      BANNER_COLOUR: 'green',
      SURVEY_URL: 'https://survey.example',
      SHOW_SURVEY_BANNER: true,
    });
    expect(env()).toBe('test');
    expect(adminUrl()).toBe('/admin/');
    expect(bannerColour()).toBe('green');
    expect(surveyUrl()).toBe('https://survey.example');
    expect(showSurveyBanner()).toBe(true);
  });

  it('treat an empty banner colour as no colour, not the default', async () => {
    await configuredWith({ BANNER_COLOUR: '' });
    expect(bannerColour()).toBe('');
  });
});
