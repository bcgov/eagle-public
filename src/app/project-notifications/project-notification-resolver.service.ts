import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { SearchService } from 'app/services/search.service';

@Injectable()
export class ProjectNotificationResolver implements Resolve<Observable<object>> {
  constructor(
    private searchService: SearchService
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<object> {
    return this.searchService.getSearchResults(
      null,
      'ProjectNotification',
      null,
      1,
      10000,
      '-_id',
      {_id: route.params.projId}
    );
  }
}
