import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { SearchService } from 'app/services/search.service';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';

@Injectable()
export class ProjectActivitiesResolver implements Resolve<Observable<object>> {
  constructor(
    private searchService: SearchService,
    private tableTemplateUtils: TableTemplateUtils
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<object> {
    let tableParams = this.tableTemplateUtils.getParamsFromUrl(route.params);
    if (tableParams.sortBy === '-datePosted') {
      tableParams.sortBy = '-dateAdded';
    }
    const projId = route.parent.paramMap.get('projId');
    return this.searchService.getSearchResults(
      tableParams.keywords,
      'RecentActivity',
      [],
      tableParams.currentPage,
      tableParams.pageSize,
      tableParams.sortBy,
      { project: projId },
      true,
      tableParams.sortBy);
  }
}
