import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { Constants } from 'app/shared/utils/constants';

@Injectable()
export class ProjectActivitiesResolver implements Resolve<void> {
  private tableId = 'projectActivities';
  constructor(
    private tableService: TableService,
    private tableTemplateUtils: TableTemplate
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.tableService.clearTable(this.tableId);

    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject(), 'Activities');

    if (!params.sortBy) {
      tableObject.sortBy = '-dateAdded';
    }

    let keywords = '';
    params.keywordsActivities ?
      (keywords = params.keywordsActivities) :
      (keywords = Constants.tableDefaults.DEFAULT_KEYWORDS);

    const projId = route.parent.paramMap.get('projId');

    this.tableService.initTableData(this.tableId);
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
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
