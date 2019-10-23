import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { SearchService } from 'app/services/search.service';

@Injectable()
export class CertificatesResolver implements Resolve<Observable<object>> {
  constructor(
    private searchService: SearchService
  ) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<object> {
    const projectId = route.parent.paramMap.get('projId');
    const currentPage = route.params.currentPage ? route.params.currentPage : 1;
    const pageSize = route.params.pageSize ? route.params.pageSize : 10;
    const sortBy = route.params.sortBy && route.params.sortBy !== 'null' ? route.params.sortBy : '+displayName';
    const keywords = route.params.keywords;
    return this.searchService.getSearchResults(
      keywords,
      'Document',
      [{ 'name': 'project', 'value': projectId }],
      currentPage,
      pageSize,
      '',
      sortBy,
      {
        // Search only Certificate Package/EAO/Certificate
        documentSource: 'PROJECT',
        type: '5cf00c03a266b7e1877504d5',
        documentAuthorType: '5cf00c03a266b7e1877504db',
        milestone: '5cf00c03a266b7e1877504eb'
      },
      true);
  }
}
