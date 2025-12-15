import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { Router, ActivatedRoute, Params, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeWhile } from 'rxjs/operators';

import { SearchResults } from 'app/models/search';
import { Constants } from 'app/shared/utils/constants';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';
import { ConfigService } from 'app/services/config.service';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { OrgService } from 'app/services/org.service';
import { Org } from 'app/models/organization';
import { TableService } from 'app/services/table.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
  imports: [CommonModule, RouterLink, TableTemplateComponent, SearchFilterTemplateComponent],
  standalone: true
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private orgService = inject(OrgService);
  private configService = inject(ConfigService);
  private _changeDetectionRef = inject(ChangeDetectorRef);

  private lists: any[] = [];
  private alive = true;
  private eaDecisionArray: any[] = [];
  private iaacArray: any[] = [];
  private phaseArray: any[] = [];
  private filtersList = ['type', 'eacDecision', 'decisionDateStart', 'decisionDateEnd', 'pcp', 'proponent', 'region', 'CEAAInvolvement', 'currentPhaseName'];
  private dateFiltersList = ['decisionDateStart', 'decisionDateEnd'];
  private tableId = 'projectList';

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

  public queryParams: Params = {};
  public tableData: TableObject = new TableObject({ component: ProjectListTableRowsComponent });
  public showAdvancedFilters = false;
  public filters: FilterObject[] = [];
  private proponents: Org[] = [];
  private initialLoad = true;

  private legislationFilterGroup = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };

  ngOnInit() {
    this.orgService.getValue().pipe(takeWhile(() => this.alive)).subscribe((res: Org[]) => {
      if (res) {
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
      }
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.queryParams = { ...params };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData);

      if (!params.sortBy) {
        this.tableData.sortBy = '+name';
      }

      if (
        this.initialLoad && (
          this.queryParams['type'] ||
          this.queryParams['eacDecision'] ||
          this.queryParams['decisionDateStart'] ||
          this.queryParams['decisionDateEnd'] ||
          this.queryParams['pcp'] ||
          this.queryParams['proponent'] ||
          this.queryParams['region'] ||
          this.queryParams['CEAAInvolvement'] ||
          this.queryParams['currentPhaseName'])
      ) {
        this.showAdvancedFilters = true;
        this.initialLoad = false;
      }
      this.loadingTableParams = false;
      this._changeDetectionRef.detectChanges();
    });

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map((record: any) => {
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
    const projectTypeFilter = new FilterObject(
      'type',
      FilterType.MultiSelect,
      'Project Type',
      new MultiSelectDefinition(
        Constants.TEMPORARY_PROJECT_TYPE,
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
      '',
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

  executeSearch(searchPackage: any) {
    let params: any = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.tableService.data[this.tableId].cachedConfig.keywords = params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '+name';
      this.tableService.data[this.tableId].cachedConfig.keywords = '';
      this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
    }

    params['currentPage'] = 1;
    this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList, this.dateFiltersList);
    this.tableService.data[this.tableId].cachedConfig.filters = queryFilters;

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    switch (msg.label) {
      case 'columnSort':
        if (this.tableData.sortBy.charAt(0) === '+') {
          params['sortBy'] = '-' + msg.data;
        } else {
          params['sortBy'] = '+' + msg.data;
        }
        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loadingTableData = true;
        }
        params['currentPage'] = 1;
        this.tableService.data[this.tableId].cachedConfig.pageSize = params['pageSize'];
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params: any, filters: any = null) {
    this.router.navigate(
      [],
      {
        queryParams: filters ? { ...params, ...filters } : params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.loadingTableData = true;
    this.tableService.refreshData(this.tableId);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
