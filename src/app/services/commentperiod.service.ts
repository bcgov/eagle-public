import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { LoadingStateService } from './loading-state.service';
import { withLoading } from 'app/shared/utils/rxjs-operators';

@Injectable({providedIn:'root'})
export class CommentPeriodService {
  private api = inject(ApiService);
  private loadingState = inject(LoadingStateService);

  // statuses / query param options
  readonly NOT_STARTED = 'NS';
  readonly NOT_OPEN = 'NO';
  readonly CLOSED = 'CL';
  readonly OPEN = 'OP';

  private commentPeriodStatuses: Record<string, string> = {}; // use helper to get these
  private commentPeriod: CommentPeriod | null = null; // for caching

  constructor() {
    // user-friendly strings for display
    this.commentPeriodStatuses[this.NOT_STARTED] = 'Commenting Not Started';
    this.commentPeriodStatuses[this.NOT_OPEN] = 'Not Open For Commenting';
    this.commentPeriodStatuses[this.CLOSED] = 'Commenting Closed';
    this.commentPeriodStatuses[this.OPEN] = 'Commenting Open';
  }

  // get all comment periods for the specified application id
  getAllByProjectId(projId: string): Observable<object> {
    const loadingId = `commentperiods-${projId}`;
    return this.api.getPeriodsByProjId(projId)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Loading comment periods'),
        map((res: any) => {
          if (!res || res.length === 0) return { totalCount: 0, data: [] };
          const periods: CommentPeriod[] = (res as any[]).map(cp => new CommentPeriod(cp));
          return { totalCount: periods.length, data: periods };
        }),
        catchError(error => this.api.handleError(error))
      );
  }

  // get a specific comment period by its id
  getById(periodId: string): Observable<CommentPeriod> {
    const loadingId = `commentperiod-${periodId}`;
    return this.api.getPeriod(periodId)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Loading comment period'),
        map((res: any) => {
          if (!res || res.length === 0) return null as unknown as CommentPeriod;
          this.commentPeriod = new CommentPeriod(res[0]);
          return this.commentPeriod;
        }),
        catchError(error => this.api.handleError(error))
      );
  }
  // returns first period - multiple comment periods are currently not supported
  getCurrent(periods: CommentPeriod[]): CommentPeriod | null {
    return (periods.length > 0) ? periods[0] : null;
  }

  /**
   * Given a comment period, returns status abbreviation.
   */
  getStatusCode(commentPeriod: CommentPeriod): string {
    if (!commentPeriod || !commentPeriod.dateStarted || !commentPeriod.dateCompleted) {
      return this.NOT_OPEN;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0);

    if (commentPeriod.dateCompleted < today) {
      return this.CLOSED;
    } else if (commentPeriod.dateStarted > today) {
      return this.NOT_STARTED;
    } else {
      return this.OPEN;
    }
  }

  /**
     * Given a status code, returns user-friendly status string.
     */
  getStatusString(statusCode: string): string | null {
    switch (statusCode) {
      case this.NOT_STARTED: return this.commentPeriodStatuses[this.NOT_STARTED];
      case this.NOT_OPEN: return this.commentPeriodStatuses[this.NOT_OPEN];
      case this.CLOSED: return this.commentPeriodStatuses[this.CLOSED];
      case this.OPEN: return this.commentPeriodStatuses[this.OPEN];
    }
    return null;
  }

  isNotOpen(commentPeriod: CommentPeriod): boolean {
    return (this.getStatusCode(commentPeriod) === this.NOT_OPEN);
  }

  isClosed(commentPeriod: CommentPeriod): boolean {
    return (this.getStatusCode(commentPeriod) === this.CLOSED);
  }

  isNotStarted(commentPeriod: CommentPeriod): boolean {
    return (this.getStatusCode(commentPeriod) === this.NOT_STARTED);
  }

  isOpen(commentPeriod: CommentPeriod): boolean {
    return (this.getStatusCode(commentPeriod) === this.OPEN);
  }
}
