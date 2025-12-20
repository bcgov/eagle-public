import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Document } from 'app/models/document';
import { LoadingStateService } from './loading-state.service';

@Injectable({providedIn:'root'})
export class DocumentService {

  private document: Document | null = null;

  constructor(
    private api: ApiService,
    private loadingState: LoadingStateService
  ) { }

  // get a specific document by its id
  getByMultiId(ids: Array<String>): Observable<Document[]> {
    const loadingId = `documents-multi-${ids.length}`;
    this.loadingState.startLoading(loadingId, `Loading ${ids.length} documents`);
    return this.api.getDocumentsByMultiId(ids)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            if (documents.length > 0) {
              // return the first (only) document
              let docs: Document[] = [];
              documents.forEach((doc: any) => {
                docs.push(new Document(doc));
              });
              this.loadingState.stopLoading(loadingId);
              return docs;
            }
            this.loadingState.stopLoading(loadingId);
            return [];
          }
          this.loadingState.stopLoading(loadingId);
          return [];
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // get all documents for the specified decision id
  getAllByDecisionId(decisionId: string): Observable<Document[]> {
    const loadingId = `documents-decision-${decisionId}`;
    this.loadingState.startLoading(loadingId, 'Loading decision documents');
    return this.api.getDocumentsByDecisionId(decisionId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            documents.forEach((document: any, i: number) => {
              documents[i] = new Document(document);
            });
            this.loadingState.stopLoading(loadingId);
            return documents;
          }
          this.loadingState.stopLoading(loadingId);
          return [];
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // get all documents for the specified comment id
  getAllByCommentId(commentId: string): Observable<Document[]> {
    const loadingId = `documents-comment-${commentId}`;
    this.loadingState.startLoading(loadingId, 'Loading comment documents');
    return this.api.getDocumentsByCommentId(commentId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            documents.forEach((document: any, i: number) => {
              documents[i] = new Document(document);
            });
            this.loadingState.stopLoading(loadingId);
            return documents;
          }
          this.loadingState.stopLoading(loadingId);
          return [];
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  // get a specific document by its id
  getById(documentId: string, forceReload: boolean = false): Observable<Document> {
    if (this.document && this.document._id === documentId && !forceReload) {
      return of(this.document);
    }

    const loadingId = `document-${documentId}`;
    this.loadingState.startLoading(loadingId, 'Loading document');
    return this.api.getDocument(documentId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            // return the first (only) document
            return documents.length > 0 ? new Document(documents[0]) : null;
          }
          return null;
        }),
        map((document: Document | null) => {
          if (!document) { 
            this.loadingState.stopLoading(loadingId);
            return null as unknown as Document; 
          }

          this.document = document;
          this.loadingState.stopLoading(loadingId);
          return this.document;
        }),
        catchError(error => {
          this.loadingState.stopLoading(loadingId);
          return this.api.handleError(error);
        })
      );
  }

  add(formData: FormData): Observable<Document | null> {
    this.loadingState.startLoading('document-upload', 'Uploading document');
    return this.api.uploadDocument(formData)
      .pipe(
        map((res: any) => {
          if (res) {
            const d = res;
            this.loadingState.stopLoading('document-upload');
            return d ? new Document(d) : null;
          }
          this.loadingState.stopLoading('document-upload');
          return null;
        }),
        catchError(error => {
          this.loadingState.stopLoading('document-upload');
          return this.api.handleError(error);
        })
      );
  }
}
