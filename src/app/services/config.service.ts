import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, firstValueFrom } from 'rxjs';

export interface EnvConfig {
  logLevel?: number;
  configEndpoint?: boolean;
  ENVIRONMENT?: string;
  BANNER_COLOUR?: string;
  API_PATH?: string;
  API_LOCATION?: string;
  /**
   * Base URL for Project/Document/DocumentChunk search, when it is served by eagle-search
   * (Azure AI Search) rather than eagle-api. Absolute, e.g.
   * https://eagle-search-api-dev.azurewebsites.net — unlike API_PATH this cannot be relative,
   * because the service is a different origin.
   *
   * EMPTY OR UNSET FALLS BACK TO eagle-api, and that is also the kill switch: clear the setting in
   * the nginx ConfigMap and search reverts with no redeploy.
   */
  SEARCH_API_PATH?: string;
  ADMIN_PATH?: string;
  SURVEY_URL?: string | null;
  SHOW_SURVEY_BANNER?: boolean;
  ANALYTICS_API_URL?: string | null;
  ANALYTICS_DEBUG?: boolean;
  ANALYTICS_ENHANCED_TRACKING?: boolean;
  ANALYTICS_TRAFFIC_TRACKING?: boolean;
  GH_HASH?: string;
  /**
   * Azure preview only. Puts a passphrase prompt in front of the app — obfuscation, not access
   * control; see `preview-gate.component.ts` for why that is the right size of tool here.
   */
  PREVIEW_GATE?: boolean;
  PREVIEW_GATE_PASSPHRASE?: string;
}

// env.js sets window.__env before Angular loads (via script tag in index.html)
declare global {
  interface Window { __env: EnvConfig; }
}

/**
 * Configuration Service
 *
 * LOCAL DEV (configEndpoint = false):
 *   - Uses env.js values directly (src/env.js)
 *   - proxy.conf.js reads API_LOCATION from env.js to generate dev server proxy rules
 *   - App uses relative paths (/api, /analytics) — never API_LOCATION directly
 *
 * DEPLOYED (configEndpoint = true):
 *   - Dockerfile sed sets configEndpoint to true
 *   - App fetches /api/config on startup (nginx serves it from ConfigMap)
 *   - ConfigMap values override env.js
 *
 * Lists (filter dropdowns) are lazy-loaded on first subscription, not during init.
 */
@Injectable({providedIn:'root'})
export class ConfigService {
  private http = inject(HttpClient);

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
   * 2. If deployed (configEndpoint=true), fetch and merge /api/config before returning
   *
   * Must be awaited so that dependent services (analytics, Keycloak) initialize
   * with the correct environment-specific values from the API config.
   */
  public async init(): Promise<void> {
    // Step 1: Start with env.js values (loaded before Angular via script tag)
    this._config.set({ ...(window.__env || {}) });

    if (this._config().logLevel === 0) {
      console.log('ConfigService: env.js values:', this._config());
    }

    // Step 2: If deployed (configEndpoint=true), await config from API before continuing
    if (this._config().configEndpoint === true) {
      await this.fetchRemoteConfig();
    }

    this.configLoaded = true;
  }

  /**
   * Get the API path for making API calls.
   * Always relative — proxy.conf.js (local) or rproxy (deployed) handles routing.
   */
  public getApiPath(): string {
    return this._config().API_PATH || '/api';
  }

  /**
   * Base URL for search, when it is served by eagle-search. Falls back to the eagle-api path, so an
   * unconfigured environment keeps working unchanged.
   */
  public getSearchApiPath(): string {
    return this._config().SEARCH_API_PATH || this.getApiPath();
  }

  /**
   * Fetch remote config from /api/config (deployed only, non-blocking).
   * nginx serves this from ConfigMap — fast and reliable.
   * On success, merges over env.js values. On failure, env.js defaults stand.
   */
  private async fetchRemoteConfig(): Promise<void> {
    try {
      const response = await fetch('/api/config', {
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const apiConfig: EnvConfig = await response.json();
      this._config.set({ ...this._config(), ...apiConfig });
      if (this._config().logLevel === 0) {
        console.log('ConfigService: merged with API config:', this._config());
      }
    } catch (e) {
      console.error('ConfigService: API config fetch failed, using env.js defaults:', e);
    }
  }

  private async loadLists(): Promise<void> {
    try {
      const url = `${this.getApiPath()}/search?pageSize=250&dataset=List`;
      const data = await firstValueFrom(this.http.get<any[]>(url));
      this._lists = data?.[0]?.searchResults ?? [];
      this._lists$.next(this._lists);
    } catch (error) {
      console.error('ConfigService: Failed to load lists:', error);
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
