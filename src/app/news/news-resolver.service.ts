import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { Constants } from 'app/shared/utils/constants';

@Injectable()
export class NewsResolver implements Resolve<void> {
  private tableId = 'news';
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

    this.tableService.initTableData(this.tableId);
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
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
