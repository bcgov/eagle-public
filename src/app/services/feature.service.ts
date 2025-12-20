import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Feature } from 'app/models/feature';
import { LoadingStateService } from './loading-state.service';

@Injectable({providedIn:'root'})
export class FeatureService {

  constructor(
    private api: ApiService,
    private loadingState: LoadingStateService
  ) { }

  getByDTID(tantalisId: number): Observable<Feature[]> {
    const loadingId = `features-dtid-${tantalisId}`;
    this.loadingState.startLoading(loadingId, 'Loading features');
    return this.api.getFeaturesByTantalisId(tantalisId)
      .pipe(
        map((res: any) => {
          const features = res.text() ? res.json() : [];
          features.forEach((feature: any, index: number) => {
            feature[index] = new Feature(feature);
          });
          this.loadingState.stopLoading(loadingId);
          return features;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  getByApplicationId(applicationId: string): Observable<Feature[]> {
    const loadingId = `features-app-${applicationId}`;
    this.loadingState.startLoading(loadingId, 'Loading features');
    return this.api.getFeaturesByApplicationId(applicationId)
      .pipe(
        map((res: any) => {
          const features = res.text() ? res.json() : [];
          features.forEach((feature: any, index: number) => {
            feature[index] = new Feature(feature);
          });
          this.loadingState.stopLoading(loadingId);
          return features;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // MBL TODO: PUT/POST/DELETE functionality.
}
