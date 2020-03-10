import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { SearchService } from 'app/services/search.service';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';

@Injectable()
export class ProjectNotificationsResolver implements Resolve<Observable<object>> {
  constructor(
    private searchService: SearchService,
    private tableTemplateUtils: TableTemplateUtils
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<object> {
    let tableParams = this.tableTemplateUtils.getParamsFromUrl(route.params);

    const type = route.params.type ? route.params.type : null;
    const region =  route.params.region ? route.params.region : null;
    const pcpStatus = route.params.pcp ? route.params.pcp : null;

    let queryConditions = {};

    if (type) {
      queryConditions['type'] = type;
    }

    if (region) {
      queryConditions['region'] = region;
    }

    if (pcpStatus) {
      queryConditions['pcp'] = pcpStatus;
    }

    return this.searchService.getSearchResults(
      null,
      'ProjectNotification',
      null,
      1,
      10000,
      '-decisionDate',
      queryConditions
    );
  }
}
