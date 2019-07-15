import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';

import { ApiService } from './api';
import { Feature } from 'app/models/feature';

@Injectable()
export class FeatureService {

  constructor(private api: ApiService) { }

  getByDTID(tantalisId: number): Observable<Feature[]> {
    return this.api.getFeaturesByTantalisId(tantalisId)
      .map((res: any) => {
        const features = res.text() ? res.json() : [];
        features.forEach((feature, index) => {
          feature[index] = new Feature(feature);
        });
        return features;
      })
      .catch(this.api.handleError);
  }

  getByApplicationId(applicationId: string): Observable<Feature[]> {
    return this.api.getFeaturesByApplicationId(applicationId)
      .map((res: any) => {
        const features = res.text() ? res.json() : [];
        features.forEach((feature, index) => {
          feature[index] = new Feature(feature);
        });
        return features;
      })
      .catch(this.api.handleError);
  }

  // MBL TODO: PUT/POST/DELETE functionality.
}
