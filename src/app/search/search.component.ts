import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ConfigService } from 'app/services/config.service';
import { DocumentService } from 'app/services/document.service';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { Constants } from 'app/shared/utils/constants';
import { takeWhile } from 'rxjs/operators';
import { DocSearchTableRowsComponent } from './search-documents-table-rows/search-document-table-rows.component';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})


export class SearchComponent implements OnInit, OnDestroy {
  private lists: any[] = [];

  public queryParams: Params;

  public loadingLists = true;
  public loadingTableParams = true;
  public loadingTableData = true;

  public tableColumns: IColumnObject[] = [
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


  public filters: FilterObject[] = [];

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  public tableData: TableObject2 = new TableObject2({ component: DocSearchTableRowsComponent });

  private alive = true;

  private milestoneArray = [];
  private documentAuthorTypeArray = [];
  private documentTypeArray = [];
  private projectPhaseArray = [];
  public showAdvancedFilters = false;
  private filtersList = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
  private dateFiltersList = ['datePostedStart', 'datePostedEnd'];
  private initialLoad = true;

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private tableTemplateUtils: TableTemplate,
    private documentService: DocumentService,
    private configService: ConfigService
  ) { }

  ngOnInit() {
    this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
      this.lists = list;
      this.lists.forEach(item => {
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
        this.initialLoad && (
          this.queryParams['milestone'] ||
          this.queryParams['documentAuthorType'] ||
          this.queryParams['type'] ||
          this.queryParams['datePostedStart'] ||
          this.queryParams['datePostedEnd'] ||
          this.queryParams['projectPhase'])
      ) {
        this.showAdvancedFilters = true;
        this.initialLoad = false;
      }

      this.loadingTableParams = false;
      this._changeDetectionRef.detectChanges();
    });

    this.documentService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map(record => {
          return { rowData: record };
        });
        this.tableData.columns = this.tableColumns;
        this.tableData.options.showAllPicker = true;

        this.loadingTableData = false;

        this._changeDetectionRef.detectChanges();
      }
    });
  }

  private setFilters() {
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
      4
    );

    const documentTypeFilter = new FilterObject(
      'type',
      FilterType.MultiSelect,
      'Document Type',
      new MultiSelectDefinition(
        this.documentTypeArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
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
      4
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
    let params = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.documentService.fetchDataConfig.keywords = params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.documentService.fetchDataConfig.sortBy = params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = Constants.tableDefaults.DEFAULT_SORT_BY;
      this.documentService.fetchDataConfig.keywords = '';
      this.documentService.fetchDataConfig.sortBy = params['sortBy'];
    }

    params['currentPage'] = 1;
    this.documentService.fetchDataConfig.currentPage = params['currentPage'];

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList, this.dateFiltersList);
    this.documentService.fetchDataConfig.filters = queryFilters;

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params = {};
    switch (msg.label) {
      case 'columnSort':
        if (this.tableData.sortBy.charAt(0) === '+') {
          params['sortBy'] = '-' + msg.data;
        } else {
          params['sortBy'] = '+' + msg.data;
        }
        this.documentService.fetchDataConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.documentService.fetchDataConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loadingTableData = true;
        }
        params['currentPage'] = 1;
        this.documentService.fetchDataConfig.pageSize = params['pageSize'];
        this.documentService.fetchDataConfig.currentPage = params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params, filters = null) {
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.loadingTableData = true;
    this.documentService.refreshData();
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
