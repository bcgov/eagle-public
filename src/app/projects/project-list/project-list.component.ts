import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, Params, NavigationEnd } from '@angular/router';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';

import { SearchResults } from 'app/models/search';

import { Constants } from 'app/shared/utils/constants';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';

import { ConfigService } from 'app/services/config.service';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { takeWhile } from 'rxjs/operators';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { ProjectService } from 'app/services/project.service';
import { OrgService } from 'app/services/org.service';
import { Org } from 'app/models/organization';
import { StorageService } from 'app/services/storage.service';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss']
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private lists: any[] = [];
  private alive = true;
  private eaDecisionArray = [];
  private iaacArray = [];
  private phaseArray = [];
  private filtersList = ['type', 'eacDecision', 'decisionDateStart', 'decisionDateEnd', 'pcp', 'proponent', 'region', 'CEAAInvolvement', 'currentPhaseName'];
  private dateFiltersList = ['decisionDateStart', 'decisionDateEnd'];

  public tableColumns: IColumnObject[] = [
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

  public loadingLists = true;
  public loadingTableParams = true;
  public loadingTableData = true;

  public queryParams: Params;
  public tableData: TableObject2 = new TableObject2({ component: ProjectListTableRowsComponent });
  public showAdvancedFilters = false;
  public filters: FilterObject[] = [];
  private proponents = [];

  private legislationFilterGroup = { name: 'legislation', labelPrefix: null, labelPostfix: ' Act Terms' };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplate,
    private projectService: ProjectService,
    private orgService: OrgService,
    private configService: ConfigService,
    private storageService: StorageService,
    private _changeDetectionRef: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.router.events.pipe(takeWhile(() => this.alive)).subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
      const x = this.storageService.state.scrollPosition.data[0] ? this.storageService.state.scrollPosition.data[0] : 0;
      const y = this.storageService.state.scrollPosition.data[1] ? this.storageService.state.scrollPosition.data[1] : 0;
      if (x !== 0 || y !== 0) {
        window.scrollTo(x, y);
      }
    });

    this.orgService.getValue().pipe(takeWhile(() => this.alive)).subscribe((res: Org[]) => {
      this.configService.lists.pipe(takeWhile(() => this.alive)).subscribe((list) => {
        this.proponents = res;

        this.lists = list;
        this.lists.forEach(item => {
          switch (item.type) {
            case 'eaDecisions':
              this.eaDecisionArray.push({ ...item });
              break;
            case 'ceaaInvolvements':
              this.iaacArray.push({ ...item });
              break;
            case 'projectPhase':
              this.phaseArray.push({ ...item });
              break;
          }
        });
        this.setFilters();
        this.loadingLists = false;
        this._changeDetectionRef.detectChanges();
      });
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData);

      if (!data['params'].sortBy) {
        this.tableData.sortBy = '+name';
      }

      if (
        this.queryParams['type'] ||
        this.queryParams['eacDecision'] ||
        this.queryParams['decisionDateStart'] ||
        this.queryParams['decisionDateEnd'] ||
        this.queryParams['pcp'] ||
        this.queryParams['proponent'] ||
        this.queryParams['region'] ||
        this.queryParams['CEAAInvolvement'] ||
        this.queryParams['currentPhaseName']
      ) {
        this.showAdvancedFilters = true;
      }
      this.loadingTableParams = false;
      this._changeDetectionRef.detectChanges();
    });

    this.projectService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        return { rowData: record };
      });
      this.tableData.columns = this.tableColumns;
      this.tableData.options.showAllPicker = true;

      this.loadingTableData = false;
      this._changeDetectionRef.detectChanges();
    });
  }

  private setFilters() {
    const projectTypeFilter = new FilterObject(
      'type',
      FilterType.MultiSelect,
      'Project Type',
      new MultiSelectDefinition(
        Constants.PROJECT_TYPE_COLLECTION,
        [],
        null,
        null,
        true
      ),
      4
    );

    const eacDecisionFilter = new FilterObject(
      'eacDecision',
      FilterType.MultiSelect,
      'EA Decision',
      new MultiSelectDefinition(
        this.eaDecisionArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
    );

    const decisionDateFilter = new FilterObject(
      'issuedDate',
      FilterType.DateRange,
      '', // if you include a name, it will add a label to the date range filter.
      new DateFilterDefinition('decisionDateStart', 'Decision Start', 'decisionDateEnd', 'Decision End'),
      8
    );

    const pcpFilter = new FilterObject(
      'pcp',
      FilterType.MultiSelect,
      'Public Comment Period',
      new MultiSelectDefinition(
        Constants.PCP_COLLECTION,
        [],
        null,
        null,
        true
      ),
      4
    );

    const proponentFilter = new FilterObject(
      'proponent',
      FilterType.MultiSelect,
      'Proponent',
      new MultiSelectDefinition(
        this.proponents,
        [],
        null,
        null,
        true
      ),
      4
    );

    const regionFilter = new FilterObject(
      'region',
      FilterType.MultiSelect,
      'Region',
      new MultiSelectDefinition(
        Constants.REGIONS_COLLECTION,
        [],
        null,
        null,
        true
      ),
      4
    );

    const iaacFilter = new FilterObject(
      'CEAAInvolvement',
      FilterType.MultiSelect,
      'IAAC Involvement',
      new MultiSelectDefinition(
        this.iaacArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
    );

    const currentPhaseNameFilter = new FilterObject(
      'currentPhaseName',
      FilterType.MultiSelect,
      'Project Phase',
      new MultiSelectDefinition(
        this.phaseArray,
        [],
        this.legislationFilterGroup,
        null,
        true
      ),
      4
    );

    this.filters = [
      eacDecisionFilter,
      decisionDateFilter,
      projectTypeFilter,
      pcpFilter,
      proponentFilter,
      regionFilter,
      iaacFilter,
      currentPhaseNameFilter
    ];
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage) {
    let params = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.projectService.fetchDataConfig.keywords = params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.projectService.fetchDataConfig.sortBy = params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '+name';
      this.projectService.fetchDataConfig.keywords = '';
      this.projectService.fetchDataConfig.sortBy = params['sortBy'];
    }

    params['currentPage'] = 1;
    this.projectService.fetchDataConfig.currentPage = params['currentPage'];

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList, this.dateFiltersList);
    this.projectService.fetchDataConfig.filters = queryFilters;

    this.storageService.state.scrollPosition = { type: 'scrollPosition', data: [0, 0] };

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
        this.projectService.fetchDataConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.projectService.fetchDataConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loadingTableData = true;
        }
        params['currentPage'] = 1;
        this.projectService.fetchDataConfig.pageSize = params['pageSize'];
        this.projectService.fetchDataConfig.currentPage = params['currentPage'];

        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params, filters = null) {
    this.storageService.state.scrollPosition = { type: 'scrollPosition', data: [window.scrollX, window.scrollY] };
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.projectService.refreshData();
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
