import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { Document } from 'app/models/document';

@Injectable()
export class DocumentService {

  private document: Document = null;

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
              let docs = [];
              documents.forEach(doc => {
                docs.push(new Document(doc));
              });
              return docs;
            }
            return null;
          }
        }),
        catchError(error => this.api.handleError(error))
      );
  }

  // get all documents for the specified application id
  getAllByProjectId(appId: string): Observable<Document[]> {
    return this.api.getDocumentsByAppId(appId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            documents.forEach((document, i) => {
              documents[i] = new Document(document);
            });
            return documents;
          }
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
            documents.forEach((document, i) => {
              documents[i] = new Document(document);
            });
            return documents;
          }
        }),
        catchError(this.api.handleError)
      );
  }

  // get all documents for the specified decision id
  getAllByDecisionId(decisionId: string): Observable<Document[]> {
    return this.api.getDocumentsByDecisionId(decisionId)
      .pipe(
        map((res: any) => {
          if (res) {
            const documents = res;
            documents.forEach((document, i) => {
              documents[i] = new Document(document);
            });
            return documents;
          }
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
        }),
        map((document: Document) => {
          if (!document) { return null as Document; }

          this.document = document;
          return this.document;
        }),
        catchError(this.api.handleError)
      );
  }

  add(formData: FormData): Observable<Document> {
    return this.api.uploadDocument(formData)
      .pipe(
        map((res: any) => {
          if (res) {
            const d = res;
            return d ? new Document(d) : null;
          }
        }),
        catchError(this.api.handleError)
      );
  }
}
