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

    // mongoDB id's include a timestamp, so you can use them for sorting
    // you can extract the timestamp value with:
    // new Date(parseInt(objectId.substring(0, 8), 16) * 1000)
    // or create an ObjectId from a Date with:
    // Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";

    return this.searchService.getSearchResults(
      null,
      'ProjectNotification',
      null,
      1,
      10000,
      '-_id',
      queryConditions
    );
  }
}
