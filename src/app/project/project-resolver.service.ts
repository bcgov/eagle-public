import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { SearchService } from 'app/services/search.service';
import { ProjectService } from 'app/services/project.service';

@Injectable()
export class ProjectResolver implements Resolve<Object> {

  constructor(private searchService: SearchService, private projectService: ProjectService) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<Object> {
    const projId = route.paramMap.get('projId');
    // force-reload so we always have latest data
    let start = new Date();
    let end = new Date();
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 7);
    return this.searchService.getSearchResults(
      '',
      'Project',
      [],
      1,
      1,
      '',
      {_id: projId},
      true,
      '',
      {},
      ''
    )
    .flatMap(data => this.projectService.getPeopleObjs(data));
  }
}
