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

const EAGLE = '/api/config';
const WHOLE_EAGLE = { ENVIRONMENT: 'test', ACCESS_GATE: true, ADMIN_PATH: '/admin/' };

/** Answers only the paths named, so a fetch of anything else fails the way an unrouted URL would. */
function serving(responses: Record<string, () => Response>) {
  return vi.fn(async (path: string) => responses[path]());
}

/**
 * CONFIG_PATH names a second source for the runtime config, asked once before /api/config.
 * eagle-api stays the source of truth and the kill switch: anything short of a whole payload has to
 * fall through, because a partial one merged over env.js would leave ACCESS_GATE false and open the
 * curtain. Empty means /api/config alone, unchanged.
 */
describe('loadConfig with CONFIG_PATH', () => {
  const original = window.__env;
  const DEMI = '/demi-search/config';
  const WHOLE_DEMI = { ENVIRONMENT: 'test', ACCESS_GATE: true, SEARCH_API_PATH: '/demi-search' };

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** Fresh module graph per test: config.ts keeps the merged config in a module-level singleton. */
  async function loadWith(overrides: Record<string, unknown>) {
    vi.resetModules();
    window.__env = { logLevel: 4, configEndpoint: true, ACCESS_GATE: false, ...overrides };
    const { logger } = await import('./logging');
    const { loadConfig, getConfig } = await import('./config');
    return { loadConfig, getConfig, logger };
  }

  function requested(fetchMock: ReturnType<typeof serving>): string[] {
    return fetchMock.mock.calls.map((call) => call[0]);
  }

  it('asks CONFIG_PATH first and boots on its answer', async () => {
    const fetchMock = serving({ [DEMI]: () => Response.json(WHOLE_DEMI) });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, getConfig } = await loadWith({ CONFIG_PATH: DEMI });
    await loadConfig();

    expect(requested(fetchMock)).toEqual([DEMI]);
    expect(getConfig().SEARCH_API_PATH).toBe('/demi-search');
  });

  it('falls through to /api/config when CONFIG_PATH is down, and logs it once', async () => {
    const fetchMock = serving({
      [DEMI]: () => new Response(null, { status: 503, statusText: 'Service Unavailable' }),
      [EAGLE]: () => Response.json(WHOLE_EAGLE),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, getConfig, logger } = await loadWith({ CONFIG_PATH: DEMI });
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    await loadConfig();

    expect(requested(fetchMock)).toEqual([DEMI, EAGLE]);
    expect(getConfig().ADMIN_PATH).toBe('/admin/');
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('discards a CONFIG_PATH body with no ACCESS_GATE and lets /api/config win', async () => {
    const fetchMock = serving({
      [DEMI]: () => Response.json({ ENVIRONMENT: 'test', SEARCH_API_PATH: '/demi-search' }),
      [EAGLE]: () => Response.json({ ENVIRONMENT: 'test', ACCESS_GATE: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, getConfig, logger } = await loadWith({ CONFIG_PATH: DEMI });
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    await loadConfig();

    expect(requested(fetchMock)).toEqual([DEMI, EAGLE]);
    expect(getConfig().ACCESS_GATE).toBe(true);
    // Nothing from the partial body survives: it is dropped whole, not merged then overwritten.
    expect(getConfig().SEARCH_API_PATH).toBeUndefined();
  });

  it('rejects when neither source answers, rather than booting on env.js', async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 503, statusText: 'Service Unavailable' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, logger } = await loadWith({ CONFIG_PATH: DEMI });
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();

    const outcome = loadConfig().then(
      () => 'resolved',
      () => 'rejected',
    );
    await vi.runAllTimersAsync();

    expect(await outcome).toBe('rejected');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('asks /api/config once and nothing else while CONFIG_PATH is empty', async () => {
    const fetchMock = serving({ [EAGLE]: () => Response.json(WHOLE_EAGLE) });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, getConfig } = await loadWith({ CONFIG_PATH: '' });
    await loadConfig();

    expect(requested(fetchMock)).toEqual([EAGLE]);
    expect(getConfig().ADMIN_PATH).toBe('/admin/');
  });
});

/**
 * Deployed configs ship logLevel 0, so the level alone must not decide whether the merged config
 * lands in every visitor's console.
 */
describe('config dumps', () => {
  const original = window.__env;
  const MERGE_DUMP = 'config: merged with API config:';

  afterEach(() => {
    window.__env = original;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Returns the first argument of every console.log, so the merge dump can be told from the env.js one. */
  async function logsWhileLoadingAt(logLevel: number): Promise<unknown[]> {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', serving({ [EAGLE]: () => Response.json(WHOLE_EAGLE) }));
    window.__env = { logLevel, configEndpoint: true };

    await loadConfig();

    return log.mock.calls.map((call) => call[0]);
  }

  it('stay out of a production build even at log level 0', async () => {
    vi.stubEnv('DEV', false);

    expect(await logsWhileLoadingAt(0)).toEqual([]);
  });

  it('stay out of a dev build above log level 0', async () => {
    vi.stubEnv('DEV', true);

    expect(await logsWhileLoadingAt(4)).not.toContain(MERGE_DUMP);
  });

  it('reach the console in a dev build at log level 0', async () => {
    vi.stubEnv('DEV', true);

    expect(await logsWhileLoadingAt(0)).toContain(MERGE_DUMP);
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

/**
 * `/api/config` serves ADMIN_PATH as `/admin/`, which is only correct on the rproxy host that
 * fronts both apps. On the Azure static site and on the Vite dev server that path is the public
 * app itself, so it has to be resolved against the API host before it is used as a link target.
 */
describe('adminUrl', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
  });

  async function configuredWith(env: Record<string, unknown>): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  it('resolve a relative path against the API host', async () => {
    await configuredWith({
      ADMIN_PATH: '/admin/',
      API_LOCATION: 'https://eagle-test.apps.silver.devops.gov.bc.ca/api',
    });

    expect(adminUrl()).toBe('https://eagle-test.apps.silver.devops.gov.bc.ca/admin/');
  });

  it('resolve against an API host that carries no path', async () => {
    await configuredWith({
      ADMIN_PATH: '/admin/',
      API_LOCATION: 'https://eagle-test.apps.silver.devops.gov.bc.ca',
    });

    expect(adminUrl()).toBe('https://eagle-test.apps.silver.devops.gov.bc.ca/admin/');
  });

  it('leave an absolute path alone', async () => {
    await configuredWith({
      ADMIN_PATH: 'https://admin.example/admin/',
      API_LOCATION: 'https://eagle-test.apps.silver.devops.gov.bc.ca',
    });

    expect(adminUrl()).toBe('https://admin.example/admin/');
  });

  it('keep the relative path when there is no API host to resolve against', async () => {
    await configuredWith({ ADMIN_PATH: '/admin/' });

    expect(adminUrl()).toBe('/admin/');
  });

  it('fall back to the local admin when no path is configured', async () => {
    await configuredWith({ API_LOCATION: 'https://eagle-test.apps.silver.devops.gov.bc.ca' });

    expect(adminUrl()).toBe('http://localhost:4200/admin/');
  });
});
