import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { ApiService } from 'app/services/api';
import { Observable, of } from 'rxjs';

//
// This service/class provides a centralized place to persist config values
// (eg, to share values between multiple components).
//

@Injectable()
export class ConfigService {

  // defaults
  private _isApplistListVisible = false;
  private _isApplistFiltersVisible = false;
  private _listPageSize = 10;
  private _lists = [];

  // TODO: store these in URL instead
  private _baseLayerName = 'World Topographic'; // NB: must match a valid base layer name
  private _mapBounds: L.LatLngBounds = null;

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
    if (this._lists.length === 0) {
      return this.api.getFullDataSet('List')
        .map(res => {
          if (res) {
            this._lists = res[0].searchResults;
            return this._lists;
          }
          return null;
        })
        .catch(error => this.api.handleError(error));
    } else {
      return of(this._lists);
    }
  }

  get isApplistListVisible(): boolean { return this._isApplistListVisible; }
  set isApplistListVisible(val: boolean) { this._isApplistListVisible = val; }

  get isApplistFiltersVisible(): boolean { return this._isApplistFiltersVisible; }
  set isApplistFiltersVisible(val: boolean) { this._isApplistFiltersVisible = val; }

  get listPageSize(): number { return this._listPageSize; }
  set listPageSize(val: number) { this._listPageSize = val; }

  get baseLayerName(): string { return this._baseLayerName; }
  set baseLayerName(val: string) { this._baseLayerName = val; }

  get mapBounds(): L.LatLngBounds { return this._mapBounds; }
  set mapBounds(val: L.LatLngBounds) { this._mapBounds = val; }

}
