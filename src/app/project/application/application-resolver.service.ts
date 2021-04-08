import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { ConfigService } from 'app/services/config.service';
import { Utils } from 'app/shared/utils/utils';
import { Constants } from 'app/shared/utils/constants';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { DocumentService } from 'app/services/document.service';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { SearchParamObject } from 'app/services/search.service';

@Injectable()
export class ApplicationResolver implements Resolve<void> {
  constructor(
    private documentService: DocumentService,
    private tableTemplateUtils: TableTemplate,
    private configService: ConfigService,
    private utils: Utils
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.documentService.clearValue();
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2());
    if (!params.sortBy) {
      tableObject.sortBy = '+sortOrder,-datePosted,+displayName';
    }

    const projId = route.parent.paramMap.get('projId');
    this.configService.lists.toPromise().then(async (list) => {
      this.documentService.fetchData(new SearchParamObject(
        '',
        'Document',
        [{ 'name': 'project', 'value': projId }],
        tableObject.currentPage,
        tableObject.pageSize,
        tableObject.sortBy,
        this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.APPLICATION, list)
      ));
    });
  }
}
