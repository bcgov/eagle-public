import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import * as _ from 'lodash';

import { Constants } from 'app/shared/utils/constants';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';

@Injectable()
export class DocumentsResolver implements Resolve<void> {
  private tableId = 'documentsTab';
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

    const projId = route.parent.paramMap.get('projId');

    this.tableService.initTableData(this.tableId);
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      keywords,
      'Document',
      [{ 'name': 'project', 'value': projId }],
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      { documentSource: 'PROJECT' },
      true,
      '+displayName',
      { ...filtersForAPI, ...dateFiltersForAPI }
    ));
  }
}
