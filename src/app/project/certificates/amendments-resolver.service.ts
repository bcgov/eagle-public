import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { SearchService } from 'app/services/search.service';
import { ConfigService } from 'app/services/config.service';
import { Utils } from 'app/shared/utils/utils';

@Injectable()
export class AmendmentsResolverService implements Resolve<Observable<object>> {
  constructor(
    private searchService: SearchService,
    private configService: ConfigService,
    private utils: Utils
  ) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<object> {
    const projectId = route.parent.paramMap.get('projId');
    const currentPage = route.params.currentPage ? route.params.currentPage : 1;
    const pageSize = route.params.pageSize ? route.params.pageSize : 10;
    const sortBy = route.params.sortBy && route.params.sortBy !== 'null' ? route.params.sortBy : '-datePosted';
    const keywords = route.params.keywords;

    return this.configService.lists.switchMap (list => {
      const tabModifier = this.utils.createProjectTabModifiers(list);
      return this.searchService.getSearchResults(
        keywords,
        'Document',
        [{ 'name': 'project', 'value': projectId }],
        currentPage,
        pageSize,
        sortBy,
        tabModifier.AMENDMENT,
        true,
        ''
      );
    });
  }
}
