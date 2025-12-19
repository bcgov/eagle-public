import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { ApiService } from 'app/services/api';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

//
// This service/class provides a centralized place to persist config values
// (eg, to share values between multiple components).
//

@Injectable({providedIn:'root'})
export class ConfigService {

  // defaults
  private _isApplistListVisible = false;
  private _isApplistFiltersVisible = false;
  private _listPageSize = 10;
  private _lists = [];
  private _lists$: Observable<any> | null = null;

  // TODO: store these in URL instead
  private _baseLayerName = 'World Topographic'; // NB: must match a valid base layer name
  private _mapBounds: L.LatLngBounds | null = null;

  constructor(private api: ApiService) { }

  // called by app constructor
  public init() {
    // FUTURE: load settings from window.localStorage ?
  }

  // called by app constructor - for future use
  public destroy() {
    // FUTURE: save settings to window.localStorage ?
  }

  get lists(): Observable<any> {
    // If already loaded, return cached array
    if (this._lists.length > 0) {
      return of(this._lists);
    }
    
    // If request is in-flight, return the shared observable
    if (this._lists$) {
      return this._lists$;
    }
    
    // Create new request and cache it
    this._lists$ = this.api.getFullDataSet('List', 250)
      .pipe(
        map(res => {
          if (res) {
            this._lists = res[0].searchResults;
            return this._lists;
          }
          return null;
        }),
        catchError(error => this.api.handleError(error)),
        shareReplay(1) // Share the result with all subscribers
      );
    
    return this._lists$;
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
