import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import { SearchResults } from 'app/models/search';
import { News } from 'app/models/news';
import { Constants } from 'app/shared/utils/constants';
import { EventKeywords, EventObject, EventService } from './event.service';
import { LoadingStateService } from './loading-state.service';
import { LoggingService } from './logging.service';

@Injectable({providedIn:'root'})
export class SearchService {

  public isError = false;

  constructor(
    private api: ApiService,
    private eventService: EventService,
    private loadingState: LoadingStateService,
    private logger: LoggingService
  ) { }

  getItem(_id: string, schema: string): Observable<any> {
    const loadingId = `search-item-${_id}`;
    this.loadingState.startLoading(loadingId, 'Loading item');
    const searchResults = this.api.getItem(_id, schema)
      .pipe(
        map(res => {
          let allResults = <any>[];
          res.forEach(item => {
            const r = new SearchResults({ type: item._schemaName, data: item });
            allResults.push(r);
          });
          this.loadingState.stopLoading(loadingId);
          if (allResults.length === 1) {
            return allResults[0];
          } else {
            return {};
          }
        }),
        catchError(() => {
          this.loadingState.stopLoading(loadingId);
          this.isError = true;
          // if call fails, return null results
          return of(null as unknown as SearchResults);
        })
      );
    return searchResults;
  }
  getFullList(schema: string): Observable<any> {
    return this.api.getFullDataSet(schema);
  }
  getSearchResults(keys: string, dataset: string, fields: any[], pageNum: number = 1, pageSize: number = 10, sortBy: string | null = null, queryModifier: Record<string,string> = {}, populate: boolean = false, secondarySort: string | null = null, filter: Record<string,string> = {}, projectLegislation: string = '', fuzzy: boolean = false): Observable<any[]> {
    const searchResults = this.api.searchKeywords(keys, dataset, fields, pageNum, pageSize, projectLegislation, sortBy, queryModifier, populate, secondarySort, filter, fuzzy)
      .pipe(
        map(res => {
          let allResults = <any>[];
          res.forEach(item => {
            const r = new SearchResults({ type: item._schemaName, data: item });

            allResults.push(r);
          });
          return allResults;
        }),
        catchError(() => {
          this.isError = true;
          // if call fails, return null results
          return of(null as unknown as SearchResults);
        })
      );
    return searchResults;
  }

  getTopNewsItems() {
    this.loadingState.startLoading('home', 'Loading recent activities');
    const searchResults = this.api.getTopNewsItems()
      .pipe(
        map(res => {
          let allResults = <any>[];
          // Handle case where API returns empty object {} instead of array
          if (Array.isArray(res)) {
            res.forEach(item => {
              const r = new News(item);
              allResults.push(r);
            });
          }
          this.loadingState.stopLoading('home');
          return allResults;
        }),
        catchError((error) => {
          this.logger.error('Error fetching top news items', 'SearchService', error);
          this.loadingState.stopLoading('home');
          this.isError = true;
          // if call fails, return empty array
          return of([]);
        })
      );
    return searchResults;
  }

  async fetchData(searchParamObject: SearchParamObject) {
    // SearchService manages loading state because it makes the actual API calls
    const loadingId = `table-${searchParamObject.tableId}`;
    this.loadingState.startLoading(loadingId, `Loading ${searchParamObject.dataset} data`);
    let res = null;

    this.logger.debug('SearchService.fetchData called', 'SearchService', searchParamObject);

    // Remove null/undefined filters
    for (let filter in searchParamObject.filters) {
      if (searchParamObject.filters[filter] === null || searchParamObject.filters[filter] === undefined) {
        delete searchParamObject.filters[filter];
      }
    }

    try {
      res = await this.getSearchResults(
        searchParamObject.keywords,
        searchParamObject.dataset,
        searchParamObject.fields,
        searchParamObject.currentPage,
        searchParamObject.pageSize,
        searchParamObject.sortBy,
        searchParamObject.queryModifiers,
        searchParamObject.populate,
        searchParamObject.secondarySort,
        searchParamObject.filters,
        searchParamObject.projectLegislation,
        searchParamObject.fuzzy
      ).toPromise();
    } catch (error) {
      this.loadingState.stopLoading(loadingId);
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          String(error),
          searchParamObject.dataset + ' Service'
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
            searchParamObject.dataset + ' Service'
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
            searchParamObject.dataset + ' Service'
          )
        );
      }
    } else {
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          'No data was returned from the server.',
          searchParamObject.dataset + ' Service'
        )
      );
    }
    this.loadingState.stopLoading(loadingId);
    return searchResults;
  }
}

export class SearchParamObject {
  constructor(
    public tableId: string = '',
    public keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    public dataset: string = '',
    public fields: any[] = [],
    public currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    public pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    public sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    public queryModifiers: Record<string,string> = {},
    public populate: boolean = false,
    public secondarySort: string = '',
    public filters: Record<string,string> = {},
    public projectLegislation: string = '',
    public fuzzy: boolean = false
  ) { }
}
