import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';

import { FeaturedDocumentsService } from 'app/services/featured-documents.service';

@Injectable()
export class FeaturedDocumentsResolverService implements Resolve<void> {
  constructor(
    private featuredDocumentsService: FeaturedDocumentsService,
  ) { }

  async resolve(route: ActivatedRouteSnapshot) {
    // This will always grab defaults for tableObject
    // URL is never set for featured documents

    const projId = route.parent.paramMap.get('projId');

    await this.featuredDocumentsService.fetchData(
      '',
      1,
      5,
      '-dateAdded',
      projId
    );
  }
}
