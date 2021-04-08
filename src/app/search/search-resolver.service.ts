import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import 'rxjs/add/operator/switchMap';

import { DocumentService } from 'app/services/document.service';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';

@Injectable()
export class SearchResolver implements Resolve<void> {
  constructor(
    private documentService: DocumentService,
    private tableTemplateUtils: TableTemplate
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.documentService.clearValue();
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2());

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

    this.documentService.fetchData(new SearchParamObject(
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
