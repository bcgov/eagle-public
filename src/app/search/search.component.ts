import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatSnackBarRef, SimpleSnackBar, MatSnackBar } from '@angular/material';
import { Router, ActivatedRoute } from '@angular/router';

import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';
import * as moment from 'moment';

import { Document } from 'app/models/document';

import { SearchTerms } from 'app/models/search';

import { ApiService } from 'app/services/api';
import { SearchService } from 'app/services/search.service';

import { Constants } from 'app/shared/utils/constants';

import { DocSearchTableRowsComponent } from './search-documents-table-rows/search-document-table-rows.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { StorageService } from 'app/services/storage.service';

class SearchFilterObject {
  constructor(
    // Document
    public milestone: Array<string> = [],
    public datePostedStart: object = {},
    public datePostedEnd: object = {},
    public type: Array<string> = [],
    public documentAuthorType: Array<string> = [],
    public projectPhase: Array<string> = []

  ) { }
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})


export class SearchComponent implements OnInit, OnDestroy {
  public documents: Document[] = null;

  public milestones: any[] = [];
  public authors: any[] = [];
  public types: any[] = [];
  public projectPhases: any[] = [];

  public loading = true;

  public tableParams: TableParamsObject = new TableParamsObject();
  public terms = new SearchTerms();

  public filterForURL: object = {};
  public filterForAPI: object = {};
  public filterForUI: SearchFilterObject = new SearchFilterObject();
  public currentSearch: object = {};
  public categorizedQuery: any[] = [];

  public showAdvancedSearch = true;
  public hasUncategorizedDocs = false;
  public readonly constants = Constants;

  public showFilters: object = {
    date: false,
    type: false,
    milestone: false,
    projectPhase: false,
    documentAuthorType: false
  };

  public searchDisclaimer = Constants.docSearchDisclaimer;

  public numFilters: object = {
    date: 0,
    type: 0,
    milestone: 0,
    projectPhase: 0,
    documentAuthorType: 0
  };

  public documentTableData: TableObject;
  public documentTableColumns: any[] = [
    {
      name: 'Document Name',
      value: 'displayName',
      width: 'col-4'
    },
    {
      name: 'Project',
      value: 'projectName',
      width: 'col-2'
    },
    {
      name: 'Date',
      value: 'datePosted',
      width: 'col-2'
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2'
    },
    {
      name: 'Milestone',
      value: 'milestone',
      width: 'col-2'
    },
    {
      name: 'Download',
      value: '',
      width: 'col-1',
      nosort: true,
    },
  ];

  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  private previousFilters;
  private previousKeyword;

  constructor(
    public snackBar: MatSnackBar,
    private _changeDetectionRef: ChangeDetectorRef,
    public api: ApiService,
    private storageService: StorageService,
    public searchService: SearchService, // also used in template
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplateUtils,
  ) { }

  ngOnInit() {
    let params = null;
    this.route.params
      .switchMap((res: any) => {
        params = { ...res };
        return this.route.data;
      })
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res) {
          // Get the lists first
          if (res.documentsTableRows && res.documentsTableRows.length > 0) {

            this.milestones = [];
            this.types = [];
            this.authors = [];
            this.projectPhases = [];

            res.documentsTableRows[0].searchResults.map(item => {
              if (item.type === 'label') {
                this.milestones.push({ ...item });
              } else if (item.type === 'doctype') {
                this.types.push({ ...item });
              } else if (item.type === 'author') {
                this.authors.push({ ...item });
              } else if (item.type === 'projectPhase') {
                this.projectPhases.push({ ...item });
              }
            });

            // Sort by legislation.
            this.milestones = _.sortBy(this.milestones, ['legislation']);
            this.authors = _.sortBy(this.authors, ['legislation']);
            this.types = _.sortBy(this.types, ['legislation', 'listOrder']);
            this.projectPhases = _.sortBy(this.projectPhases, ['legislation']);
          }

          // reload query params from storage
          if (this.storageService.state.search) {
              this.filterForUI = this.storageService.state.search.filterForUI;
              this.tableParams = this.storageService.state.search.tableParams;
              this.categorizedQuery = this.storageService.state.search.categorizedQuery
          }

          this.setFiltersFromParams(params);

          // set default params or load from url
          if (_.isEqual(this.tableParams, new TableParamsObject())) {
            this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, this.filterForURL);
            this.terms.keywords = this.tableParams.keywords;
          }

          this.updateCounts();

          if (res.documents && res.documents[0].data && res.documents[0].data.meta.length > 0) {
            this.tableParams.totalListItems = res.documents[0].data.meta[0].searchResultsTotal;
            this.documents = res.documents[0].data.searchResults;
          } else {
            this.tableParams.totalListItems = 0;
            this.documents = [];
          }

          this.loading = false;
          this.setRowData();
          this._changeDetectionRef.detectChanges();
        } else {
          this.loading = false;
          this.snackBarRef = this.snackBar.open('Error search documents ...', 'RETRY');
          this.snackBarRef.onAction().subscribe(() => this.getPaginated(1));
          this.router.navigate(['/search']);
          this.loading = false;
          this._changeDetectionRef.detectChanges();
        }

        // We need to clone filters, not reference
        this.previousFilters = { ...this.filterForAPI };
        this.previousKeyword = this.terms.keywords;

      });
  }

  paramsToCollectionFilters(params, name, collection, identifyBy) {
    delete this.filterForURL[name];
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
        this.filterForURL[name] = confirmedValues.join(',');
        this.filterForAPI[name] = confirmedValues.join(',');
      }
    }
  }

  paramsToDateFilters(params, name) {
    this.filterForUI[name] = null;
    delete this.filterForURL[name];
    delete this.filterForAPI[name];

    if (params[name]) {
      this.filterForURL[name] = params[name];
      this.filterForAPI[name] = params[name];
      // NGB Date
      const date = moment(params[name]).toDate();
      this.filterForUI[name] = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
    }
  }

  setFiltersFromParams(params) {
    this.paramsToCollectionFilters(params, 'milestone', this.milestones, '_id');
    this.paramsToCollectionFilters(params, 'documentAuthorType', this.authors, '_id');
    this.paramsToCollectionFilters(params, 'type', this.types, '_id');
    this.paramsToCollectionFilters(params, 'projectPhase', this.projectPhases, '_id');

    this.paramsToDateFilters(params, 'datePostedStart');
    this.paramsToDateFilters(params, 'datePostedEnd');
  }

collectionFilterToParams(params, name, identifyBy) {
    if (this.filterForUI[name].length) {
      const values = this.filterForUI[name].map(record => { return record[identifyBy]; });
      params[name] = values.join(',');
      this.filterForAPI[name] = values.join(',')
      if (this.storageService.state.search && this.storageService.state.search.filterForAPI) {
        this.storageService.state.search.filterForAPI = this.filterForAPI;
      }
    }
  }

  isNGBDate(date) {
    return date && date.year && date.month && date.day;
  }

  dateFilterToParams(params, name) {
    if (this.isNGBDate(this.filterForUI[name])) {
      const date = new Date(this.filterForUI[name].year, this.filterForUI[name].month - 1, this.filterForUI[name].day);
      params[name] = moment(date).format('YYYY-MM-DD');
    }
  }

  setParamsFromFilters(params) {
    this.collectionFilterToParams(params, 'milestone', '_id');
    this.collectionFilterToParams(params, 'documentAuthorType', '_id');
    this.collectionFilterToParams(params, 'type', '_id');
    this.collectionFilterToParams(params, 'projectPhase', '_id');

    this.dateFilterToParams(params, 'datePostedStart');
    this.dateFilterToParams(params, 'datePostedEnd');
  }

  toggleFilter(name) {
    if (this.showFilters[name]) {
      this.updateCount(name);
      this.showFilters[name] = false;
    } else {
      Object.keys(this.showFilters).forEach(key => {
        if (this.showFilters[key]) {
          this.updateCount(key);
          this.showFilters[key] = false;
        }
      });
      this.showFilters[name] = true;
    }
  }

  isShowingFilter() {
    return Object.keys(this.showFilters).some(key => { return this.showFilters[key]; });
  }

  hideAllFilters() {
    Object.keys(this.showFilters).forEach(key => {
      this.showFilters[key] = false;
    });
  }

  hasFilter() {
    this.updateCounts();
    return Object.keys(this.numFilters).some(key => { return this.numFilters[key]; });
  }

  clearAllFilters() {
    this.tableParams.keywords = '';
    this.terms.keywords = '';
    delete this.filterForURL['keywords'];
    Object.keys(this.filterForUI).forEach(key => {
      if (this.filterForUI[key]) {
        if (Array.isArray(this.filterForUI[key])) {
          this.filterForUI[key] = [];
        } else if (typeof this.filterForUI[key] === 'object') {
          this.filterForUI[key] = {};
        } else {
          this.filterForUI[key] = '';
        }
      }
    });
    this.updateCounts();
  }

  updateCount(name) {
    const gettotalListItems = (n) => { return Object.keys(this.filterForUI[n]).filter(k => this.filterForUI[n][k]).length; };

    let num = 0;
    if (name === 'date') {
      num += this.isNGBDate(this.filterForUI.datePostedStart) ? 1 : 0;
      num += this.isNGBDate(this.filterForUI.datePostedEnd) ? 1 : 0;
    } else {
      num = gettotalListItems(name);
    }
    this.numFilters[name] = num;
  }

  updateCounts() {
    // Documents
    this.updateCount('milestone');
    this.updateCount('date');
    this.updateCount('documentAuthorType');
    this.updateCount('type');
    this.updateCount('projectPhase');
  }

  setColumnSort(column) {
    if (this.tableParams.sortBy.charAt(0) === '+') {
      this.tableParams.sortBy = '-' + column;
    } else {
      this.tableParams.sortBy = '+' + column;
    }
    this.getPaginated(this.tableParams.currentPage);
  }

  isCategorizedQuery() {
    const categorizedFilters = ['documentAuthorType', 'milestone', 'projectPhase', 'type'];
    let isCategorized = false;
    Object.keys(this.filterForAPI).forEach(key => {
      if (categorizedFilters.includes(key)) {
        isCategorized = true;
      }
    });

    if (isCategorized) {
      this.categorizedQuery = [{ name: 'categorized', value: true }];
    }

    if (this.storageService && this.storageService.state.search) {
      this.storageService.state.search.categorizedQuery = this.categorizedQuery;
    }
  }

  getPaginated(pageNumber) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);
    this.loading = true;
    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, this.tableParams.sortBy);

    // Filters and params are not set when paging
    // We don't need to redo everything, but we will
    // need to fetch the dates
    const params = this.terms.getParams();

    this.setParamsFromFilters(params);
    this.setFiltersFromParams(params);

    let queryModifiers = { documentSource: 'PROJECT' };

    if (this.storageService && this.storageService.state.search) {
      this.filterForAPI = this.storageService.state.search.filterForAPI ? this.storageService.state.search.filterForAPI : {};
      this.storageService.state.search.tableParams = this.tableParams;
    }

    if (this.terms.keywords !== this.previousKeyword || JSON.stringify(this.filterForAPI) !== JSON.stringify(this.previousFilters)) {
      this.tableParams = new TableParamsObject();
      pageNumber = 1;
      this.tableParams.sortBy = '-datePosted,+displayName'
    }
    this.isCategorizedQuery();
    this.tableParams.keywords = this.terms.keywords;

    if (this.storageService && this.storageService.state) {
      this.storageService.state.search = {};
      this.storageService.state.search.tableParams = this.tableParams;
      this.storageService.state.search.filterForUI = this.filterForUI;
      this.storageService.state.search.filterForURL = this.filterForURL;
      this.storageService.state.search.filterForAPI = this.filterForAPI;
      this.storageService.state.search.categorizedQuery = this.categorizedQuery;
    }

    this.searchService.getSearchResults(
      this.terms.keywords,
      'Document',
      this.categorizedQuery,
      pageNumber,
      this.tableParams.pageSize,
      this.tableParams.sortBy,
      queryModifiers,
      true,
      null,
      this.filterForAPI,
      '')
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res && res[0].data && res[0].data.meta.length > 0) {
          this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
          this.documents = res[0].data.searchResults;
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, this.filterForURL, this.tableParams.keywords);
        } else {
          this.tableParams.totalListItems = 0;
          this.documents = [];
        }
        this.setRowData();
        this.loading = false;
        this._changeDetectionRef.detectChanges();
        this.previousFilters = { ...this.filterForAPI };
        this.previousKeyword = this.terms.keywords;
      });
  }

  setRowData() {
    let documentList = [];
    if (this.documents && this.documents.length > 0) {
      this.documents.forEach(document => {
        if (document) {
          documentList.push(
            {
              documentFileName: document.documentFileName || document.displayName || document.internalOriginalName,
              displayName: document.displayName,
              datePosted: document.datePosted,
              type: document.type,
              milestone: document.milestone,
              _id: document._id,
              project: document.project,
              projectPhase: document.projectPhase
            }
          );
        }
      });
      this.documentTableData = new TableObject(
        DocSearchTableRowsComponent,
        documentList,
        this.tableParams
      );
    }
  }

  // Compares selected options when a dropdown is grouped by legislation.
  compareDropdownOptions(optionA: any, optionB: any) {
    if ((optionA.name === optionB.name) && (optionA.legislation === optionB.legislation)) {
      return true;
    }

    return false;
  }

  clearSelectedItem(filter: string, item: any) {
    this.filterForUI[filter] = this.filterForUI[filter].filter(option => option._id !== item._id);
  }

  public filterCompareWith(filter: any, filterToCompare: any) {
    if (filter.hasOwnProperty('code')) {
      return filter && filterToCompare
        ? filter.code === filterToCompare.code
        : filter === filterToCompare;
    } else if (filter.hasOwnProperty('_id')) {
      return filter && filterToCompare
        ? filter._id === filterToCompare._id
        : filter === filterToCompare;
    }
  }

  ngOnDestroy() {
    // dismiss any open snackbar
    if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
