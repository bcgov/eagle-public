import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, flatMap } from 'rxjs/operators';

import { ApiService } from './api';
import { Comment } from 'app/models/comment';
import { DocumentService } from './document.service';
import { LoadingStateService } from './loading-state.service';
import { withLoading } from 'app/shared/utils/rxjs-operators';

@Injectable({providedIn:'root'})
export class CommentService {
  private api = inject(ApiService);
  private documentService = inject(DocumentService);
  private loadingState = inject(LoadingStateService);

  private comment: Comment | null = null;

  // get count of projects
  getCountById(commentPeriodId: string): Observable<number> {
    return this.api.getCountCommentsById(commentPeriodId)
      .pipe(
        catchError(error => this.api.handleError(error))
      );
  }

  // get all comments for the specified comment period id
  // (without documents)
  getByPeriodId(periodId: string, pageNum: number | null = null, pageSize: number | null = null, getCount = false): Observable<object> {
    const loadingId = pageNum && pageNum > 1 ? 'comments-list' : 'comments';
    return this.api.getCommentsByPeriodId(pageNum ? pageNum - 1 : null, pageSize, getCount, periodId)
      .pipe(
        withLoading(this.loadingState, loadingId, pageNum ? `Loading page ${pageNum}` : 'Loading comments'),
        map((res: any) => {
          if (!res) return null;
          const comments: Comment[] = res.body.map((c: any) => new Comment(c));
          return { totalCount: parseInt(res.headers.get('x-total-count') || '0', 10), currentComments: comments };
        }),
        catchError(error => this.api.handleError(error))
      );
  }

  // get a specific comment by its id
  // (including documents)
  getById(commentId: string, forceReload = false): Observable<Comment> {
    if (this.comment && this.comment._id === commentId && !forceReload) {
      return of(this.comment);
    }

    // first get the comment data
    return this.api.getComment(commentId)
    .pipe(
      flatMap(res => {
        const comments = res.body;
        if (!comments || comments.length === 0) {
          return of(null as unknown as Comment);
        }
        // Safety check for null documents or an empty array of documents.
        if (comments[0].documents === null || comments[0].documents && comments[0].documents.length === 0) {
          return of(new Comment(comments[0]));
        }
        // now get the rest of the data for this project
        return this._getExtraAppData(new Comment(comments[0]));
      }),
      catchError(error => this.api.handleError(error))
    );
  }

  add(orig: Comment): Observable<Comment | null> {
    // make a (deep) copy of the passed-in comment so we don't change it
    const comment = JSON.parse(JSON.stringify(orig));

    // ID must not exist on POST
    delete comment._id;

    return this.api.addComment(comment)
      .pipe(
        map((res: Comment | null) => {
          return res ? new Comment(res) : null;
        }),
        catchError(this.api.handleError)
      );
  }

  private _getExtraAppData(comment: Comment): Observable<Comment> {
    return forkJoin(
      this.documentService.getByMultiId(comment.documents)
    ).pipe(
      map(payloads => {
        comment.documentsList = payloads[0];
        return comment;
      })
    );
  }
}
