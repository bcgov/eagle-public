import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Document } from 'app/models/document';

@Injectable({providedIn:'root'})
export class DocumentService {

  private document: Document | null = null;

  constructor(
    private api: ApiService
  ) { }

  // get a specific document by its id
  getByMultiId(ids: Array<String>): Observable<Document[]> {
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
              return docs;
            }
            return [];
          }
          return [];
        }),
        catchError(error => this.api.handleError(error))
      );
  }

  // get all documents for the specified decision id
  getAllByDecisionId(decisionId: string): Observable<Document[]> {
    return this.api.getDocumentsByDecisionId(decisionId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            documents.forEach((document: any, i: number) => {
              documents[i] = new Document(document);
            });
            return documents;
          }
          return [];
        }),
        catchError(this.api.handleError)
      );
  }

  // get all documents for the specified comment id
  getAllByCommentId(commentId: string): Observable<Document[]> {
    return this.api.getDocumentsByCommentId(commentId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            documents.forEach((document: any, i: number) => {
              documents[i] = new Document(document);
            });
            return documents;
          }
          return [];
        }),
        catchError(this.api.handleError)
      );
  }

  // get a specific document by its id
  getById(documentId: string, forceReload: boolean = false): Observable<Document> {
    if (this.document && this.document._id === documentId && !forceReload) {
      return of(this.document);
    }

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
          if (!document) { return null as unknown as Document; }

          this.document = document;
          return this.document;
        }),
        catchError(this.api.handleError)
      );
  }

  add(formData: FormData): Observable<Document | null> {
    return this.api.uploadDocument(formData)
      .pipe(
        map((res: any) => {
          if (res) {
            const d = res;
            return d ? new Document(d) : null;
          }
          return null;
        }),
        catchError(this.api.handleError)
      );
  }
}
