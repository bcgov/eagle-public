import { logger } from './logging';

export interface EnvConfig {
  logLevel?: number;
  LOG_LEVEL?: number;
  configEndpoint?: boolean;
  /**
   * Where the runtime config itself comes from, when `configEndpoint` is true. Set, it is tried
   * once before `/api/config` and its body is only accepted whole; empty or unset means
   * `/api/config` alone. Read from env.js before any remote merge, so setting or clearing it
   * needs a redeploy of env.js. eagle-api stays the source of truth either way: its Mongo
   * `Config` document is the kill switch for what the app reads at runtime, and an unreachable
   * or partial answer here falls through to `/api/config` rather than booting on env.js.
   */
  CONFIG_PATH?: string;
  ENVIRONMENT?: string;
  BANNER_COLOUR?: string;
  API_PATH?: string;
  API_LOCATION?: string;
  /**
   * Base URL for Project/Document/DocumentChunk search, when it is served by eagle-search
   * (Azure AI Search) rather than eagle-api.
   *
   * Normally RELATIVE — `/eagle-search` — because rproxy proxies that location to the Azure host,
   * which keeps the call same-origin and needs no CORS. Absolute (`https://…/api`) only where there
   * is no rproxy in front, which today means the static Azure Front Door build for test.
   *
   * EMPTY OR UNSET FALLS BACK TO eagle-api, and that is also the kill switch. In dev and test the
   * switch is eagle-api's Mongo `Config` document; prod still reads it from the rproxy ConfigMap
   * until prod moves to rproxy v2.7.11. Either way it reverts with no redeploy.
   */
  SEARCH_API_PATH?: string;
  /**
   * Base path for DEMI project documents: `GET <path>/<eagleProjectId>` answers the project, whose
   * `phases` array carries the assessment rail's per-phase dates. Empty or unset asks for nothing
   * and the rail renders without dates. Served from /api/config like SEARCH_API_PATH.
   */
  DEMI_PROJECTS_PATH?: string;
  /**
   * Shows the Document Content search tab and route. The API serves content search everywhere, so
   * this only decides whether the UI offers it — false or unset hides it, with no redeploy needed
   * to change either way.
   */
  CONTENT_SEARCH?: boolean;
  /**
   * Puts a shared-password curtain in front of the whole app. Only a literal `true` closes it, so
   * prod (false or unset) renders unchanged. eagle-api checks the password; see state/gate.ts.
   */
  ACCESS_GATE?: boolean;
  ADMIN_PATH?: string;
  /** eagle-notify API base. Empty or unset hides the subscribe control. */
  NOTIFY_API?: string;
  SURVEY_URL?: string | null;
  SHOW_SURVEY_BANNER?: boolean;
  /** Analytics client options; see vendor/eagle-analytics-client/README.md for what each does. */
  ANALYTICS_DEBUG?: boolean;
  ANALYTICS_ENHANCED_TRACKING?: boolean;
  ANALYTICS_TRAFFIC_TRACKING?: boolean;
  /**
   * eagle-analytics ingest base for @digitalspace/eagle-analytics-client, the only analytics backend
   * now that penguin-analytics is retired. Empty or unset gives that client a no-op instance. Served
   * from /api/config like SEARCH_API_PATH, so it turns on with no redeploy.
   */
  EAGLE_ANALYTICS_URL?: string;
  /**
   * Azure Application Insights connection string for browser error reporting. Empty or unset
   * sends nothing and loads no SDK. Served from /api/config like SEARCH_API_PATH.
   */
  APPINSIGHTS_CONNECTION_STRING?: string;
  GH_HASH?: string;
}

// env.js sets window.__env before the app bundle loads (via script tag in index.html)
declare global {
  interface Window {
    __env: EnvConfig;
  }
}

let config: EnvConfig = {};

/**
 * Load the runtime configuration.
 *
 * LOCAL DEV (configEndpoint = false):
 *   - Uses env.js values directly (src/env.js)
 *   - vite.config.ts reads API_LOCATION from env.js to generate dev server proxy rules
 *   - App uses relative paths (/api) — never API_LOCATION directly
 *
 * DEPLOYED (configEndpoint = true):
 *   - The Azure deploy workflows sed configEndpoint to true
 *   - App fetches /api/config on startup. rproxy proxies that to eagle-api, which serves it from
 *     its Mongo `Config` document. A non-empty CONFIG_PATH is asked first, with /api/config as the
 *     fallback; see fetchRemoteConfig.
 *   - Those values override env.js
 *
 * Must be awaited so that dependent code (analytics) initializes with the correct
 * environment-specific values.
 */
export async function loadConfig(): Promise<void> {
  config = { ...(window.__env || {}) };

  if (import.meta.env.DEV && config.logLevel === 0) {
    console.log('config: env.js values:', config);
  }

  if (config.configEndpoint === true) {
    await fetchRemoteConfig();
  }
}

export function getConfig(): EnvConfig {
  return config;
}

/**
 * The API path for making API calls.
 * Always relative — the dev server proxy (local) or rproxy (deployed) handles routing.
 */
export function getApiPath(): string {
  return config.API_PATH || '/api';
}

/**
 * Base URL for search, when it is served by eagle-search. Falls back to the eagle-api path, so an
 * unconfigured environment keeps working unchanged.
 */
export function getSearchApiPath(): string {
  return config.SEARCH_API_PATH || getApiPath();
}

/**
 * DEMI project base path, without a trailing slash. Empty when unset, which is the off switch for
 * the assessment rail's phase dates.
 */
export function getDemiProjectsPath(): string {
  return (config.DEMI_PROJECTS_PATH || '').trim().replace(/\/+$/, '');
}

/**
 * Whether bulk (and presigned single) download is offered. The routes live on the DEMI search base,
 * so an empty SEARCH_API_PATH means no DEMI at all: hide the UI and fall back to eagle-api.
 */
export function bulkDownloadEnabled(): boolean {
  return !!config.SEARCH_API_PATH;
}

/**
 * eagle-notify API base, without a trailing slash. The subscribe form posts to
 * `${base}/api/subscriptions`. Empty when unset, which hides the subscribe control.
 */
export function getNotifyApi(): string {
  return (config.NOTIFY_API || '').trim().replace(/\/+$/, '');
}

/** Whether the Document Content search tab is offered. Only a literal `true` turns it on. */
export function contentSearchEnabled(): boolean {
  return config.CONTENT_SEARCH === true;
}

export function adminUrl(): string {
  return config.ADMIN_PATH || 'http://localhost:4200/admin/';
}

export function env(): string {
  return config.ENVIRONMENT || 'local';
}

/** An empty string is a deliberate "no colour", which hides the environment banner. */
export function bannerColour(): string {
  return config.BANNER_COLOUR ?? 'red';
}

export function surveyUrl(): string | null {
  return config.SURVEY_URL || null;
}

export function showSurveyBanner(): boolean {
  return config.SHOW_SURVEY_BANNER ?? false;
}

/**
 * Fetch remote config and merge it over env.js.
 *
 * `/api/config` (eagle-api, from its Mongo `Config` document) is the source of truth. A failure is
 * retried, then thrown: env.js ships ACCESS_GATE false and no search path, so falling back to it
 * would open the access curtain and point search at the wrong backend.
 *
 * CONFIG_PATH, when set, is asked first — one attempt, same 5 s budget — and anything short of a
 * whole payload logs once and falls through to the loop below.
 */
const CONFIG_ATTEMPTS = 3;
const CONFIG_TIMEOUT_MS = 5000;
const EAGLE_CONFIG_PATH = '/api/config';

/**
 * A remote payload is usable only whole. Merging a partial one over env.js would leave
 * ACCESS_GATE false and open the curtain, so a body missing either marker is treated as a failure.
 */
function isWholeConfig(payload: unknown): payload is EnvConfig {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as EnvConfig;
  return !!candidate.ENVIRONMENT && typeof candidate.ACCESS_GATE === 'boolean';
}

async function fetchConfigFrom(path: string): Promise<EnvConfig> {
  const response = await fetch(path, { signal: AbortSignal.timeout(CONFIG_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function merge(remote: EnvConfig): void {
  config = { ...config, ...remote };
  if (import.meta.env.DEV && config.logLevel === 0) {
    console.log('config: merged with API config:', config);
  }
}

async function fetchRemoteConfig(): Promise<void> {
  const configPath = (config.CONFIG_PATH || '').trim();
  if (configPath) {
    try {
      const remote = await fetchConfigFrom(configPath);
      if (!isWholeConfig(remote)) {
        throw new Error('payload is missing ENVIRONMENT or a boolean ACCESS_GATE');
      }
      merge(remote);
      return;
    } catch (e) {
      logger.error(`config: ${configPath} failed, using ${EAGLE_CONFIG_PATH}`, 'config', e);
    }
  }

  for (let attempt = 1; ; attempt++) {
    try {
      merge(await fetchConfigFrom(EAGLE_CONFIG_PATH));
      return;
    } catch (e) {
      console.error(
        `config: ${EAGLE_CONFIG_PATH} attempt ${attempt} of ${CONFIG_ATTEMPTS} failed:`,
        e,
      );
      if (attempt >= CONFIG_ATTEMPTS) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}
