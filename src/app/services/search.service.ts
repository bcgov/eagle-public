import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import * as _ from 'lodash';

import { ApiService } from './api';
import { SearchResults } from 'app/models/search';
import { News } from 'app/models/news';

@Injectable()
export class SearchService {

  public isError = false;

  constructor(
    private api: ApiService,
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
}
