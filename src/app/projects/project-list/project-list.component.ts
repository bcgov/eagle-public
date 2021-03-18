import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Location } from '@angular/common';
import 'rxjs/add/operator/takeUntil';

import * as _ from 'lodash';

import { SearchResults } from 'app/models/search';

import { Constants } from 'app/shared/utils/constants';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';

import { SearchParamObject } from 'app/services/search.service';
import { ConfigService } from 'app/services/config.service';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { takeWhile } from 'rxjs/operators';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { IPageSizePickerOption } from 'app/shared/components/page-size-picker/page-size-picker.component';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { ProjectService } from 'app/services/project.service';
import { OrgService } from 'app/services/org.service';
import { Observable } from 'rxjs';

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
  public loadingtableData = true;

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
    private location: Location,
    private _changeDetectionRef: ChangeDetectorRef
  ) { }

  ngOnInit() {

    const orgBehaviourSub = this.orgService.getBehaviourSubject();
    Observable.forkJoin([orgBehaviourSub, this.configService.lists]).pipe(takeWhile(() => this.alive))
      .subscribe((res) => {
        // Org
        this.proponents = res[0];

        // List
        this.lists = res[1];
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
    orgBehaviourSub.complete();

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

      this.loadingtableData = false;

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
    this.clearQueryParamsFilters(this.queryParams);

    // check keyword
    if (searchPackage.keywords) {
      this.queryParams['keywords'] = searchPackage.keywords;
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        this.tableData.sortBy = '-score';
      }
    } else {
      if (this.tableData.sortBy === '-score') {
        this.tableData.sortBy = '+name';
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

  private clearQueryParamsFilters(params) {
    delete params['keywords'];
    delete params['type'];
    delete params['eacDecision'];
    delete params['decisionDateStart'];
    delete params['decisionDateEnd'];
    delete params['pcp'];
    delete params['proponent'];
    delete params['region'];
    delete params['CEAAInvolvement'];
    delete params['currentPhaseName'];
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
    this.tableData.currentPage = 1;
    this.submit();
  }

  onPageNumUpdate(pageNumber) {
    this.tableData.currentPage = pageNumber;
    this.submit();
  }

  onPageSizeUpdate(pageSize: IPageSizePickerOption) {
    this.tableData.pageSize = pageSize.value;
    if (this.tableData.pageSize === this.tableData.totalListItems) {
      this.loadingtableData = true;
    }
    this.tableData.currentPage = 1;
    this.submit();
  }

  async submit() {
    delete this.queryParams.sortBy;
    delete this.queryParams.currentPage;
    delete this.queryParams.pageNumber;
    delete this.queryParams.pageSize;

    const params = { ...this.queryParams, ...this.tableTemplateUtils.getNavParamsObj(this.tableData) };

    const filtersForApi = { ... this.queryParams };
    delete filtersForApi['keywords'];

    if (!params['keywords']) {
      params['keywords'] = null;
    }

    this.clearQueryParamsFilters(params);

    const filtersForAPI = this.tableTemplateUtils.getFiltersFromParams(
      this.queryParams,
      this.filtersList
    );

    const dateFiltersForAPI = this.tableTemplateUtils.getDateFiltersFromParams(
      this.queryParams,
      this.dateFiltersList
    );

    let paramsForMerge = { ...params, ...filtersForAPI, ...dateFiltersForAPI };
    this.tableTemplateUtils.removeFiltersForQueryMerge(paramsForMerge, this.filtersList.concat(this.dateFiltersList));

    this.location.replaceState(
      this.router.serializeUrl(
        this.router.createUrlTree(
          ['projects-list'],
          {
            queryParams: paramsForMerge,
            queryParamsHandling: 'merge'
          })
      )
    );
    await this.projectService.fetchData(new SearchParamObject(
      this.queryParams.keywords,
      'Project',
      [],
      this.tableData.currentPage,
      this.tableData.pageSize,
      this.tableData.sortBy,
      {},
      true,
      null,
      { ...filtersForAPI, ...dateFiltersForAPI },
      '',
      true
    ));
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
