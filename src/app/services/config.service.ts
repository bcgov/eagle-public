import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, ReplaySubject, firstValueFrom, timeout } from 'rxjs';
import { LoadingStateService } from './loading-state.service';

interface EnvConfig {
  logLevel?: number;
  LOG_LEVEL?: number;  // From /api/config
  configEndpoint?: boolean;
  ENVIRONMENT?: string;
  BANNER_COLOUR?: string;
  API_PATH?: string;
  API_LOCATION?: string;
  ADMIN_PATH?: string;
  SURVEY_URL?: string | null;
  SHOW_SURVEY_BANNER?: boolean;
  ANALYTICS_API_URL?: string | null;
  ANALYTICS_DEBUG?: boolean;
  ANALYTICS_ENHANCED_TRACKING?: boolean;
  ANALYTICS_TRAFFIC_TRACKING?: boolean;
  GH_HASH?: string;
}

// env.js sets window.__env before Angular loads (via script tag in index.html)
declare global {
  interface Window { __env: EnvConfig; }
}

/**
 * Configuration Service
 * 
 * Manages application configuration with two modes:
 * 
 * LOCAL DEV (configEndpoint = false):
 *   - Uses values from src/env.js directly
 *   - API calls use relative paths through Angular proxy (proxy.conf.json)
 *   - proxy.conf.json routes /api/* to the dev API server
 * 
 * DEPLOYED (configEndpoint = true):
 *   - env.js is modified by Dockerfile: sed changes configEndpoint to true
 *   - Fetches config from /api/config endpoint
 *   - API config values override env.js defaults
 *   - nginx routes /api/* to the API server
 */
@Injectable({providedIn:'root'})
export class ConfigService {
  private http = inject(HttpClient);
  private loadingState = inject(LoadingStateService);

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

  // Map state (TODO: store these in URL instead)
  private _baseLayerName = 'World Topographic';
  private _mapBounds: any = null;

  /**
   * Initialize the Config Service.
   * 
   * Flow:
   * 1. Load env.js values (already set on window.__env before Angular loads)
   * 2. If configEndpoint=true (deployed), fetch config from /api/config
   * 3. Load lists from API
   */
  public async init(): Promise<void> {
    const loadingId = 'config-init';
    this.loadingState.startLoading(loadingId, 'Loading configuration');

    try {
      // Step 1: Start with env.js values (loaded before Angular via script tag)
      this._config.set({ ...(window.__env || {}) });
      
      if (this._config().logLevel === 0) {
        console.log('ConfigService: env.js values:', this._config());
      }

      // Step 2: If deployed (configEndpoint=true), fetch config from API
      if (this._config().configEndpoint === true) {
        try {
          const apiConfig = await this.getConfigFromApi();
          // Merge: API values override env.js values
          this._config.set({ ...this._config(), ...apiConfig });
          if (this._config().logLevel === 0) {
            console.log('ConfigService: merged with API config:', this._config());
          }
        } catch (e) {
          console.error('ConfigService: API config failed, using env.js defaults:', e);
        }
      }
      
      this.configLoaded = true;
      
      // Step 3: Load lists from API (uses proxy in local, nginx in deployed)
      await this.loadLists();
      
    } catch (error) {
      console.error('ConfigService: initialization error:', error);
      this.configLoaded = true; // Mark as loaded even on error so app can continue
    } finally {
      this.loadingState.stopLoading(loadingId);
    }
  }

  /**
   * Get the API path for making API calls.
   * 
   * LOCAL DEV (configEndpoint=false): Returns full URL (API_LOCATION + API_PATH)
   * DEPLOYED (configEndpoint=true): Returns relative path (rproxy handles routing)
   */
  public getApiPath(): string {
    const config = this._config();
    const apiPath = config.API_PATH || '/api';
    
    // If LOCAL DEV (configEndpoint=false) and API_LOCATION is set, use full URL
    // This allows local dev to hit remote APIs directly
    if (config.configEndpoint === false && config.API_LOCATION) {
      return config.API_LOCATION + apiPath;
    }
    
    // Deployed: use relative path (rproxy routes /api/* to eagle-api)
    return apiPath;
  }

  /**
   * Load lists from API.
   * Lists are used for dropdowns/filters throughout the app.
   */
  private async loadLists(): Promise<void> {
    try {
      const apiPath = this.getApiPath();
      const response = await firstValueFrom(
        this.http.get<any>(`${apiPath}/search?pageSize=250&dataset=List`)
          .pipe(timeout(10000)) // 10 second timeout for lists
      );
      if (response && response[0]) {
        this._lists = response[0].searchResults;
        this._lists$.next(this._lists);
      }
    } catch (error) {
      console.warn('ConfigService: Failed to load lists:', error);
      // Continue without lists - they'll be empty but app will work
      this._lists$.next([]);
    }
  }

  /**
   * Fetch configuration from /api/config.
   * Only called when configEndpoint=true (deployed environments).
   * nginx serves this from ConfigMap (no eagle-api dependency).
   * Retries with fibonacci backoff, times out to prevent blocking.
   */
  private async getConfigFromApi(): Promise<EnvConfig> {
    let n1 = 0;
    let n2 = 1;
    let attempts = 0;
    const maxAttempts = 3;
    const requestTimeoutMs = 5000; // 5 second timeout per attempt
    
    while (attempts < maxAttempts) {
      try {
        // Fetch config from nginx-served ConfigMap
        // No Authorization header needed - public endpoint
        const response = await firstValueFrom(
          this.http.get<EnvConfig>('/api/config', { observe: 'response' })
            .pipe(timeout(requestTimeoutMs))
        );
        return response.body || {};
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn(`ConfigService: Config fetch failed after ${maxAttempts} attempts`);
          throw err;
        }
        console.warn(`ConfigService: Config fetch attempt ${attempts}/${maxAttempts} failed, retrying...`);
        const delay = n1 + n2;
        await this.delay(delay * 1000);
        n1 = n2;
        n2 = delay;
      }
    }
    throw new Error('Failed to load config from /api/config');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  get logLevel(): number {
    // Can be overridden by js console
    return window.__env?.logLevel ?? 4;
  }

  // Note: config is now exposed as a computed signal above
  // Components should use configService.config().PROPERTY to get reactive updates

  get isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  // called by app constructor - for future use
  public destroy() {
    // FUTURE: save settings to window.localStorage ?
  }

  get lists(): Observable<any> {
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
