export interface EnvConfig {
  logLevel?: number;
  LOG_LEVEL?: number;
  configEndpoint?: boolean;
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
  ANALYTICS_API_URL?: string | null;
  ANALYTICS_DEBUG?: boolean;
  ANALYTICS_ENHANCED_TRACKING?: boolean;
  ANALYTICS_TRAFFIC_TRACKING?: boolean;
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
 *   - App uses relative paths (/api, /analytics) — never API_LOCATION directly
 *
 * DEPLOYED (configEndpoint = true):
 *   - The Azure deploy workflows sed configEndpoint to true
 *   - App fetches /api/config on startup. rproxy proxies that to eagle-api, which serves it from
 *     its Mongo `Config` document.
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
 * Fetch remote config from /api/config (deployed only) and merge it over env.js. A failure is
 * retried, then thrown: env.js ships ACCESS_GATE false and no search path, so falling back to it
 * would open the access curtain and point search at the wrong backend.
 */
const CONFIG_ATTEMPTS = 3;

async function fetchRemoteConfig(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch('/api/config', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const apiConfig: EnvConfig = await response.json();
      config = { ...config, ...apiConfig };
      if (import.meta.env.DEV && config.logLevel === 0) {
        console.log('config: merged with API config:', config);
      }
      return;
    } catch (e) {
      console.error(`config: /api/config attempt ${attempt} of ${CONFIG_ATTEMPTS} failed:`, e);
      if (attempt >= CONFIG_ATTEMPTS) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/** Dropdown/filter list items, lazily fetched and cached by TanStack Query. */
export function listsQueryOptions() {
  return {
    queryKey: ['lists'],
    queryFn: async (): Promise<any[]> => {
      const response = await fetch(`${getApiPath()}/search?pageSize=250&dataset=List`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data?.[0]?.searchResults ?? [];
    },
  };
}
