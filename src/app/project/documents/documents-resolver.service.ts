import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import 'rxjs/add/operator/switchMap';

import * as _ from 'lodash';

import { DocumentService } from 'app/services/document.service';
import { Constants } from 'app/shared/utils/constants';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';

@Injectable()
export class DocumentsResolver implements Resolve<void> {

  private filterForAPI: object = {};

  constructor(
    private documentService: DocumentService,
    private tableTemplateUtils: TableTemplate
  ) { }

  async resolve(route: ActivatedRouteSnapshot) {
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2());

    let keywords = '';
    params.keywords ?
      (keywords = params.keywords) :
      (keywords = Constants.tableDefaults.DEFAULT_KEYWORDS);
    if (params.milestone) {
      Array.isArray(params.milestone) ?
        (this.filterForAPI['milestone'] = params.milestone.join()) :
        (this.filterForAPI['milestone'] = params.milestone);
    }
    if (params.documentAuthorType) {
      Array.isArray(params.documentAuthorType) ?
        (this.filterForAPI['documentAuthorType'] = params.documentAuthorType.join()) :
        (this.filterForAPI['documentAuthorType'] = params.documentAuthorType);
    }
    if (params.type) {
      Array.isArray(params.type) ?
        (this.filterForAPI['type'] = params.type.join()) :
        (this.filterForAPI['type'] = params.type);
    }
    if (params.projectPhase) {
      Array.isArray(params.projectPhase) ?
        (this.filterForAPI['projectPhase'] = params.projectPhase.join()) :
        (this.filterForAPI['projectPhase'] = params.projectPhase);
    }

    if (params.datePostedStart) {
      this.filterForAPI['datePostedStart'] = params.datePostedStart;
    }
    if (params.datePostedEnd) {
      this.filterForAPI['datePostedEnd'] = params.datePostedEnd;
    }

    const projId = route.parent.paramMap.get('projId');

    await this.documentService.fetchData(
      keywords,
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      projId,
      this.filterForAPI,
      { documentSource: 'PROJECT' }
    );
  }
}
