import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CommentPeriodService } from 'app/services/commentperiod.service';
import { CommentPeriod } from 'app/models/commentperiod';

export const commentPeriodResolver: ResolveFn<CommentPeriod | null> = (route): Observable<CommentPeriod | null> => {
  const commentPeriodService = inject(CommentPeriodService);
  const commentPeriodId = route.paramMap.get('commentPeriodId');
  
  if (!commentPeriodId) {
    return of(null);
  }
  
  // force-reload so we always have latest data
  return commentPeriodService.getById(commentPeriodId).pipe(
    catchError(() => of(null))
  );
};
