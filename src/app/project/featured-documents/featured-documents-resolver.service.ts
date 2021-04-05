import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { DocumentService } from 'app/services/document.service';

import { SearchParamObject } from 'app/services/search.service';

@Injectable()
export class FeaturedDocumentsResolverService implements Resolve<void> {
  constructor(
    private documentService: DocumentService
  ) { }

  resolve(route: ActivatedRouteSnapshot) {
    this.documentService.clearValue();
    const projId = route.parent.paramMap.get('projId');
    this.documentService.fetchData(new SearchParamObject(
      '',
      'Document',
      [{ 'name': 'project', 'value': projId }],
      1,
      5,
      '-datePosted',
      { documentSource: 'PROJECT', isFeatured: 'true' }
    ));
  }
}
