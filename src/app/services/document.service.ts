import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/of';

import { ApiService } from './api';
import { Document } from 'app/models/document';
import { BehaviorSubject } from 'rxjs';
import { SearchResults } from 'app/models/search';
import { Constants } from 'app/shared/utils/constants';
import { SearchService } from './search.service';
import { EventKeywords, EventObject, EventService } from './event.service';

@Injectable()
export class DocumentService {
  private data: BehaviorSubject<SearchResults>;
  private fetchDataConfig: any;

  private document: Document = null;

  constructor(
    private searchService: SearchService,
    private eventService: EventService,
    private api: ApiService
  ) {
    this.data = new BehaviorSubject<SearchResults>(new SearchResults);

    this.fetchDataConfig = {
      keywords: Constants.tableDefaults.DEFAULT_KEYWORDS,
      currentPage: Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
      pageSize: Constants.tableDefaults.DEFAULT_PAGE_SIZE,
      sortBy: Constants.tableDefaults.DEFAULT_SORT_BY,
      projId: '',
      filters: {}
    }
  }

  // get a specific document by its id
  getByMultiId(ids: Array<String>): Observable<Document[]> {
    return this.api.getDocumentsByMultiId(ids)
      .map((res: any) => {
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
      })
      .catch(error => this.api.handleError(error));
  }

  // get all documents for the specified application id
  getAllByProjectId(appId: string): Observable<Document[]> {
    return this.api.getDocumentsByAppId(appId)
      .map((res: any) => {
        if (res) {
          const documents = res;
          documents.forEach((document, i) => {
            documents[i] = new Document(document);
          });
          return documents;
        }
      })
      .catch(this.api.handleError);
  }

  // get all documents for the specified comment id
  getAllByCommentId(commentId: string): Observable<Document[]> {
    return this.api.getDocumentsByCommentId(commentId)
      .map((res: any) => {
        if (res) {
          const documents = res;
          documents.forEach((document, i) => {
            documents[i] = new Document(document);
          });
          return documents;
        }
      })
      .catch(this.api.handleError);
  }

  // get all documents for the specified decision id
  getAllByDecisionId(decisionId: string): Observable<Document[]> {
    return this.api.getDocumentsByDecisionId(decisionId)
      .map((res: any) => {
        if (res) {
          const documents = res;
          documents.forEach((document, i) => {
            documents[i] = new Document(document);
          });
          return documents;
        }
      })
      .catch(this.api.handleError);
  }

  // get a specific document by its id
  getById(documentId: string, forceReload: boolean = false): Observable<Document> {
    if (this.document && this.document._id === documentId && !forceReload) {
      return Observable.of(this.document);
    }

    return this.api.getDocument(documentId)
      .map((res: any) => {
        if (res) {
          const documents = res;
          // return the first (only) document
          return documents.length > 0 ? new Document(documents[0]) : null;
        }
      })
      .map((document: Document) => {
        if (!document) { return null as Document; }

        this.document = document;
        return this.document;
      })
      .catch(this.api.handleError);
  }

  add(formData: FormData): Observable<Document> {
    return this.api.uploadDocument(formData)
      .map((res: any) => {
        if (res) {
          const d = res;
          return d ? new Document(d) : null;
        }
      })
      .catch(this.api.handleError);
  }

  setValue(value): void {
    this.data.next(value);
  }

  getValue(): Observable<SearchResults> {
    return this.data.asObservable();
  }

  async refreshData() {
    await this.fetchData(
      this.fetchDataConfig.keywords,
      this.fetchDataConfig.currentPage,
      this.fetchDataConfig.pageSize,
      this.fetchDataConfig.sortBy,
      this.fetchDataConfig.projId
    );
  }

  async fetchData(
    keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    projId: string = '',
    filters = {},
    queryModifiers = {}
  ) {
    // Caching for later
    this.fetchDataConfig = {
      keywords: keywords,
      currentPage: currentPage,
      pageSize: pageSize,
      sortBy: sortBy,
      projId: projId,
      filters: filters
    };
    console.log(queryModifiers);
    let res = null;
    try {
      res = await this.searchService.getSearchResults(
        this.fetchDataConfig.keywords,
        'Document',
        [{ 'name': 'project', 'value': projId }],
        this.fetchDataConfig.currentPage,
        this.fetchDataConfig.pageSize,
        this.fetchDataConfig.sortBy,
        queryModifiers,
        true,
        null,
        filters,
        ''
      ).toPromise();
    } catch (error) {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          error,
          'Activities Service'
        )
      );
    }

    // tslint:disable-next-line: prefer-const
    let searchResults = new SearchResults();

    if (res && res[0] && res[0].data) {
      if (res[0].data.searchResults) {
        searchResults.data = res[0].data.searchResults;
      } else {
        this.eventService.setError(
          new EventObject(
            EventKeywords.ERROR,
            'Search results were empty.',
            'Activities Service'
          )
        );
      }
      if (res[0].data.meta[0] && res[0].data.meta[0].searchResultsTotal) {
        searchResults.totalSearchCount = res[0].data.meta[0].searchResultsTotal;
      } else if (res[0].data.meta.lenght === 0) {
        searchResults.totalSearchCount = 0
      } else {
        this.eventService.setError(
          new EventObject(
            EventKeywords.ERROR,
            'Total search results count was not returned.',
            'Activities Service'
          )
        );
      }
    } else {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          'No data was returned from the server.',
          'Activities Service'
        )
      );
    }
    this.setValue(searchResults);
  }
}
