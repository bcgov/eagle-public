import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableService } from 'app/services/table.service';

@Injectable()
export class SearchResolver implements Resolve<void> {
  private tableId = 'search';
  constructor(
    private tableService: TableService,
    private tableTemplateUtils: TableTemplate
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.tableService.clearTable(this.tableId);
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject());

    let keywords = '';
    params.keywords ?
      (keywords = params.keywords) :
      (keywords = Constants.tableDefaults.DEFAULT_KEYWORDS);

    const filtersForAPI = this.tableTemplateUtils.getFiltersFromParams(
      params,
      ['milestone', 'documentAuthorType', 'type', 'projectPhase']
    );

    const dateFiltersForAPI = this.tableTemplateUtils.getDateFiltersFromParams(
      params,
      ['datePostedStart', 'datePostedEnd']
    );

    this.tableService.initTableData(this.tableId);
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      keywords,
      'Document',
      [],
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      { documentSource: 'PROJECT' },
      true,
      '',
      { ...filtersForAPI, ...dateFiltersForAPI },
      '',
      true
    ));
  }
}
