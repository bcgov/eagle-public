import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';

import 'rxjs/add/operator/switchMap';

import * as _ from 'lodash';

import { SearchService } from 'app/services/search.service';
import { StorageService } from 'app/services/storage.service';

@Injectable()
export class SearchResolver implements Resolve<Observable<object>> {
  private milestones: any[] = [];
  private authors: any[] = [];
  private types: any[] = [];
  private projectPhases: any[] = []

  private filterForAPI: object = {};

  constructor(
    private searchService: SearchService,
    private storageService: StorageService
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<object> {
    let currentPage = route.params.currentPage ? route.params.currentPage : 1;
    let pageSize = route.params.pageSize ? route.params.pageSize : 10;
    let sortBy = route.params.sortBy ? route.params.sortBy : '-datePosted,+displayName';
    const keywords = route.params.hasOwnProperty('keywords') ? route.params.keywords : '';
    let categorizedQuery = [];

    if (Object.keys(route.params).length === 0) {
      return;
    } else {
      // Get the lists first
      return this.searchService.getFullList('List')
        .switchMap((res: any) => {
          if (res.length > 0) {
            res[0].searchResults.map(item => {
              switch (item.type) {
                case 'label':
                  this.milestones.push({ ...item });
                  break;
                case 'author':
                  this.authors.push({ ...item });
                  break;
                case 'doctype':
                  this.types.push({ ...item });
                  break;
                case 'projectPhase':
                  this.projectPhases.push({ ...item });
                  break;
                default:
                  break;
              }
            });
          }

          // Validate the filter parameters being sent to the API
          this.setFilterFromParams(route.params);

          let queryModifiers = { documentSource: 'PROJECT' };

          if (this.storageService && this.storageService.state.search) {
            let filterForUI = this.storageService.state.search.filterForUI
            let tableParams = this.storageService.state.search.tableParams;

            if (tableParams) {
              currentPage = tableParams.currentPage;
              pageSize = tableParams.pageSize;
              sortBy = tableParams.sortBy ? tableParams.sortBy : sortBy;
            }

            if (filterForUI) {
              this.setParamsFromFilters(filterForUI);
            }

            if (this.storageService.state.search.categorizedQuery) {
              categorizedQuery = [ this.storageService.state.search.categorizedQuery ]
            }
          }

          return this.searchService.getSearchResults(
            keywords,
            'Document',
            categorizedQuery,
            currentPage,
            pageSize,
            sortBy,
            queryModifiers,
            true,
            null,
            this.filterForAPI,
            '');
        });
    }
  }

  paramsToCollectionFilter(params, name, collection, identifyBy) {
    delete this.filterForAPI[name];

    if (params[name] && collection) {
      let confirmedValues = [];
      // look up each value in collection
      const values = params[name].split(',');
      values.forEach(value => {
        const record = _.find(collection, [identifyBy, value]);
        if (record) {
          confirmedValues.push(value);
        }
      });
      if (confirmedValues.length) {
        this.filterForAPI[name] = confirmedValues.join(',');
      }
    }
  }

  paramsToDateFilter(params, name) {
    delete this.filterForAPI[name];

    if (params[name]) {
      this.filterForAPI[name] = params[name];
    }
  }

  setFilterFromParams(params) {
    this.paramsToCollectionFilter(params, 'milestone', this.milestones, '_id');
    this.paramsToCollectionFilter(params, 'documentAuthorType', this.authors, '_id');
    this.paramsToCollectionFilter(params, 'type', this.types, '_id');
    this.paramsToCollectionFilter(params, 'projectPhase', this.projectPhases, '_id');

    this.paramsToDateFilter(params, 'datePostedStart');
    this.paramsToDateFilter(params, 'datePostedEnd');
  }

  setParamsFromFilters(filterForUI) {
    this.collectionFilterToParams(filterForUI, 'milestone', '_id');
    this.collectionFilterToParams(filterForUI, 'documentAuthorType', '_id');
    this.collectionFilterToParams(filterForUI, 'type', '_id');
    this.collectionFilterToParams(filterForUI, 'projectPhase', '_id');
  }

  collectionFilterToParams(filterForUI, name, identifyBy) {
    if (filterForUI[name].length) {
      const values = filterForUI[name].map(record => { return record[identifyBy]; });
      this.filterForAPI[name] = values.join(',');
    }
  }
}
