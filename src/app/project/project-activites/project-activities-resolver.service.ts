import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { ActivitiesService } from 'app/services/activities.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { Constants } from 'app/shared/utils/constants';

@Injectable()
export class ProjectActivitiesResolver implements Resolve<void> {
  constructor(
    private activitiesService: ActivitiesService,
    private tableTemplateUtils: TableTemplate
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.activitiesService.clearValue();
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2(), 'Activities');

    if (!params.sortBy) {
      tableObject.sortBy = '-dateAdded';
    }

    let keywords = '';
    params.keywordsActivities ?
      (keywords = params.keywordsActivities) :
      (keywords = Constants.tableDefaults.DEFAULT_KEYWORDS);

    const projId = route.parent.paramMap.get('projId');

    this.activitiesService.fetchData(new SearchParamObject(
      keywords,
      'RecentActivity',
      [],
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      { project: projId },
      true
    ));
  }
}
