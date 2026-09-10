import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  adminUrl,
  bannerColour,
  bulkDownloadEnabled,
  contentSearchEnabled,
  env,
  getConfig,
  getDemiProjectsPath,
  getNotifyApi,
  getSearchApiPath,
  loadConfig,
  showSurveyBanner,
  surveyUrl,
} from './config';

/**
 * CONTENT_SEARCH decides whether the Document Content tab and route are offered at all, so a
 * truthy-but-not-true value must not turn it on: the config document is hand-edited in Mongo and
 * the string "false" is truthy.
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
 * demi-search is the only backend, so an unconfigured environment must still resolve to it rather
 * than to nothing. env.js ships both paths empty on purpose - the default lives here.
 */
describe('DEMI base paths', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
  });

  async function configuredWith(env: Record<string, unknown>): Promise<void> {
    window.__env = { logLevel: 4, ...env };
    await loadConfig();
  }

  it('default to /demi-search and /demi-projects when nothing is configured', async () => {
    await configuredWith({});
    expect(getSearchApiPath()).toBe('/demi-search');
    expect(getDemiProjectsPath()).toBe('/demi-projects');
  });

  it('default when the configured values are empty, so a blank env.js still boots', async () => {
    await configuredWith({ SEARCH_API_PATH: '', DEMI_PROJECTS_PATH: '' });
    expect(getSearchApiPath()).toBe('/demi-search');
    expect(getDemiProjectsPath()).toBe('/demi-projects');
  });

  it('read the configured values, trailing slashes trimmed off the projects path', async () => {
    await configuredWith({
      SEARCH_API_PATH: '/other-search',
      DEMI_PROJECTS_PATH: '  /other-projects//  ',
    });
    expect(getSearchApiPath()).toBe('/other-search');
    expect(getDemiProjectsPath()).toBe('/other-projects');
  });

  /** demi-api serves the bulk and presigned download routes everywhere; there is no off state. */
  it('offer bulk download whatever is configured', async () => {
    await configuredWith({ SEARCH_API_PATH: '' });
    expect(bulkDownloadEnabled()).toBe(true);
  });
});

/**
 * env.js ships ACCESS_GATE false, so a silent fallback to it would open the curtain. A failed
 * config fetch is retried, then fatal - main.tsx turns that into the unavailable page.
 */
describe('loadConfig with a config endpoint', () => {
  const original = window.__env;

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('merges the remote config over env.js', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ENVIRONMENT: 'test', ACCESS_GATE: true })),
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

const DEFAULT_CONFIG = '/demi-search/config';
const WHOLE_CONFIG = { ENVIRONMENT: 'test', ACCESS_GATE: true, ADMIN_PATH: '/admin/' };

/** Answers only the paths named, so a fetch of anything else fails the way an unrouted URL would. */
function serving(responses: Record<string, () => Response>) {
  return vi.fn(async (path: string) => responses[path]());
}

/**
 * CONFIG_PATH is the only source for the runtime config, and `/demi-search/config` when env.js
 * leaves it empty. Anything short of a whole payload is a failure, because a partial one merged
 * over env.js would leave ACCESS_GATE false and open the curtain.
 */
describe('loadConfig with CONFIG_PATH', () => {
  const original = window.__env;
  const DEMI = '/demi-search/config';
  /** proxy_connect_timeout 1s + proxy_read_timeout 10s on the /demi-search route in eao-nginx. */
  const NGINX_GIVES_UP_MS = 11_000;
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

  it('lets each attempt run past the point nginx gives up', async () => {
    const abortAfter = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = serving({ [DEMI]: () => Response.json(WHOLE_DEMI) });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig } = await loadWith({ CONFIG_PATH: DEMI });
    await loadConfig();

    // Aborting first would show a browser error instead of nginx's own answer on a cold start.
    expect(abortAfter).toHaveBeenCalledTimes(1);
    expect(abortAfter.mock.calls[0][0]).toBeGreaterThan(NGINX_GIVES_UP_MS);
  });

  it('retries the same path when it is down, then rejects rather than booting on env.js', async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 503, statusText: 'Service Unavailable' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, logger } = await loadWith({ CONFIG_PATH: DEMI });
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();

    const outcome = loadConfig().then(
      () => 'resolved',
      () => 'rejected',
    );
    await vi.runAllTimersAsync();

    expect(await outcome).toBe('rejected');
    expect(requested(fetchMock)).toEqual([DEMI, DEMI, DEMI]);
    expect(logged).toHaveBeenCalledTimes(3);
  });

  it('rejects a body with no ACCESS_GATE instead of merging half of it over env.js', async () => {
    const fetchMock = serving({
      [DEMI]: () => Response.json({ ENVIRONMENT: 'test', SEARCH_API_PATH: '/other-search' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, getConfig, logger } = await loadWith({ CONFIG_PATH: DEMI });
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();

    const outcome = loadConfig().then(
      () => 'resolved',
      () => 'rejected',
    );
    await vi.runAllTimersAsync();

    expect(await outcome).toBe('rejected');
    // Nothing from the partial body survives: it is dropped whole, not merged then overwritten.
    expect(getConfig().SEARCH_API_PATH).toBeUndefined();
  });

  it('asks /demi-search/config while CONFIG_PATH is empty, and nothing else', async () => {
    const fetchMock = serving({ [DEFAULT_CONFIG]: () => Response.json(WHOLE_CONFIG) });
    vi.stubGlobal('fetch', fetchMock);

    const { loadConfig, getConfig } = await loadWith({ CONFIG_PATH: '' });
    await loadConfig();

    expect(requested(fetchMock)).toEqual([DEFAULT_CONFIG]);
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
    vi.stubGlobal('fetch', serving({ [DEFAULT_CONFIG]: () => Response.json(WHOLE_CONFIG) }));
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
 * The runtime config serves ADMIN_PATH as `/admin/`, which is only correct on the rproxy host that
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
