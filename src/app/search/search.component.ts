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
import { FilterObject } from 'app/shared/components/table-template/filter-object';
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

  public filters: FilterObject[] = [];

  public searchDisclaimer = Constants.docSearchDisclaimer;

  public documentTableData: TableObject;
  public documentTableColumns: any[] = [
    {
      name: 'Document Name',
      value: 'displayName',
      width: 'col-5'
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
  ];

  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  private milestoneFilter = new FilterObject('milestone', 'Milestone', false, [], [], false, this.legislationFilterGroup);
  private docDateFilter = new FilterObject('datePosted', 'Document Date', true, [], [], false, this.legislationFilterGroup);
  private authorTypeFilter = new FilterObject('documentAuthorType', 'Document Author', false, [], [], false, this.legislationFilterGroup);
  private docTypeFilter = new FilterObject('type', 'Document Type', false, [], [], false, this.legislationFilterGroup);
  private projectPhaseFilter = new FilterObject('projectPhase', 'Project Phase', false, [], [], false, this.legislationFilterGroup);

  constructor(
    public snackBar: MatSnackBar,
    private _changeDetectionRef: ChangeDetectorRef,
    public api: ApiService,
    private storageService: StorageService,
    public searchService: SearchService, // also used in template
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplateUtils,
  ) {
    // prebake for table
    this.documentTableData = new TableObject(
      DocSearchTableRowsComponent,
      [],
      this.tableParams
    );

    // inject filters into table template
    this.filters.push(this.milestoneFilter);
    this.filters.push(this.docDateFilter);
    this.filters.push(this.authorTypeFilter);
    this.filters.push(this.docTypeFilter);
    this.filters.push(this.projectPhaseFilter);
   }

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

            res.documentsTableRows[0].searchResults.map(item => {
              if (item.type === 'label') {
                this.milestoneFilter.options.push({ ...item });
              } else if (item.type === 'doctype') {
                this.docTypeFilter.options.push({ ...item });
              } else if (item.type === 'author') {
                this.authorTypeFilter.options.push({ ...item });
              } else if (item.type === 'projectPhase') {
                this.projectPhaseFilter.options.push({ ...item });
              }
            });

            // Sort by legislation.
            this.milestoneFilter.options = _.sortBy(this.milestoneFilter.options, ['legislation']);
            this.authorTypeFilter.options = _.sortBy(this.authorTypeFilter.options, ['legislation']);
            this.docTypeFilter.options = _.sortBy(this.docTypeFilter.options, ['legislation', 'listOrder']);
            this.projectPhaseFilter.options = _.sortBy(this.projectPhaseFilter.options, ['legislation']);
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
    this.paramsToCollectionFilters(params, 'milestone', this.milestoneFilter.options, '_id');
    this.paramsToCollectionFilters(params, 'documentAuthorType', this.authorTypeFilter.options, '_id');
    this.paramsToCollectionFilters(params, 'type', this.docTypeFilter.options, '_id');
    this.paramsToCollectionFilters(params, 'projectPhase', this.projectPhaseFilter.options, '_id');

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

  executeSearch(apiFilters) {
    console.log(apiFilters);

    this.terms.keywords = apiFilters.keywords;
    this.filterForAPI = apiFilters.filterForAPI;

    this.getPaginated(this.tableParams.currentPage);
  }

  getPaginated(pageNumber) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);
    this.loading = true;
    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, this.tableParams.sortBy);

    // Filters and params are not set when paging
    // We don't need to redo everything, but we will
    // need to fetch the dates
    // const params = this.terms.getParams();

    // this.setParamsFromFilters(params);
    // this.setFiltersFromParams(params);

    let queryModifiers = { documentSource: 'PROJECT' };

    if (this.storageService && this.storageService.state.search) {
      this.filterForAPI = this.storageService.state.search.filterForAPI ? this.storageService.state.search.filterForAPI : {};
      this.storageService.state.search.tableParams = this.tableParams;
    }

    // if (this.terms.keywords !== this.previousKeyword || JSON.stringify(this.filterForAPI) !== JSON.stringify(this.previousFilters)) {
    //   this.tableParams = new TableParamsObject();
    //   pageNumber = 1;
    //   this.tableParams.sortBy = '-datePosted,+displayName'
    // }

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
    }
    this.documentTableData = new TableObject(
      DocSearchTableRowsComponent,
      documentList,
      this.tableParams
    );
  }

  ngOnDestroy() {
    // dismiss any open snackbar
    if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
