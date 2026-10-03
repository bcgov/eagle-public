import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, firstValueFrom } from 'rxjs';
import { LoggingService } from './logging.service';

export interface EnvConfig {
  logLevel?: number;
  LOG_LEVEL?: number;
  configEndpoint?: boolean;
  /** Runtime config URL when `configEndpoint` is true. Empty or unset reads `/demi-search/config`. */
  CONFIG_PATH?: string;
  ENVIRONMENT?: string;
  BANNER_COLOUR?: string;
  API_PATH?: string;
  API_LOCATION?: string;
  /** demi-search base URL for every public read. Empty or unset reads `/demi-search`. */
  SEARCH_API_PATH?: string;
  /** DEMI single-project base URL. Empty or unset reads `/demi-projects`. */
  DEMI_PROJECTS_PATH?: string;
  /**
   * Shows the Document Content search tab and route. The API serves content search everywhere, so
   * this only decides whether the UI offers it — false or unset hides it, with no redeploy needed
   * to change either way.
   */
  CONTENT_SEARCH?: boolean;
  /**
   * Puts a shared-password curtain in front of the whole app. Only a literal `true` closes it, so
   * prod (false or unset) renders unchanged. demi-search checks the password; see GateService.
   */
  ACCESS_GATE?: boolean;
  ADMIN_PATH?: string;
  /**
   * Ingest base URL for the eagle-analytics client. Empty or unset gives a no-op client, so that is
   * the kill switch for tracking and it flips with no redeploy. Deployed environments get it from
   * the runtime config; it is deliberately absent from env.js, because a value baked in at build time
   * would follow the bundle into every environment.
   */
  EAGLE_ANALYTICS_URL?: string;
  SURVEY_URL?: string | null;
  SHOW_SURVEY_BANNER?: boolean;
  GH_HASH?: string;
}

// env.js sets window.__env before Angular loads (via script tag in index.html)
declare global {
  interface Window { __env: EnvConfig; }
}

const DEFAULT_CONFIG_PATH = '/demi-search/config';
const CONFIG_ATTEMPTS = 3;
// nginx gives up at 11 s on this route, so the browser must abort after nginx, not before.
const CONFIG_TIMEOUT_MS = 12_000;

function isWholeConfig(payload: unknown): payload is EnvConfig {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as EnvConfig;
  return !!candidate.ENVIRONMENT && typeof candidate.ACCESS_GATE === 'boolean';
}

/**
 * Configuration Service
 *
 * LOCAL DEV (configEndpoint = false):
 *   - Uses env.js values directly (src/env.js)
 *   - proxy.conf.js reads API_LOCATION from env.js to generate dev server proxy rules
 *   - App uses relative paths (/api) — never API_LOCATION directly
 *
 * DEPLOYED (configEndpoint = true):
 *   - The Azure deploy workflows sed configEndpoint to true
 *   - App fetches CONFIG_PATH (`/demi-search/config` unless env.js names another) on startup
 *   - Those values override env.js
 *
 * Lists (filter dropdowns) are lazy-loaded on first subscription, not during init.
 */
@Injectable({providedIn:'root'})
export class ConfigService {
  private http = inject(HttpClient);
  private logger = inject(LoggingService);

  // Environment configuration as a signal for reactivity
  private _config = signal<EnvConfig>({});
  private configLoaded = false;

  // Expose config as a computed signal that components can react to
  public readonly config = computed(() => this._config());

  constructor() {
    // Expose ConfigService on window for LoggingService to access
    // (avoids circular dependency since LoggingService can't inject ConfigService)
    (window as any).__configService = this;
  }

  // UI state defaults
  private _isApplistListVisible = false;
  private _isApplistFiltersVisible = false;
  private _listPageSize = 10;
  private _lists: any[] = [];
  private _lists$ = new ReplaySubject<any>(1);
  private _listsRequested = false;

  // Map state (TODO: store these in URL instead)
  private _baseLayerName = 'World Topographic';
  private _mapBounds: any = null;

  /**
   * Initialize the Config Service.
   *
   * 1. Load env.js values (synchronous — already on window.__env)
   * 2. If deployed (configEndpoint=true), fetch and merge the runtime config, or reject
   *
   * Must be awaited so that dependent services (analytics) initialize with the correct
   * environment-specific values.
   */
  public async init(): Promise<void> {
    // Step 1: Start with env.js values (loaded before Angular via script tag)
    this._config.set({ ...(window.__env || {}) });
    this.logger.debug('env.js values', 'config', this._config());

    // Step 2: If deployed (configEndpoint=true), await the runtime config before continuing
    if (this._config().configEndpoint === true) {
      await this.fetchRemoteConfig();
    }

    this.configLoaded = true;
  }

  /**
   * Get the API path for making API calls.
   * Always relative — proxy.conf.js (local) or nginx (deployed) handles routing.
   */
  public getApiPath(): string {
    return this._config().API_PATH || '/api';
  }

  /** Base URL for demi-search. Never eagle-api: it no longer serves public reads. */
  public getSearchApiPath(): string {
    return this._config().SEARCH_API_PATH || '/demi-search';
  }

  /** DEMI project base path, without a trailing slash. */
  public getDemiProjectsPath(): string {
    const path = this._config().DEMI_PROJECTS_PATH;
    return (typeof path === 'string' ? path.trim().replace(/\/+$/, '') : '') || '/demi-projects';
  }

  /** Whether the Document Content search tab is offered. Only a literal `true` turns it on. */
  public contentSearchEnabled(): boolean {
    return this._config().CONTENT_SEARCH === true;
  }

  /**
   * Fetch CONFIG_PATH (`/demi-search/config` unless env.js names another) and merge it over env.js.
   * Retried, then thrown: env.js ships ACCESS_GATE false, so booting on it would open the curtain.
   * The app initializer turns the throw into the "temporarily unavailable" page.
   */
  private async fetchRemoteConfig(): Promise<void> {
    const configPath = (this._config().CONFIG_PATH || '').trim() || DEFAULT_CONFIG_PATH;
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(configPath, { signal: AbortSignal.timeout(CONFIG_TIMEOUT_MS) });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const remote: unknown = await response.json();
        if (!isWholeConfig(remote)) {
          throw new Error('payload is missing ENVIRONMENT or a boolean ACCESS_GATE');
        }
        this._config.set({ ...this._config(), ...remote });
        this.logger.debug('merged with the runtime config', 'config', this._config());
        return;
      } catch (e) {
        this.logger.error(`${configPath} attempt ${attempt} of ${CONFIG_ATTEMPTS} failed`, 'config', e);
        if (attempt >= CONFIG_ATTEMPTS) throw e;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  private async loadLists(): Promise<void> {
    try {
      // The List collection spans both Acts and runs past 250 rows; demi-search caps a page at 1000.
      const url = `${this.getSearchApiPath()}/search?pageSize=1000&dataset=List`;
      const data = await firstValueFrom(this.http.get<any[]>(url));
      this._lists = data?.[0]?.searchResults ?? [];
      const total = data?.[0]?.meta?.[0]?.searchResultsTotal;
      if (typeof total === 'number' && this._lists.length < total) {
        this.logger.warn(`List answered ${this._lists.length} of ${total} rows; the rest are not shown`, 'config');
      }
      this._lists$.next(this._lists);
    } catch (error) {
      this.logger.error('failed to load lists', 'config', error);
      this._lists$.next([]);
    }
  }

  get isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  // called by app constructor - for future use
  public destroy() {
    // FUTURE: save settings to window.localStorage ?
  }

  get lists(): Observable<any> {
    if (!this._listsRequested) {
      this._listsRequested = true;
      this.loadLists();
    }
    return this._lists$.asObservable();
  }

  get isApplistListVisible(): boolean { return this._isApplistListVisible; }
  set isApplistListVisible(val: boolean) { this._isApplistListVisible = val; }

  get isApplistFiltersVisible(): boolean { return this._isApplistFiltersVisible; }
  set isApplistFiltersVisible(val: boolean) { this._isApplistFiltersVisible = val; }

  get listPageSize(): number { return this._listPageSize; }
  set listPageSize(val: number) { this._listPageSize = val; }

  get baseLayerName(): string { return this._baseLayerName; }
  set baseLayerName(val: string) { this._baseLayerName = val; }

  get mapBounds(): any { return this._mapBounds; }
  set mapBounds(val: any) { this._mapBounds = val; }

}
