import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Subject } from 'rxjs';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';

import { SearchResults } from 'app/models/search';

import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';

import { StorageService } from 'app/services/storage.service';
import { Constants } from 'app/shared/utils/constants';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { IPageSizePickerOption } from 'app/shared/components/page-size-picker/page-size-picker.component';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { DocumentService } from 'app/services/document.service';
import { takeWhile } from 'rxjs/operators';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { ConfigService } from 'app/services/config.service';

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  styleUrls: ['./documents-tab.component.scss']
})

export class DocumentsTabComponent implements OnInit, OnDestroy {
  private lists: any[] = [];

  public queryParams: Params;

  public loadingLists = true;
  public loadingTableParams = true;
  public loadingtableData = true;

  public readonly constants = Constants;

  public tableColumns: IColumnObject[] = [
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

  public currentProject;

  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  public filters: FilterObject[] = [];

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  public tableData: TableObject2 = new TableObject2({ component: DocumentTableRowsComponent });

  private alive = true;

  private milestoneArray = [];
  private documentAuthorTypeArray = [];
  private documentTypeArray = [];
  private projectPhaseArray = [];
  public showAdvancedFilters = false;

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private storageService: StorageService,
    private tableTemplateUtils: TableTemplate,
    private location: Location,
    private documentService: DocumentService,
    private configService: ConfigService
  ) { }

  ngOnInit() {
    this.currentProject = this.storageService.state.currentProject.data;

    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists = list;
      this.lists.map(item => {
        if (item.type === 'label') {
          this.milestoneArray.push({ ...item });
        } else if (item.type === 'author') {
          this.documentAuthorTypeArray.push({ ...item });
        } else if (item.type === 'doctype') {
          this.documentTypeArray.push({ ...item });
        } else if (item.type === 'projectPhase') {
          this.projectPhaseArray.push({ ...item });
        }
      });
      this.setFilters();
      this.loadingLists = false;
      this._changeDetectionRef.detectChanges();
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData);

      if (
        this.queryParams['milestone'] ||
        this.queryParams['documentAuthorType'] ||
        this.queryParams['documentType'] ||
        this.queryParams['datePostedEnd']
      ) {
        this.showAdvancedFilters = true;
      }

      this.loadingTableParams = false;
      this._changeDetectionRef.detectChanges();
    });

    this.documentService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        record['showFeatured'] = true;
        return { rowData: record };
      });

      if (this.tableData.totalListItems > 10) {
        this.tableData.options.showPageSizePicker = true;
      } else {
        this.tableData.options.showPageSizePicker = false;
      }

      this.tableData.columns = this.tableColumns;
      this.loadingtableData = false;

      this._changeDetectionRef.detectChanges();
    });
  }

  private setFilters() {
    // this.searchFiltersForm.setValue({ datePostedEnd: this.queryParams.datePostedEnd });
    const docDateFilter = new FilterObject(
      'issuedDate',
      FilterType.DateRange,
      '', // if you include a name, it will add a label to the date range filter.
      new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
      6
    );

    const milestoneFilter = new FilterObject(
      'milestone',
      FilterType.MultiSelect,
      'Milestone',
      new MultiSelectDefinition(
        this.milestoneArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      6
    );

    const documentAuthorTypeFilter = new FilterObject(
      'documentAuthorType',
      FilterType.MultiSelect,
      'Document Author',
      new MultiSelectDefinition(
        this.documentAuthorTypeArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      6
    );

    const documentTypeFilter = new FilterObject(
      'documentType',
      FilterType.MultiSelect,
      'Document Type',
      new MultiSelectDefinition(
        this.documentTypeArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      6
    );

    const projectPhaseFilter = new FilterObject(
      'projectPhase',
      FilterType.MultiSelect,
      'Project Phase',
      new MultiSelectDefinition(
        this.projectPhaseArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      6
    );

    this.filters = [
      docDateFilter,
      milestoneFilter,
      documentAuthorTypeFilter,
      documentTypeFilter,
      projectPhaseFilter
    ];
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage) {
    this.clearQueryParamsFilters();

    // check keyword
    if (searchPackage.keywords) {
      this.queryParams['keywords'] = searchPackage.keywords;
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        this.tableData.sortBy = '-score';
      }
    }

    // check subset
    if (searchPackage.subset) {
      this.queryParams['subset'] = [searchPackage.subset];
    }

    Object.keys(searchPackage.filters).forEach(filter => {
      this.queryParams[filter] = searchPackage.filters[filter];
    });

    this.tableData.currentPage = 1;
    this.submit();
  }

  private clearQueryParamsFilters() {
    delete this.queryParams['keywords'];
    delete this.queryParams['datePostedStart'];
    delete this.queryParams['datePostedEnd'];
    delete this.queryParams['milestone'];
    delete this.queryParams['documentAuthorType'];
    delete this.queryParams['documentType'];
    delete this.queryParams['projectPhase'];
  }

  onMessageOut(msg: ITableMessage) {
    switch (msg.label) {
      case 'columnSort':
        this.setColumnSort(msg.data);
        break;
      case 'pageNum':
        this.onPageNumUpdate(msg.data);
        break;
      case 'pageSize':
        this.onPageSizeUpdate(msg.data);
        break;
      default:
        break;
    }
  }

  setColumnSort(column) {
    if (this.tableData.sortBy.charAt(0) === '+') {
      this.tableData.sortBy = '-' + column;
    } else {
      this.tableData.sortBy = '+' + column;
    }
    this.submit();
  }

  onPageNumUpdate(pageNumber) {
    this.tableData.currentPage = pageNumber;
    this.submit();
  }

  onPageSizeUpdate(pageSize: IPageSizePickerOption) {
    this.tableData.pageSize = pageSize.value;
    this.tableData.currentPage = 1;
    this.submit();
  }

  async submit() {
    delete this.queryParams.sortBy;
    delete this.queryParams.currentPage;
    delete this.queryParams.pageNumber;
    delete this.queryParams.pageSize;

    // This allows us to have multiple tables tied to a single page.
    const params = { ...this.queryParams, ...this.tableTemplateUtils.getNavParamsObj(this.tableData) }

    const filtersForApi = { ... this.queryParams };
    delete filtersForApi['keywords'];

    if (!params['keywords']) {
      params['keywords'] = null;
    }
    if (filtersForApi.milestone) {
      filtersForApi.milestone = filtersForApi.milestone.join();
    } else {
      params['milestone'] = null;
    }
    if (filtersForApi.documentAuthorType) {
      filtersForApi.documentAuthorType = filtersForApi.documentAuthorType.join();
    } else {
      params['documentAuthorType'] = null;
    }
    if (filtersForApi.documentType) {
      filtersForApi.documentType = filtersForApi.documentType.join();
    } else {
      params['documentType'] = null;
    }
    if (filtersForApi.projectPhase) {
      filtersForApi.projectPhase = filtersForApi.projectPhase.join();
    } else {
      params['projectPhase'] = null;
    }
    if (!this.queryParams['datePostedStart']) {
      params['datePostedStart'] = null
    }
    if (!this.queryParams['datePostedEnd']) {
      params['datePostedEnd'] = null
    }

    this.location.replaceState(
      this.router.serializeUrl(
        this.router.createUrlTree(
          ['../documents'],
          {
            queryParams: params,
            relativeTo: this.route,
            queryParamsHandling: 'merge',
          })
      )
    );

    await this.documentService.fetchData(
      this.queryParams.keywords,
      this.tableData.currentPage,
      this.tableData.pageSize,
      this.tableData.sortBy,
      this.currentProject._id,
      filtersForApi
    );
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();

    this.alive = false;
  }
}
