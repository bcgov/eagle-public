import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Document } from 'app/models/document';
import { LoadingStateService } from './loading-state.service';
import { withLoading } from 'app/shared/utils/rxjs-operators';

@Injectable({providedIn:'root'})
export class DocumentService {
  private api = inject(ApiService);
  private loadingState = inject(LoadingStateService);


  private document: Document | null = null;

  // get a specific document by its id
  getByMultiId(ids: string[]): Observable<Document[]> {
    const loadingId = `documents-multi-${ids.length}`;
    return this.api.getDocumentsByMultiId(ids)
      .pipe(
        withLoading(this.loadingState, loadingId, `Loading ${ids.length} documents`),
        map((res: any) => {
          if (!res) return [];
          return (res as any[]).map(doc => new Document(doc));
        }),
        catchError(error => this.api.handleError(error))
      );
  }

  // get all documents for the specified decision id
  getAllByDecisionId(decisionId: string): Observable<Document[]> {
    const loadingId = `documents-decision-${decisionId}`;
    return this.api.getDocumentsByDecisionId(decisionId)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Loading decision documents'),
        map((res: any) => res ? (res as any[]).map((d: any) => new Document(d)) : []),
        catchError(error => this.api.handleError(error))
      );
  }

  // get all documents for the specified comment id
  getAllByCommentId(commentId: string): Observable<Document[]> {
    const loadingId = `documents-comment-${commentId}`;
    return this.api.getDocumentsByCommentId(commentId)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Loading comment documents'),
        map((res: any) => res ? (res as any[]).map((d: any) => new Document(d)) : []),
        catchError(error => this.api.handleError(error))
      );
  }

  // get a specific document by its id
  getById(documentId: string, forceReload = false): Observable<Document> {
    if (this.document && this.document._id === documentId && !forceReload) {
      return of(this.document);
    }

    const loadingId = `document-${documentId}`;
    return this.api.getDocument(documentId)
      .pipe(
        withLoading(this.loadingState, loadingId, 'Loading document'),
        map((res: any) => {
          if (!res || res.length === 0) return null as unknown as Document;
          this.document = new Document(res[0]);
          return this.document;
        }),
        catchError(error => this.api.handleError(error))
      );
  }

  add(formData: FormData): Observable<Document | null> {
    return this.api.uploadDocument(formData)
      .pipe(
        withLoading(this.loadingState, 'document-upload', 'Uploading document'),
        map((res: any) => res ? new Document(res) : null),
        catchError(error => this.api.handleError(error))
      );
  }
}
