import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { TableService } from 'app/services/table.service';

@Injectable()
export class ProjectNotificationsResolver implements Resolve<void> {
  private tableId = 'notificationProject'
  constructor(
    private tableService: TableService,
    private tableTemplateUtils: TableTemplate
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.tableService.clearTable(this.tableId);

    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2());

    if (!params.sortBy) {
      tableObject.sortBy = '-_id';
    }

    let keywords = '';
    params.keywords ?
      (keywords = params.keywords) :
      (keywords = Constants.tableDefaults.DEFAULT_KEYWORDS);

    const filtersForAPI = this.tableTemplateUtils.getFiltersFromParams(
      params,
      ['type', 'region', 'pcp', 'decision']
    );

    this.tableService.initTableData(this.tableId);
    this.tableService.fetchData(new SearchParamObject(
      keywords,
      'ProjectNotification',
      [],
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      filtersForAPI,
      true,
      null,
      {},
      '',
      false,
      this.tableId
    ));
  }
}
