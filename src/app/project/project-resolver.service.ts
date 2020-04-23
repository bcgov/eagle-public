import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import { ProjectService } from 'app/services/project.service';

@Injectable()
export class ProjectResolver implements Resolve<Object> {

  constructor(private projectService: ProjectService) { }

  resolve(route: ActivatedRouteSnapshot): Observable<Object> {
    const projId = route.paramMap.get('projId');
    // force-reload so we always have latest data
    let start = new Date();
    let end = new Date();
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 7);
    return this.projectService.getById(projId, false, start.toISOString(), end.toISOString())
      .catch(() => { return Observable.of(null); });
  }
}
