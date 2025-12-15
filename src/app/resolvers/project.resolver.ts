import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ProjectService } from 'app/services/project.service';
import { Project } from 'app/models/project';

export const projectResolver: ResolveFn<Project | null> = (route): Observable<Project | null> => {
  const projectService = inject(ProjectService);
  const projId = route.paramMap.get('projId');
  
  if (!projId) {
    return of(null);
  }
  
  // force-reload so we always have latest data
  const start = new Date();
  const end = new Date();
  start.setDate(start.getDate() - 21);
  end.setDate(end.getDate() + 14);
  
  return projectService.getById(projId, false, start.toISOString(), end.toISOString())
    .pipe(
      catchError(() => of(null))
    );
};
