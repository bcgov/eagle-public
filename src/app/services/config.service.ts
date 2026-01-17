import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { ApiService } from 'app/services/api';
import { Observable, ReplaySubject } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { LoadingStateService } from './loading-state.service';

//
// This service/class provides a centralized place to persist config values
// (eg, to share values between multiple components).
//

@Injectable({providedIn:'root'})
export class ConfigService {
  private api = inject(ApiService);
  private loadingState = inject(LoadingStateService);


  // defaults
  private _isApplistListVisible = false;
  private _isApplistFiltersVisible = false;
  private _listPageSize = 10;
  private _lists = [];
  private _lists$ = new ReplaySubject<any>(1);

  // TODO: store these in URL instead
  private _baseLayerName = 'World Topographic'; // NB: must match a valid base layer name
  private _mapBounds: L.LatLngBounds | null = null;

  constructor() {
    this.initializeLists();
  }

  private initializeLists(): void {
    const loadingId = 'config-lists';
    this.loadingState.startLoading(loadingId, 'Loading configuration');
    
    this.api.getFullDataSet('List', 250)
      .pipe(
        take(1),
        map(res => {
          if (res) {
            this._lists = res[0].searchResults;
            this.loadingState.stopLoading(loadingId);
            return this._lists;
          }
          this.loadingState.stopLoading(loadingId);
          return null;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      )
      .subscribe(lists => {
        this._lists$.next(lists);
      });
  }

  // called by app constructor
  public init() {
    // FUTURE: load settings from window.localStorage ?
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

  get mapBounds(): L.LatLngBounds | null { return this._mapBounds; }
  set mapBounds(val: L.LatLngBounds | null) { this._mapBounds = val; }

}
