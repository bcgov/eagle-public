import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatSnackBarRef, SimpleSnackBar, MatSnackBar } from '@angular/material';
import { Router, ActivatedRoute } from '@angular/router';

import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';

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
      width: 'col-4'
    },
    {
      name: 'Project',
      value: 'project.name',
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

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  private milestoneFilter = new FilterObject('milestone', 'Milestone', null, [], [], this.legislationFilterGroup);
  private docDateFilter = new FilterObject('datePosted', 'Document Date', { startDateId: 'datePostedStart', endDateId: 'datePostedEnd' }, [], [], this.legislationFilterGroup);
  private authorTypeFilter = new FilterObject('documentAuthorType', 'Document Author', null, [], [], this.legislationFilterGroup);
  private docTypeFilter = new FilterObject('type', 'Document Type', null, [], [], this.legislationFilterGroup);
  private projectPhaseFilter = new FilterObject('projectPhase', 'Project Phase', null, [], [], this.legislationFilterGroup);

  constructor(
    public snackBar: MatSnackBar,
    private _changeDetectionRef: ChangeDetectorRef,
    public api: ApiService,
    private storageService: StorageService,
    public searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplateUtils,
  ) {
      // inject filters into table template
      this.filters.push(this.milestoneFilter);
      this.filters.push(this.docDateFilter);
      this.filters.push(this.authorTypeFilter);
      this.filters.push(this.docTypeFilter);
      this.filters.push(this.projectPhaseFilter);

    // prebake for table
    this.documentTableData = new TableObject(
      DocSearchTableRowsComponent,
      [],
      this.tableParams
    );
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
              this.tableParams = this.storageService.state.search.tableParams;
              this.categorizedQuery = this.storageService.state.search.categorizedQuery
          }

          // set default params or load from url
          if (_.isEqual(this.tableParams, new TableParamsObject())) {
            this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, this.filterForAPI);
            this.terms.keywords = this.tableParams.keywords;
          }

          if (res.documents && res.documents[0].data && res.documents[0].data.meta.length > 0) {
            this.tableParams.totalListItems = res.documents[0].data.meta[0].searchResultsTotal;
            this.documents = res.documents[0].data.searchResults;
          } else {
            if (!this.tableParams) {
              this.tableParams = new TableParamsObject(10, 1, 0, '-name', null);
            }
            this.tableParams.totalListItems = 0;
            this.documents = [];
          }

          // If the route has configs specified in the URL
          // automatically select them in the components
          this.router.url.split(';').forEach(filterVal => {
            if (filterVal.split('=').length === 2) {
              let filterName = filterVal.split('=')[0];
              let val = filterVal.split('=')[1];

              if (val && val !== 'null' && val.length !== 0) {
                if (!['currentPage', 'pageSize', 'sortBy', 'ms', 'keywords'].includes(filterName)) {
                  this.filterForAPI[filterName] = val;
                }
              }
            }
          });

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
    this.terms.keywords = apiFilters.keywords;
    this.tableParams.keywords = apiFilters.keywords;
    this.filterForAPI = apiFilters.filterForAPI;

    // build filterForUI/URL from the new filterForAPI object
    this.filterForUI.milestone = this.filterForAPI['milestone'] ? this.filterForAPI['milestone'].split(',') : null;
    this.filterForUI.documentAuthorType = this.filterForAPI['documentAuthorType'] ? this.filterForAPI['documentAuthorType'].split(',') : null;
    this.filterForUI.type = this.filterForAPI['type'] ? this.filterForAPI['type'].split(',') : null;
    this.filterForUI.projectPhase = this.filterForAPI['projectPhase'] ? this.filterForAPI['projectPhase'].split(',') : null;
    this.filterForUI.datePostedStart = this.filterForAPI['datePostedStart'];
    this.filterForUI.datePostedEnd = this.filterForAPI['datePostedEnd'];

    this.getPaginated(this.tableParams.currentPage);
  }

  getPaginated(pageNumber) {
    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, this.tableParams.sortBy);

    let queryModifiers = { documentSource: 'PROJECT' };

    if (this.storageService && this.storageService.state.search) {
      this.storageService.state.search.tableParams = this.tableParams;
    }

    this.isCategorizedQuery();
    this.tableParams.keywords = this.terms.keywords;

    if (this.storageService && this.storageService.state) {
      this.storageService.state.search = {};
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
      '',
      true)
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        if (res && res[0].data && res[0].data.meta.length > 0) {
          this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
          this.documents = res[0].data.searchResults;
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, this.filterForAPI, this.tableParams.keywords);
        } else {
          this.tableParams.totalListItems = 0;
          this.documents = [];
        }
        this.setRowData();
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

  setColumnSort() {
  }
  ngOnDestroy() {
    // dismiss any open snackbar
    if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
