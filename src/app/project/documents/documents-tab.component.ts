import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';

import * as moment from 'moment';
import * as _ from 'lodash';

import { Document } from 'app/models/document';
import { SearchTerms } from 'app/models/search';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';

import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';

import { ApiService } from 'app/services/api';
import { SearchService } from 'app/services/search.service';
import { StorageService } from 'app/services/storage.service';
import { Constants } from 'app/shared/utils/constants';

class DocumentFilterObject {
  constructor(
    public milestone: Array<string> = [],
    public datePostedStart: object = {},
    public datePostedEnd: object = {},
    public type: Array<string> = [],
    public projectPhase: Array<string> = [],
    public documentAuthorType: Array<string> = []
  ) { }
}

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  styleUrls: ['./documents-tab.component.scss']
})

export class DocumentsTabComponent implements OnInit, OnDestroy {
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

  public filterForUI: DocumentFilterObject = new DocumentFilterObject();

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

  public searchDisclaimer = Constants.searchDisclaimer;

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
      name: '★',
      value: 'isFeatured',
      width: 'col-1'
    },
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-3'
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
      name: 'Phase',
      value: 'phase',
      width: 'col-2'
    }
  ];

  public selectedCount = 0;
  public currentProject;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private searchService: SearchService,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplateUtils
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
          if (res.documentsTableRow && res.documentsTableRow.length > 0) {

            this.milestones = [];
            this.types = [];
            this.authors = [];
            this.projectPhases = [];

            res.documentsTableRow[0].searchResults.map(item => {
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

          this.currentProject = this.storageService.state.currentProject.data;

          if (this.currentProject && this.storageService.state[this.currentProject._id]) {
            if (this.storageService.state[this.currentProject._id].filterForUI) {
              this.filterForUI = this.storageService.state[this.currentProject._id].filterForUI;
              this.setParamsFromFilters(params);
            }

            if (this.storageService.state[this.currentProject._id].tableParams) {
              this.tableParams = this.storageService.state[this.currentProject._id].tableParams;
            }
          }

          if (!this.tableParams) {
            this.tableParams = this.tableTemplateUtils.getParamsFromUrl(params, this.filterForURL);
          }

          this.setFiltersFromParams(params);

          this.updateCounts();

          if (res.documents && res.documents[0].data.meta && res.documents[0].data.meta.length > 0) {
            this.tableParams.totalListItems = res.documents[0].data.meta[0].searchResultsTotal;
            this.documents = res.documents[0].data.searchResults;
          } else {
            this.tableParams.totalListItems = 0;
            this.documents = [];
          }

          this.loading = false;
          this.setDocumentRowData();
          this._changeDetectionRef.detectChanges();
        } else {
          alert('Uh-oh, couldn\'t load valued components');
          // project not found --> navigate back to search
          this.router.navigate(['/search']);
          this.loading = false;
          this._changeDetectionRef.detectChanges();
        }
      });

    this.currentProject = this.storageService.state.currentProject.data;

    if (!this.storageService.state[this.currentProject._id]) {
      this.storageService.state[this.currentProject._id] = {};
    }

    this.searchService.getSearchResults(
      '',
      'Document',
      [
        { name: 'project', value: this.currentProject._id },
        { name: 'categorized', value: false }
      ],
      this.storageService.state[this.currentProject._id].tableParams ? this.storageService.state[this.currentProject._id].tableParams.currentPage : 1,
      this.storageService.state[this.currentProject._id].tableParams ? this.storageService.state[this.currentProject._id].tableParams.pageSize : 10,
      this.storageService.state[this.currentProject._id].tableParams ? this.storageService.state[this.currentProject._id].tableParams.sortBy : '-datePosted',
      { documentSource: 'PROJECT' },
      true,
      null,
      this.filterForAPI,
      ''
    )
    .takeUntil(this.ngUnsubscribe)
    .subscribe((res: any) => {
      if (res[0].data.meta && res[0].data.meta.length > 0) {
        this.hasUncategorizedDocs = true;
        this.loading = false;
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  public selectAction(action) {
    // select all documents
    switch (action) {
      case 'copyLink':
        this.documentTableData.data.map((item) => {
          if (item.checkbox === true) {
            let selBox = document.createElement('textarea');
            selBox.style.position = 'fixed';
            selBox.style.left = '0';
            selBox.style.top = '0';
            selBox.style.opacity = '0';
            selBox.value = window.location.href.split(';')[0] + `/detail/${item._id}`;
            document.body.appendChild(selBox);
            selBox.focus();
            selBox.select();
            document.execCommand('copy');
            document.body.removeChild(selBox);
          }
        });
        break;
      case 'selectAll':
        let someSelected = false;
        this.documentTableData.data.map((item) => {
          if (item.checkbox === true) {
            someSelected = true;
          }
        });
        this.documentTableData.data.map((item) => {
          item.checkbox = !someSelected;
        });

        this.selectedCount = someSelected ? 0 : this.documentTableData.data.length;
        this._changeDetectionRef.detectChanges();
        break;
      case 'download':
        let promises = [];
        this.documentTableData.data.map((item) => {
          if (item.checkbox === true) {
            promises.push(this.api.downloadDocument(this.documents.filter(d => d._id === item._id)[0]));
          }
        });
        return Promise.all(promises).then(() => {
          console.log('Download initiated for file(s)');
        });
    }
  }

  setDocumentRowData() {
    let documentList = [];
    if (this.documents && this.documents.length > 0) {
      this.documents.forEach(document => {
        if (document) {
          documentList.push(
            {
              documentFileName: document.documentFileName || document.displayName || document.internalOriginalName,
              // date: document.dateUploaded || document.datePosted,
              displayName: document.displayName,
              datePosted: document.datePosted,
              type: document.type,
              milestone: document.milestone,
              _id: document._id,
              project: document.project,
              isFeatured: document.isFeatured,
              projectPhase: document.projectPhase
            }
          );
        }
      });
      this.documentTableData = new TableObject(
        DocumentTableRowsComponent,
        documentList,
        this.tableParams
      );
    }
  }

  setColumnSort(column) {
    if (this.tableParams.sortBy.charAt(0) === '+') {
      this.tableParams.sortBy = '-' + column;
    } else {
      this.tableParams.sortBy = '+' + column;
    }
    this.getPaginatedDocs(this.tableParams.currentPage);
  }

  isEnabled(button) {
    switch (button) {
      case 'copyLink':
        return this.selectedCount === 1;
      default:
        return this.selectedCount > 0;
    }
  }

  updateSelectedRow(count) {
    this.selectedCount = count;
  }

  paramsToCollectionFilters(params, name, collection, identifyBy) {
    delete this.filterForURL[name];
    delete this.filterForAPI[name];

    if (params[name] && collection) {
      let confirmedValues = [];
      // look up each value in collection
      const values = params[name].split(',');
      values.forEach(value => {
        const record = _.find(collection, [ identifyBy, value ]);
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
      this.storageService.state[this.currentProject._id].filterForAPI[name] = values.join(',');
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

  clearAll() {
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
    const getCount = (n) => { return Object.keys(this.filterForUI[n]).filter(k => this.filterForUI[n][k]).length; };

    let num = 0;
    if (name === 'date') {
      num += this.isNGBDate(this.filterForUI.datePostedStart) ? 1 : 0;
      num += this.isNGBDate(this.filterForUI.datePostedEnd) ? 1 : 0;
    } else {
      num = getCount(name);
    }
    this.numFilters[name] = num;
  }

  updateCounts() {
    this.updateCount('milestone');
    this.updateCount('date');
    this.updateCount('documentAuthorType');
    this.updateCount('type');
    this.updateCount('projectPhase');
  }

  getPaginatedDocs(pageNumber) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);
    this.loading = true;

    this.tableParams = this.tableTemplateUtils.updateTableParams(this.tableParams, pageNumber, this.tableParams.sortBy);

    // Filters and params are not set when paging
    // We don't need to redo everything, but we will
    // need to fetch the dates
    const params = this.terms.getParams();
    this.setParamsFromFilters(params);

    const datePostedStart = params.hasOwnProperty('datePostedStart') && params.datePostedStart ? params.datePostedStart : null;
    const datePostedEnd = params.hasOwnProperty('datePostedEnd') && params.datePostedEnd ? params.datePostedEnd : null;

    let queryModifiers = { documentSource: 'PROJECT' };

    if (datePostedStart !== null && datePostedEnd !== null) {
      queryModifiers['datePostedStart'] = datePostedStart;
      queryModifiers['datePostedEnd'] = datePostedEnd;
    }

    if (this.storageService) {
      this.storageService.state[this.currentProject._id].tableParams = this.tableParams;
    }

    this.searchService.getSearchResults(
      this.tableParams.keywords,
      'Document',
      [{ 'name': 'project', 'value': this.currentProject._id }],
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
        this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
        this.documents = res[0].data.searchResults;
        this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, this.filterForURL, this.tableParams.keywords);
        this.setDocumentRowData();
        this.loading = false;
        this._changeDetectionRef.detectChanges();
      });
  }

  clearSelectedItem(filterKey: string, item: any) {
    this.filterForUI[filterKey] = this.filterForUI[filterKey].filter(option => option._id !== item._id);
  }


  public filterCompareWith(filterKey: any, filterToCompare: any) {
    if (filterKey.hasOwnProperty('code')) {
      return filterKey && filterToCompare
              ? filterKey.code === filterToCompare.code
              : filterKey === filterToCompare;
    } else if (filterKey.hasOwnProperty('_id')) {
      return filterKey && filterToCompare
              ? filterKey._id === filterToCompare._id
              : filterKey === filterToCompare;
    }
  }

  public onSubmit() {
    // dismiss any open snackbar
    // if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    // NOTE: Angular Router doesn't reload page on same URL
    // REF: https://stackoverflow.com/questions/40983055/how-to-reload-the-current-route-with-the-angular-2-router
    // WORKAROUND: add timestamp to force URL to be different than last time

    const params = this.terms.getParams();
    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.tableParams.currentPage;
    params['sortBy'] = this.tableParams.sortBy = '';
    params['keywords'] = this.tableParams.keywords;
    params['pageSize'] = this.tableParams.pageSize;

    if (this.storageService) {
      this.storageService.state[this.currentProject._id].tableParams = this.tableParams;
      this.storageService.state[this.currentProject._id].filterForUI = this.filterForUI;
      this.storageService.state[this.currentProject._id].filterForAPI = {};
    }

    this.setParamsFromFilters(params);


    this.router.navigate(['p', this.currentProject._id, 'documents', params]);
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

}
