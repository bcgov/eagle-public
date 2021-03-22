import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { ActivitiesService } from 'app/services/activities.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { Constants } from 'app/shared/utils/constants';

@Injectable()
export class NewsResolver implements Resolve<void> {
  constructor(
    private activitiesService: ActivitiesService,
    private tableTemplateUtils: TableTemplate
  ) { }

  async resolve(route: ActivatedRouteSnapshot) {
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2(), 'Activities');

    if (!params.sortBy) {
      tableObject.sortBy = '-dateAdded';
    }

    await this.activitiesService.fetchData(new SearchParamObject(
      params.keywords ? params.keywords : Constants.tableDefaults.DEFAULT_KEYWORDS,
      'RecentActivity',
      [],
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      {},
      true
    ));
  }
}
