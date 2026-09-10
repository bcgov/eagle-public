import { logger } from './logging';

export interface EnvConfig {
  logLevel?: number;
  LOG_LEVEL?: number;
  configEndpoint?: boolean;
  /**
   * Where the runtime config itself comes from, when `configEndpoint` is true. It is the only
   * source: empty or unset means `DEFAULT_CONFIG_PATH` below. The body is accepted only whole, and
   * a failure is fatal rather than a fall back to env.js. Read from env.js before any remote merge,
   * so overriding it needs a redeploy of env.js.
   */
  CONFIG_PATH?: string;
  ENVIRONMENT?: string;
  BANNER_COLOUR?: string;
  API_LOCATION?: string;
  /**
   * Base URL for demi-search, which answers every read the app makes: search, item reads, the
   * access gate and document downloads.
   *
   * Normally RELATIVE — `/demi-search` — because rproxy proxies that location to the DEMI host,
   * which keeps the call same-origin and needs no CORS. Absolute (`https://…`) only where there is
   * no rproxy in front. Empty or unset means `/demi-search`; there is no second backend to fall
   * back to.
   */
  SEARCH_API_PATH?: string;
  /**
   * Base path for DEMI project documents: `GET <path>/<eagleProjectId>` answers the project, whose
   * `phases` array carries the assessment rail's per-phase dates. Empty or unset means
   * `/demi-projects`.
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
   * prod (false or unset) renders unchanged. demi-search checks the password; see state/gate.ts.
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
   * from the runtime config like SEARCH_API_PATH, so it turns on with no redeploy.
   */
  EAGLE_ANALYTICS_URL?: string;
  /**
   * Azure Application Insights connection string for browser error reporting. Empty or unset
   * sends nothing and loads no SDK. Served from the runtime config like SEARCH_API_PATH.
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
 *   - App uses relative paths (/demi-search) — never API_LOCATION directly
 *
 * DEPLOYED (configEndpoint = true):
 *   - The Azure deploy workflows sed configEndpoint to true
 *   - App fetches CONFIG_PATH (`/demi-search/config` unless env.js overrides it) on startup;
 *     see fetchRemoteConfig
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
 * Base URL for demi-search — search, item reads, the gate and downloads all hang off it.
 * Always relative — the dev server proxy (local) or rproxy (deployed) handles routing.
 */
export function getSearchApiPath(): string {
  return config.SEARCH_API_PATH || DEFAULT_SEARCH_API_PATH;
}

/** DEMI project base path, without a trailing slash. */
export function getDemiProjectsPath(): string {
  return (config.DEMI_PROJECTS_PATH || DEFAULT_DEMI_PROJECTS_PATH).trim().replace(/\/+$/, '');
}

/** Whether bulk (and presigned single) download is offered. demi-api always serves it. */
export function bulkDownloadEnabled(): boolean {
  return true;
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

/** Origin of API_LOCATION — the rproxy host. Empty when unset or unparsable. */
function apiOrigin(): string {
  const location = (config.API_LOCATION || '').trim();
  if (!location) return '';
  try {
    return new URL(location).origin;
  } catch {
    return '';
  }
}

/**
 * Where eagle-admin lives.
 *
 * The runtime config serves ADMIN_PATH relative (`/admin/`) because rproxy fronts eagle-admin and the
 * public app on one host. The Azure-hosted public site and the Vite dev server are NOT that host,
 * so a relative path there resolves to the public app itself, whose wildcard route sends the
 * visitor back to `/`. Resolve a relative path against API_LOCATION's origin instead. An absolute
 * ADMIN_PATH is already a full URL and passes through; with no API_LOCATION to resolve against,
 * the relative path is left alone.
 */
export function adminUrl(): string {
  const path = config.ADMIN_PATH;
  if (!path) return 'http://localhost:4200/admin/';
  if (!path.startsWith('/')) return path;

  const origin = apiOrigin();
  return origin ? new URL(path, origin).href : path;
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
 * CONFIG_PATH — `/demi-search/config` unless env.js names another — is the only source of truth.
 * A failure is retried, then thrown: env.js ships ACCESS_GATE false, so booting on it would open
 * the access curtain. main.tsx turns that throw into the "temporarily unavailable" page.
 */
const CONFIG_ATTEMPTS = 3;
const CONFIG_TIMEOUT_MS = 5000;
const DEFAULT_SEARCH_API_PATH = '/demi-search';
const DEFAULT_DEMI_PROJECTS_PATH = '/demi-projects';
/** Lives here, not in env.js, so an empty env.js still boots against DEMI. */
const DEFAULT_CONFIG_PATH = `${DEFAULT_SEARCH_API_PATH}/config`;

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
  const configPath = (config.CONFIG_PATH || '').trim() || DEFAULT_CONFIG_PATH;

  for (let attempt = 1; ; attempt++) {
    try {
      const remote = await fetchConfigFrom(configPath);
      if (!isWholeConfig(remote)) {
        throw new Error('payload is missing ENVIRONMENT or a boolean ACCESS_GATE');
      }
      merge(remote);
      return;
    } catch (e) {
      logger.error(
        `config: ${configPath} attempt ${attempt} of ${CONFIG_ATTEMPTS} failed`,
        'config',
        e,
      );
      if (attempt >= CONFIG_ATTEMPTS) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}
