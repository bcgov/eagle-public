import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/of';

import { ApiService } from './api';
import { CommentPeriod } from 'app/models/commentperiod';

@Injectable()
export class CommentPeriodService {
  // statuses / query param options
  readonly NOT_STARTED = 'NS';
  readonly NOT_OPEN = 'NO';
  readonly CLOSED = 'CL';
  readonly OPEN = 'OP';

  private commentPeriodStatuses: Array<string> = []; // use helper to get these
  private commentPeriod: CommentPeriod = null; // for caching

  constructor(
    private api: ApiService,
  ) {
    // user-friendly strings for display
    this.commentPeriodStatuses[this.NOT_STARTED] = 'Commenting Not Started';
    this.commentPeriodStatuses[this.NOT_OPEN] = 'Not Open For Commenting';
    this.commentPeriodStatuses[this.CLOSED] = 'Commenting Closed';
    this.commentPeriodStatuses[this.OPEN] = 'Commenting Open';
  }

  // get all comment periods for the specified application id
  getAllByProjectId(projId: string): Observable<Object> {
    return this.api.getPeriodsByProjId(projId)
      .map((res: any) => {
        if (res) {
          const periods: Array<CommentPeriod> = [];
          if (!res || res.length === 0) {
            return periods;
          }
          res.forEach(cp => {
            periods.push(new CommentPeriod(cp));
          });
          return { totalCount: res.length, data: periods };
        }
        return {};
      })
      .catch(error => this.api.handleError(error));
  }

  // get a specific comment period by its id
  getById(periodId: string): Observable<CommentPeriod> {
    return this.api.getPeriod(periodId)
      .map((res: any) => {
        if (res) {
          const periods = res;
          // return the first (only) comment period
          return periods.length > 0 ? new CommentPeriod(periods[0]) : null;
        }
      })
      .map((period: CommentPeriod) => {
        if (!period) { return null as CommentPeriod; }

        this.commentPeriod = period;
        return this.commentPeriod;
      })
      .catch(this.api.handleError);
  }
  // returns first period - multiple comment periods are currently not supported
  getCurrent(periods: CommentPeriod[]): CommentPeriod {
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
  getStatusString(statusCode: string): string {
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
