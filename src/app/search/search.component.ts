import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy, DoCheck, ViewEncapsulation, Output, EventEmitter } from '@angular/core';
import { MatSnackBarRef, SimpleSnackBar, MatSnackBar } from '@angular/material';
import { Router, ActivatedRoute } from '@angular/router';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';
import * as moment from 'moment';

import { Document } from 'app/models/document';
import { DocumentTableRowsComponent } from 'app/project/documents/project-document-table-rows/project-document-table-rows.component';
import { Org } from 'app/models/organization';
import { SearchTerms } from 'app/models/search';

import { ApiService } from 'app/services/api';
import { OrgService } from 'app/services/org.service';
import { SearchService } from 'app/services/search.service';

import { Constants } from 'app/shared/utils/constants';

import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { StorageService } from 'app/services/storage.service';
import { ProjectListTableRowsComponent } from 'app/projects/project-list/project-list-table-rows/project-list-table-rows.component';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { TableComponent } from 'app/shared/components/table-template/table.component';

// TODO: Project and Document filters should be made into components
class SearchFilterObject {
  constructor(
    // Project
    public projectType: object = {},
    public eacDecision: object = {},
    public decisionDateStart: object = {},
    public decisionDateEnd: object = {},
    public pcp: object = {},
    public proponent: Array<Org> = [],
    public region: Array<string> = [],
    public CEAAInvolvement: Array<string> = [],
    // Document
    public milestone: Array<string> = [],
    public datePostedStart: object = {},
    public datePostedEnd: object = {},
    public docType: Array<string> = [],
    public documentAuthorType: Array<string> = [],
    // both
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

export class SearchComponent implements OnInit, OnDestroy, DoCheck, TableComponent {
  public readonly constants = Constants;
  public data: Array<any> = [];
  public proponents: Array<Org> = [];
  public regions: Array<object> = [];
  public ceaaInvolvements: Array<object> = [];
  public eacDecisions: Array<object> = [];
  public commentPeriods: Array<object> = [];
  public projectTypes: Array<object> = [];

  public milestones: any[] = [];
  public authors: any[] = [];
  public docTypes: any[] = [];
  public projectPhases: any[] = [];
  public loading = true;

  public filterForURL: object = {}; // Not used on this page yet
  public filterForAPI: object = {};
  public filterForUI: SearchFilterObject = new SearchFilterObject();

  public showAdvancedSearch = true;

  public showFilters: object = {
    projectType: false,
    eacDecision: false,
    pcp: false,
    more: false,
    milestone: false,
    date: false,
    documentAuthorType: false,
    docType: false,
    projectPhase: false
  };

  public numFilters: object = {
    projectType: 0,
    eacDecision: 0,
    pcp: 0,
    more: 0,
    milestone: 0,
    date: 0,
    documentAuthorType: 0,
    docType: 0,
    projectPhase: 0
  };

  public searchDisclaimer = Constants.searchDisclaimer;
  public terms = new SearchTerms();
  private ngUnsubscribe = new Subject<boolean>();

  private snackBarRef: MatSnackBarRef<SimpleSnackBar> = null;

  public searching = false;
  public ranSearch = false;
  public keywords: string;
  public hadFilter = false;

  public totalListItems = 0; // for template
  public currentPage = 1;
  public pageSize = 10;

  private togglingOpen = '';

  public pageSizeArray: number[];

  // These values should be moved into Lists instead of being hard-coded all over the place

  private REGIONS_COLLECTION: Array<object> = [
    { code: 'Cariboo', name: 'Cariboo' },
    { code: 'Kootenay', name: 'Kootenay' },
    { code: 'Lower Mainland', name: 'Lower Mainland' },
    { code: 'Okanagan', name: 'Okanagan' },
    { code: 'Omineca', name: 'Omineca' },
    { code: 'Peace', name: 'Peace' },
    { code: 'Skeena', name: 'Skeena' },
    { code: 'Thompson-Nicola', name: 'Thompson-Nicola' },
    { code: 'Vancouver Island', name: 'Vancouver Island' }
  ];

  public documents: Document[] = null;
  public documentTableData: TableObject;
  public documentTableColumns: any[] = [
    {
      name: 'Name',
      value: 'displayName',
      width: 'col-5'
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
    }
  ];

  public projectTableData: TableObject;
  public projectTableColumns: any[] = [
    {
      name: 'Name',
      value: 'name',
      width: 'col-2'
    },
    {
      name: 'Proponent',
      value: 'proponent.name',
      width: 'col-2'
    },
    {
      name: 'Type',
      value: 'type',
      width: 'col-2'
    },
    {
      name: 'Region',
      value: 'region',
      width: 'col-2'
    },
    {
      name: 'Phase',
      value: 'currentPhaseName',
      width: 'col-2'
    },
    {
      name: 'Decision',
      value: 'eacDecision',
      width: 'col-2'
    }
  ];

  public tableParams: TableParamsObject = new TableParamsObject();


  constructor(
    public snackBar: MatSnackBar,
    private _changeDetectionRef: ChangeDetectorRef,
    public api: ApiService,
    private orgService: OrgService,
    private storageService: StorageService,
    public searchService: SearchService, // also used in template
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplateUtils,
  ) { }

  // TODO: when clicking on radio buttons, url must change to reflect dataset.

  ngOnInit() {
    // Fetch the Lists
    this.searchService.getFullList('List')
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
                this.docTypes.push({ ...item });
                break;
              case 'eaDecisions':
                this.eacDecisions.push({ ...item });
                break;
              case 'ceaaInvolvements':
                this.ceaaInvolvements.push({ ...item });
                break;
              case 'projectPhase':
                this.projectPhases.push({ ...item });
                break;
              default:
                break;
            }
          });
        }

        // This code reorders the document type list defined by EAO (See Jira Ticket EAGLE-88)
        // todo how are we handling these lists with legislation year in advanced search? EE-406
        // this.docTypes = this.docTypes.filter(item => item.legislation === 2002);
        this.docTypes = _.sortBy(this.docTypes, ['legislation', 'listOrder']);

        // Sort by legislation.
        this.milestones = _.sortBy(this.milestones, ['legislation']);
        this.authors = _.sortBy(this.authors, ['legislation']);
        this.projectPhases = _.sortBy(this.projectPhases, ['legislation']);
        this.eacDecisions = _.sortBy(this.eacDecisions, ['legislation', 'listOrder']);
        this.ceaaInvolvements = _.sortBy(this.ceaaInvolvements, ['legislation', 'listOrder']);

        // Fetch proponents and other collections
        // TODO: Put all of these into Lists
        return this.orgService.getByCompanyType('Proponent/Certificate Holder');
      })
      .switchMap((res: any) => {
        this.proponents = res || [];

        this.regions = this.REGIONS_COLLECTION;
        this.commentPeriods = Constants.PCP_COLLECTION;
        this.projectTypes = Constants.PROJECT_TYPE_COLLECTION;

        return this.route.params;
      })
      .switchMap((res: any) => {
        let params = { ...res };

        this.terms.keywords = params.keywords || null;
        this.terms.dataset = params.dataset || 'Document';

        this.setFiltersFromParams(params);

        this.updatetotalListItemss();

        this.keywords = this.terms.keywords;
        this.hadFilter = this.hasFilter();

        // additional check to see if we have any filter elements applied to the
        // query string. Previously these were ignored on a refresh
        let filterKeys = Object.keys(this.filterForAPI);
        let hasFilterFromQueryString = (filterKeys && filterKeys.length > 0);

        if (_.isEmpty(this.terms.getParams())
          && !this.hasFilter()
          && !hasFilterFromQueryString) {
          return Observable.of(null);
        }

        this.data = [];

        this.searching = true;
        this.tableParams.totalListItems = 0;
        this.currentPage = params.currentPage ? params.currentPage : 1;
        this.pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 25;

        // remove doc and project types
        // The UI filters are remapping document and project type to the single 'Type' value
        // this means that whenever we map back to the filters, we need to revert them
        // from 'type', to the appropriate type. Additionally, the API will fail if we
        // send "docType" ir "projectType" as a filter, so we need to ensure these are
        // stripped from the filterForAPI
        delete this.filterForAPI['docType'];
        delete this.filterForAPI['projectType'];

        if (this.storageService && this.storageService.state.docList) {
          this.filterForAPI = this.storageService.state.docList.filterForAPI;
          this.filterForUI = this.storageService.state.docList.filterForUI;
          this.tableParams = this.storageService.state.docList.tableParams;
          this.setParamsFromFilters(params);
        }

        // retaining the filters when a user clicks back from a pagination
        // into the project list
        if (this.storageService && this.storageService.state.projList) {
          this.filterForAPI = this.storageService.state.projList.filterForAPI;
          this.filterForUI = this.storageService.state.projList.filterForUI;
          this.tableParams = this.storageService.state.projList.tableParams;
          this.setParamsFromFilters(params);
        }

        // if we're searching for projects, replace projectPhase with currentPhaseName
        // The code is called projectPhase, but the db column on projects is currentPhaseName
        // so the rename is required to pass in the correct query
        if (this.filterForAPI.hasOwnProperty('projectPhase') && this.terms.dataset === 'Project') {
          this.filterForAPI['currentPhaseName'] = this.filterForAPI['projectPhase'];
          delete this.filterForAPI['projectPhase'];
        }

        return this.searchService.getSearchResults(
          this.terms.keywords,
          this.terms.dataset,
          null,
          this.currentPage,
          this.pageSize,
          null,
          {},
          true,
          '',
          this.filterForAPI,
          ''
        );
      })
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        // if we renamed the projectPhase to currentPhaseName when querying for projects, revert
        // the change so the UI can function as normal
        if (this.filterForAPI.hasOwnProperty('currentPhaseName') && this.terms.dataset === 'Project') {
          this.filterForAPI['projectPhase'] = this.filterForAPI['currentPhaseName'];
          delete this.filterForAPI['currentPhaseName'];
        }

        if (res && res[0].data.meta.length > 0) {
          this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
          let items = res[0].data.searchResults;
          items.map(item => {
            if (this.terms.dataset === 'Document') {
              this.data.push(new Document(item));
              if (this.storageService) {
                this.storageService.state.docList = {};
                this.storageService.state.docList.filterForAPI = this.filterForAPI;
                this.storageService.state.docList.filterForUI = this.filterForUI;
                this.storageService.state.docList.tableParams = this.tableParams;
                this.storageService.state.docList.keywords = this.terms.keywords;
              }
            } else {
              this.data.push(item);
              // store the state of the filterForAPI set into the session
              // so a user can navigate back to this page without losing
              // their filters
              if (this.storageService) {
                this.storageService.state.projList = {};
                this.storageService.state.projList.filterForAPI = this.filterForAPI;
                this.storageService.state.projList.filterForUI = this.filterForUI;
                this.storageService.state.projList.tableParams = this.tableParams;
              }
            }
          });
        } else {
          this.tableParams.totalListItems = 0;
          this.data = [];
        }


        if (this.terms.dataset === 'Document') {
          this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, this.tableParams.currentPage, this.tableParams.pageSize, null, this.tableParams.keywords);
          this.setDocumentRowData();
        } else {
          this.setRowData();
        }
        this.loading = false;
        this.searching = false;
        this.ranSearch = true;
        this._changeDetectionRef.detectChanges();
        const pageSizeTemp = [10, 25, 50, 100, this.tableParams.totalListItems];
        this.pageSizeArray = pageSizeTemp.filter(function (el: number) { return el >= 10; });
        this.pageSizeArray.sort(function (a: number, b: number) { return a - b; });
      }, error => {
        console.log('error =', error);

        // update variables on error
        this.loading = false;
        this.searching = false;
        this.ranSearch = true;

        this.snackBarRef = this.snackBar.open('Error searching projects ...', 'RETRY');
        this.snackBarRef.onAction().subscribe(() => this.onSubmit());
      }, () => { // onCompleted
        // update variables on completion
      });
  }

  ngDoCheck() {
    if (this.togglingOpen) {
      // Focus on designated input when pane is opened
      let input = document.getElementById(this.togglingOpen + '_input');
      if (input) {
        input.focus();
        this.togglingOpen = '';
      }
    }
  }

  handleRadioChange(value) {
    this.terms.dataset = value;

    this.hideAllFilters();
    this.clearAllFilters();

    this.onSubmit();
  }

  updatePageNumber(pageNumber) {
    // Go to top of page after clicking to a different page.
    window.scrollTo(0, 0);
    this.currentPage = pageNumber;
    this.tableTemplateUtils.updateUrl(this.tableParams.sortBy, pageNumber, this.tableParams.pageSize, this.filterForURL, this.tableParams.keywords);
    this.onSubmit();
  }

  updatePageTableSize(pageSize) {
    window.scrollTo(0, 0);
    this.currentPage = 1;
    this.pageSize = parseInt(pageSize, 10);
    this.onSubmit();
  }

  paramsToCheckboxFilters(params, name, map) {
    const paramname = name === 'projectType' ? 'type' : name;

    this.filterForUI[name] = {};
    delete this.filterForURL[paramname];
    delete this.filterForAPI[paramname];

    if (params[paramname]) {
      this.filterForURL[paramname] = params[paramname];

      const values = params[paramname].split(',');
      let apiValues = [];
      values.forEach(value => {
        this.filterForUI[name][value] = true;
        apiValues.push(map && map[value] ? map[value] : value);
      });
      if (apiValues.length) {
        this.filterForAPI[paramname] = apiValues.join(',');
      }
    }
  }

  paramsToCollectionFilters(params, name, collection, identifyBy) {
    delete this.filterForURL[name];
    delete this.filterForAPI[name];

    // The UI filters are remapping document and project type to the single 'Type' value
    // this means that whenever we map back to the filters, we need to revert them
    // from 'type', to the appropriate type.
    let optionName = this.terms.dataset === 'Document' && name === 'type' ? 'docType' :
      this.terms.dataset === 'Project' && name === 'type' ? 'projectType' : name;

    if (optionName !== name) {
      delete this.filterForURL[optionName];
      delete this.filterForAPI[optionName];
    }

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
        if (optionName !== name) {
          this.filterForURL[optionName] = encodeURI(confirmedValues.join(','));
          this.filterForAPI[optionName] = confirmedValues.join(',');
        }

        this.filterForURL[name] = encodeURI(confirmedValues.join(','));
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
    if (this.terms.dataset === 'Project') {
      this.paramsToCollectionFilters(params, 'region', this.regions, 'code');
      this.paramsToCollectionFilters(params, 'CEAAInvolvement', this.ceaaInvolvements, '_id');
      this.paramsToCollectionFilters(params, 'proponent', this.proponents, '_id');
      this.paramsToCollectionFilters(params, 'eacDecision', this.eacDecisions, '_id');
      this.paramsToCollectionFilters(params, 'pcp', this.commentPeriods, 'code');
      this.paramsToCollectionFilters(params, 'projectType', this.projectTypes, 'name');
      this.paramsToCollectionFilters(params, 'type', this.projectTypes, 'name');
      this.paramsToCollectionFilters(params, 'projectPhase', this.projectPhases, '_id');

      this.paramsToDateFilters(params, 'decisionDateStart');
      this.paramsToDateFilters(params, 'decisionDateEnd');
    } else if (this.terms.dataset === 'Document') {
      this.paramsToCollectionFilters(params, 'milestone', this.milestones, '_id');
      this.paramsToCollectionFilters(params, 'documentAuthorType', this.authors, '_id');
      this.paramsToCollectionFilters(params, 'docType', this.docTypes, '_id');
      this.paramsToCollectionFilters(params, 'type', this.docTypes, '_id');
      this.paramsToCollectionFilters(params, 'projectPhase', this.projectPhases, '_id');

      this.paramsToDateFilters(params, 'datePostedStart');
      this.paramsToDateFilters(params, 'datePostedEnd');
    }
  }

  checkboxFilterToParams(params, name) {
    let keys = [];
    Object.keys(this.filterForUI[name]).forEach(key => {
      if (this.filterForUI[name][key]) {
        keys.push(key);
      }
    });
    if (keys.length) {
      params[name === 'projectType' ? 'type' : name] = keys.join(',');
    }
  }

  collectionFilterToParams(params, name, identifyBy) {
    if (this.filterForUI[name].length) {
      const values = this.filterForUI[name].map(record => { return record[identifyBy]; });
      params[(name === 'docType' || name === 'projectType') ? 'type' : name] = values.join(',');
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
    if (this.terms.dataset === 'Project') {
      this.collectionFilterToParams(params, 'region', 'code');
      this.collectionFilterToParams(params, 'CEAAInvolvement', '_id');
      this.collectionFilterToParams(params, 'eacDecision', '_id');
      this.collectionFilterToParams(params, 'pcp', 'code');
      this.collectionFilterToParams(params, 'proponent', '_id');
      this.collectionFilterToParams(params, 'projectType', 'name');
      this.collectionFilterToParams(params, 'projectPhase', '_id');

      this.dateFilterToParams(params, 'decisionDateStart');
      this.dateFilterToParams(params, 'decisionDateEnd');
    } else if (this.terms.dataset === 'Document') {
      this.collectionFilterToParams(params, 'milestone', '_id');
      this.collectionFilterToParams(params, 'documentAuthorType', '_id');
      this.collectionFilterToParams(params, 'docType', '_id');
      this.collectionFilterToParams(params, 'projectPhase', '_id');

      this.dateFilterToParams(params, 'datePostedStart');
      this.dateFilterToParams(params, 'datePostedEnd');
    }
  }

  toggleFilter(name) {
    if (this.showFilters[name]) {
      this.togglingOpen = '';
      this.updatetotalListItems(name);
      this.showFilters[name] = false;
    } else {
      Object.keys(this.showFilters).forEach(key => {
        if (this.showFilters[key]) {
          this.updatetotalListItems(key);
          this.showFilters[key] = false;
        }
      });
      this.showFilters[name] = true;
      this.togglingOpen = name;
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
    this.updatetotalListItemss();
    return Object.keys(this.numFilters).some(key => { return this.numFilters[key]; });
  }

  clearAllFilters() {
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
    this.updatetotalListItemss();
  }

  updatetotalListItems(name) {
    const gettotalListItems = (n) => { return Object.keys(this.filterForUI[n]).filter(k => this.filterForUI[n][k]).length; };

    let num = 0;
    if (name === 'date') {
      num += this.isNGBDate(this.filterForUI.datePostedStart) ? 1 : 0;
      num += this.isNGBDate(this.filterForUI.datePostedEnd) ? 1 : 0;
    } else if (name === 'more') {
      num = gettotalListItems('region') + this.filterForUI.proponent.length + gettotalListItems('CEAAInvolvement');
    } else {
      num = gettotalListItems(name);
      if (name === 'eacDecision') {
        num += this.isNGBDate(this.filterForUI.decisionDateStart) ? 1 : 0;
        num += this.isNGBDate(this.filterForUI.decisionDateEnd) ? 1 : 0;
      }
    }
    this.numFilters[name] = num;
  }

  updatetotalListItemss() {
    // Projects
    this.updatetotalListItems('projectType');
    this.updatetotalListItems('eacDecision');
    this.updatetotalListItems('pcp');
    this.updatetotalListItems('more');

    // Documents
    this.updatetotalListItems('milestone');
    this.updatetotalListItems('date');
    this.updatetotalListItems('documentAuthorType');
    this.updatetotalListItems('docType');
    this.updatetotalListItems('projectPhase');
  }

  setColumnSort(column) {
    if (this.tableParams.sortBy.charAt(0) === '+') {
      this.tableParams.sortBy = '-' + column;
    } else {
      this.tableParams.sortBy = '+' + column;
    }
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
    const params = this.terms.getParams();
    this.setParamsFromFilters(params);

    const datePostedStart = params.hasOwnProperty('datePostedStart') && params.datePostedStart ? params.datePostedStart : null;
    const datePostedEnd = params.hasOwnProperty('datePostedEnd') && params.datePostedEnd ? params.datePostedEnd : null;

    let queryModifiers = {};
    if (datePostedStart !== null && datePostedEnd !== null) {
      queryModifiers['datePostedStart'] = datePostedStart;
      queryModifiers['datePostedEnd'] = datePostedEnd;
    }

    this.updatePageTableSize(this.tableParams.pageSize);
    this.updatePageNumber(pageNumber);

    this.searchService.getSearchResults(
      this.terms.keywords,
      this.terms.dataset,
      null,
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
        if (res && res[0].data) {
          this.tableParams.totalListItems = res[0].data.meta[0].searchResultsTotal;
          this.tableTemplateUtils.updateUrl(
            this.tableParams.sortBy,
            this.tableParams.currentPage,
            this.tableParams.pageSize,
            this.filterForURL,
            this.tableParams.keywords
          );
          if (this.terms.dataset === 'Document') {
            this.setDocumentRowData();
          } else {
            this.setRowData();
          }
          this.loading = false;
          this._changeDetectionRef.detectChanges();
        } else {
          alert('Couldn\'t load search results');
          this.router.navigate(['/search']);
        }
      });

    if (this.filterForAPI.hasOwnProperty('currentPhaseName')) {
      this.filterForAPI['projectPhase'] = this.filterForAPI['currentPhaseName'];
      delete this.filterForAPI['currentPhaseName'];
    }
  }

  setDocumentRowData() {
    let documentList = [];
    if (this.data && this.data.length > 0) {
      this.data.forEach(document => {
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
              isFeatured: document.isFeatured
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

  setRowData() {
    let projectList = [];
    if (this.data && this.data.length > 0) {
      this.data.forEach(project => {
        projectList.push({
          _id: project._id,
          name: project.name,
          proponent: project.proponent,
          type: project.type,
          region: project.region,
          currentPhaseName: project.currentPhaseName,
          eacDecision: project.eacDecision
        });
      });
      this.projectTableData = new TableObject(
        ProjectListTableRowsComponent,
        projectList,
        this.tableParams
      );
    }
  }

  // reload page with current search terms
  public onSubmit() {
    // dismiss any open snackbar
    if (this.snackBarRef) { this.snackBarRef.dismiss(); }

    // NOTE: Angular Router doesn't reload page on same URL
    // REF: https://stackoverflow.com/questions/40983055/how-to-reload-the-current-route-with-the-angular-2-router
    // WORKAROUND: add timestamp to force URL to be different than last time
    let params = this.terms.getParams();
    params['ms'] = new Date().getMilliseconds();
    params['dataset'] = this.terms.dataset;
    params['currentPage'] = this.currentPage ? this.currentPage : 1;
    params['pageSize'] = this.pageSize ? this.pageSize : 10;

    this.setParamsFromFilters(params);

    this.router.navigate(['search', params]);
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
