import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { FeaturedDocumentsService } from 'app/services/featured-documents.service';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';

@Injectable()
export class FeaturedDocumentsResolverService implements Resolve<void> {
  constructor(
    private featuredDocumentsService: FeaturedDocumentsService,
    private tableTemplateUtils: TableTemplate
  ) { }

  async resolve(route: ActivatedRouteSnapshot) {
    const params = route.queryParamMap['params'];
    // This will always grab defaults for tableObject
    // URL is never set for featured documents
    const tableObject = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject2(), 'Docs');

    const projId = route.parent.paramMap.get('projId');

    await this.featuredDocumentsService.fetchData(
      '',
      tableObject.currentPage,
      tableObject.pageSize,
      tableObject.sortBy,
      projId
    );
  }
}
