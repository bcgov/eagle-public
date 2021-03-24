import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import * as _ from 'lodash';

import { ApiService } from './api';
import { SearchResults } from 'app/models/search';
import { News } from 'app/models/news';
import { Constants } from 'app/shared/utils/constants';
import { EventKeywords, EventObject, EventService } from './event.service';

@Injectable()
export class SearchService {

  public isError = false;

  constructor(
    private api: ApiService,
    private eventService: EventService
  ) { }

  getItem(_id: string, schema: string): Observable<any> {
    const searchResults = this.api.getItem(_id, schema)
      .map(res => {
        let allResults = <any>[];
        res.forEach(item => {
          const r = new SearchResults({ type: item._schemaName, data: item });
          allResults.push(r);
        });
        if (allResults.length === 1) {
          return allResults[0];
        } else {
          return {};
        }
      })
      .catch(() => {
        this.isError = true;
        // if call fails, return null results
        return of(null as SearchResults);
      });
    return searchResults;
  }
  getFullList(schema: string): Observable<any> {
    return this.api.getFullDataSet(schema);
  }
  getSearchResults(keys: string, dataset: string, fields: any[], pageNum: number = 1, pageSize: number = 10, sortBy: string = null, queryModifier: object = {}, populate: boolean = false, secondarySort: string = null, filter: object = {}, projectLegislation: string = '', fuzzy: boolean = false): Observable<any[]> {
    const searchResults = this.api.searchKeywords(keys, dataset, fields, pageNum, pageSize, projectLegislation, sortBy, queryModifier, populate, secondarySort, filter, fuzzy)
      .map(res => {
        let allResults = <any>[];
        res.forEach(item => {
          const r = new SearchResults({ type: item._schemaName, data: item });

          allResults.push(r);
        });
        return allResults;
      })
      .catch(() => {
        this.isError = true;
        // if call fails, return null results
        return of(null as SearchResults);
      });
    return searchResults;
  }

  getTopNewsItems() {
    const searchResults = this.api.getTopNewsItems()
      .map(res => {
        let allResults = <any>[];
        res.forEach(item => {
          const r = new News(item);
          allResults.push(r);
        });
        return allResults;
      })
      .catch(() => {
        this.isError = true;
        // if call fails, return null results
        return of(null as News);
      });
    return searchResults;
  }

  async fetchData(searchParamObject: SearchParamObject) {
    let res = null;

    for (var filter in searchParamObject.filters) {
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
      this.eventService.setError(
        new EventObject(
          EventKeywords.ERROR,
          error,
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
    return searchResults;
  }
}

export class SearchParamObject {
  constructor(
    public keywords: string = Constants.tableDefaults.DEFAULT_KEYWORDS,
    public dataset: string = '',
    public fields = [],
    public currentPage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE,
    public pageSize: number = Constants.tableDefaults.DEFAULT_PAGE_SIZE,
    public sortBy: string = Constants.tableDefaults.DEFAULT_SORT_BY,
    public queryModifiers = {},
    public populate: boolean = false,
    public secondarySort: string = '',
    public filters = {},
    public projectLegislation: string = '',
    public fuzzy: boolean = false
  ) { }
}
