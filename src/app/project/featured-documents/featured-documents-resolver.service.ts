import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';

@Injectable()
export class FeaturedDocumentsResolverService implements Resolve<void> {
  private tableId = 'featuredDocuments';
  constructor(
    private tableService: TableService
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.tableService.clearTable(this.tableId);
    const projId = route.parent.paramMap.get('projId');
    this.tableService.initTableData(this.tableId);
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      '',
      'Document',
      [{ 'name': 'project', 'value': projId }],
      1,
      5,
      '-datePosted',
      { documentSource: 'PROJECT', isFeatured: 'true' },
      false,
      '+displayName'
    ));
  }
}
