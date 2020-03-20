import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { flatMap } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import * as _ from 'lodash';

import { ApiService } from './api';
import { Comment } from 'app/models/comment';
import { DocumentService } from './document.service';

@Injectable()
export class CommentService {
  private comment: Comment = null;

  constructor(
    private api: ApiService,
    private documentService: DocumentService,
  ) { }

  // get count of projects
  getCountById(commentPeriodId: string): Observable<number> {
    return this.api.getCountCommentsById(commentPeriodId)
      .catch(error => this.api.handleError(error));
  }

  // get all comments for the specified comment period id
  // (without documents)
  getByPeriodId(periodId: string, pageNum: number = null, pageSize: number = null, getCount: boolean = false): Observable<Object> {
    return this.api.getCommentsByPeriodId(pageNum ? pageNum - 1 : pageNum, pageSize, getCount, periodId)
      .map((res: any) => {
        if (res) {
          const comments = res.body;
          comments.forEach((comment, i) => {
            comments[i] = new Comment(comment);
          });
          const commentsDataSet = {
            totalCount: res.headers.get('x-total-count'),
            currentComments: comments as Comment[]
          };
          return commentsDataSet;
        }
      })
      .catch(this.api.handleError);
  }

  // get a specific comment by its id
  // (including documents)
  getById(commentId: string, forceReload: boolean = false): Observable<Comment> {
    if (this.comment && this.comment._id === commentId && !forceReload) {
      return Observable.of(this.comment);
    }

    // first get the comment data
    return this.api.getComment(commentId)
    .pipe(
      flatMap(res => {
        let comments = res.body;
        if (!comments || comments.length === 0) {
          return of(null as Comment);
        }
        // Safety check for null documents or an empty array of documents.
        if (comments[0].documents === null || comments[0].documents && comments[0].documents.length === 0) {
          return of(new Comment(comments[0]));
        }
        // now get the rest of the data for this project
        return this._getExtraAppData(new Comment(comments[0]));
      })
    )
    .catch(error => this.api.handleError(error));
  }

  add(orig: Comment): Observable<Comment> {
    // make a (deep) copy of the passed-in comment so we don't change it
    const comment = _.cloneDeep(orig);

    // ID must not exist on POST
    delete comment._id;

    return this.api.addComment(comment)
      .map((res: Comment) => {
        return res ? new Comment(res) : null;
      })
      .catch(this.api.handleError);
  }

  private _getExtraAppData(comment: Comment): Observable<Comment> {
    return forkJoin(
      this.documentService.getByMultiId(comment.documents)
    ).map(payloads => {
      comment.documentsList = payloads[0];
      return comment;
    });
  }
}
