import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { ConfigService } from 'app/services/config.service';
import { Utils } from 'app/shared/utils/utils';
import { Constants } from 'app/shared/utils/constants';
import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';

@Injectable()
export class AmendmentsResolver implements Resolve<void> {
  private tableId = 'amendments';
  constructor(
    private tableService: TableService,
    private tableTemplateUtils: TableTemplate,
    private configService: ConfigService,
    private utils: Utils
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.tableService.clearTable(this.tableId);
    const params = route.queryParamMap['params'];
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2());
    const projId = route.parent.paramMap.get('projId');
    this.tableService.initTableData(this.tableId);
    this.configService.lists.toPromise().then(async (list) => {
      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        '',
        'Document',
        [{ 'name': 'project', 'value': projId }],
        tableObject.currentPage,
        tableObject.pageSize,
        tableObject.sortBy,
        this.utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.AMENDMENT, list),
        false,
        '+displayName'
      ));
    });
  }
}
