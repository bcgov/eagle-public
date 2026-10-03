import { Injectable, inject } from '@angular/core';
import { Observable, of, lastValueFrom } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';

import { ApiService } from './api';
import { SearchResults } from 'app/models/search';
import { News } from 'app/models/news';
import { Constants } from 'app/shared/utils/constants';
import { EventKeywords, EventObject, EventService } from './event.service';
import { LoadingStateService } from './loading-state.service';
import { LoggingService } from './logging.service';

@Injectable({providedIn:'root'})
export class SearchService {
  private api = inject(ApiService);
  private eventService = inject(EventService);
  private loadingState = inject(LoadingStateService);
  private logger = inject(LoggingService);


  public isError = false;

  getItem(_id: string, schema: string): Observable<any> {
    const loadingId = `search-item-${_id}`;
    this.loadingState.startLoading(loadingId, 'Loading item');
    const searchResults = this.api.getItem(_id, schema)
      .pipe(
        map(res => {
          const allResults = [] as any;
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
  getSearchResults(keys: string, dataset: string, fields: any[], pageNum = 1, pageSize = 10, sortBy: string | null = null, queryModifier: Record<string,string> = {}, populate = false, secondarySort: string | null = null, filter: Record<string,string> = {}, projectLegislation = '', fuzzy = false): Observable<any[]> {
    const searchResults = this.api.searchKeywords(keys, dataset, fields, pageNum, pageSize, projectLegislation, sortBy, queryModifier, populate, secondarySort, filter, fuzzy)
      .pipe(
        map(res => {
          const allResults = [] as any;
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
    return this.api.getTopNewsItems()
      .pipe(
        map(res => {
          const allResults: News[] = [];
          if (Array.isArray(res)) {
            res.forEach(item => allResults.push(new News(item)));
          }
          return allResults;
        }),
        catchError((error) => {
          this.logger.error('Error fetching top news items', 'SearchService', error);
          this.isError = true;
          return of([] as News[]);
        }),
        finalize(() => this.loadingState.stopLoading('home'))
      );
  }

  async fetchData(searchParamObject: SearchParamObject) {
    // SearchService manages loading state because it makes the actual API calls
    const loadingId = `table-${searchParamObject.tableId}`;
    this.logger.debug(`Starting loading for ${loadingId}`, 'SearchService');
    this.loadingState.startLoading(loadingId, `Loading ${searchParamObject.dataset} data`);
    let res = null;

    this.logger.debug('SearchService.fetchData called', 'SearchService', searchParamObject);

    // Remove null/undefined filters
    for (const filter in searchParamObject.filters) {
      if (searchParamObject.filters[filter] === null || searchParamObject.filters[filter] === undefined) {
        delete searchParamObject.filters[filter];
      }
    }

    try {
      res = await lastValueFrom(
        this.getSearchResults(
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
        )
      );
      
      this.logger.debug(`Promise resolved for ${loadingId}`, 'SearchService', { res });
    } catch (error) {
      this.logger.error(`Error in fetchData for ${loadingId}`, 'SearchService', error);
      this.loadingState.stopLoading(loadingId);
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          String(error),
          searchParamObject.dataset + ' Service'
        )
      );
      // Return empty results on error
      return new SearchResults();
    }

       const searchResults = new SearchResults();

    this.logger.debug(`Processing response for ${loadingId}`, 'SearchService', { 
      hasRes: !!res, 
      resLength: res?.length,
      res0Keys: res?.[0] ? Object.keys(res[0]) : [],
      res0DataKeys: res?.[0]?.data ? Object.keys(res[0].data) : []
    });

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
      if (res[0].data.meta && res[0].data.meta[0] && res[0].data.meta[0].searchResultsTotal !== undefined && res[0].data.meta[0].searchResultsTotal !== null) {
        searchResults.totalSearchCount = res[0].data.meta[0].searchResultsTotal;
      } else if (res[0].data.meta && res[0].data.meta.length === 0) {
        searchResults.totalSearchCount = 0;
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
    this.logger.debug(`Stopping loading for ${loadingId}`, 'SearchService', { totalCount: searchResults.totalSearchCount, dataLength: searchResults.data?.length });
    this.loadingState.stopLoading(loadingId);
    return searchResults;
  }
}

export class SearchParamObject {
  constructor(
    public tableId = '',
    public keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    public dataset = '',
    public fields: any[] = [],
    public currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    public pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    public sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    public queryModifiers: Record<string,string> = {},
    public populate = false,
    public secondarySort = '',
    public filters: Record<string,string> = {},
    public projectLegislation = '',
    public fuzzy = false
  ) { }
}
