import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { takeWhile, first } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { Constants } from '../shared/utils/constants';
import { SearchResults } from '../models/search';
import { IColumnObject, TableObject } from '../shared/components/table-template/table-object';
import { ProjectNotificationsTableRowsComponent } from './project-notifications-table-rows/project-notifications-table-rows.component';
import { TableTemplate } from '../shared/components/table-template/table-template';
import { FilterObject, FilterType, MultiSelectDefinition } from '../shared/components/search-filter-template/filter-object';
import { ITableMessage } from '../shared/components/table-template/table-row-component';
import { TableService } from '../services/table.service';
import { ProjectNotification } from '../models/projectNotification';
import { CommentPeriodService } from '../services/commentperiod.service';
import { TableTemplateComponent } from '../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-project-notifications',
  templateUrl: './project-notifications.component.html',
  styleUrls: ['./project-notifications.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableTemplateComponent, SearchFilterTemplateComponent],
  standalone: true
})
export class ProjectNotificationsListComponent implements OnInit, OnDestroy {
  private alive = true;
  private readonly filtersList = ['type', 'region', 'pcp', 'decision'];
  private readonly tableId = 'notificationProject';
  private initialLoad = true;

  tableColumns: IColumnObject[] = [
    {
      name: 'Project Notifications',
      value: '',
      width: 'col-12',
      nosort: true
    }
  ];

  loadingLists = signal(true);
  loadingTableParams = signal(true);
  loadingTableData = signal(true);
  showAdvancedFilters = signal(false);

  queryParams: Params = {};
  tableData: TableObject = new TableObject({ component: ProjectNotificationsTableRowsComponent });
  filters: FilterObject[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplate,
    private tableService: TableService,
    private commentPeriodService: CommentPeriodService,
    private _changeDetectionRef: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.tableData.tableId = this.tableId;
    this.tableData.options.disableRowHighlight = true;
    this.tableData.options.showHeader = false;
    this.tableData.options.rowSpacing = 25;

    this.setFilters();
    this.loadingLists.set(false);
    this._changeDetectionRef.detectChanges();

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.queryParams = { ...params };
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData);

      if (!params.sortBy) {
        this.tableData.sortBy = '-_id';
      }

      if (
        this.initialLoad && (
          this.queryParams['type'] ||
          this.queryParams['region'] ||
          this.queryParams['pcp'] ||
          this.queryParams['decision'])
      ) {
        this.showAdvancedFilters.set(true);
        this.initialLoad = false;
      }
      this.loadingTableParams.set(false);
      this._changeDetectionRef.detectChanges();
    });

    this.tableService.getValue(this.tableId).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map((record: any) => {
          this.getProjectCommentPeriod(record);
          return { rowData: record };
        });
        this.tableData.columns = this.tableColumns;
        this.tableData.options.showAllPicker = true;

        this.loadingTableData.set(false);
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  private setFilters() {
    const typeFilter = new FilterObject(
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

    const decisionFilter = new FilterObject(
      'decision',
      FilterType.MultiSelect,
      'Notification Decision',
      new MultiSelectDefinition(
        Constants.PROJECT_NOTIFICATION_DECISIONS,
        [],
        null,
        null,
        true
      ),
      4
    );

    this.filters = [
      typeFilter,
      regionFilter,
      pcpFilter,
      decisionFilter
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
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-_id';
      this.tableService.data[this.tableId].cachedConfig.keywords = '';
      this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortBy'];
    }

    params['currentPage'] = 1;
    this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList);
    this.tableService.data[this.tableId].cachedConfig.filters = queryFilters;

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loadingTableData.set(true);
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
    this.loadingTableData.set(true);
    this.tableService.refreshData(this.tableId);
  }

  getProjectCommentPeriod(project: ProjectNotification) {
    this.commentPeriodService.getAllByProjectId(project._id)
      .pipe(first())
      .subscribe((res: any) => {
        if (res && res.data) {
          res.data.forEach((cp: any) => {
            if (!project['commentPeriod'] || (project['commentPeriod'] && cp.daysRemainingCount > project['commentPeriod'].daysRemainingCount)) {
              project['commentPeriod'] = cp;
              this._changeDetectionRef.detectChanges();
            }
          });
        }
      });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
