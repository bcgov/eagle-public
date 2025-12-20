import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, effect } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { takeWhile, first } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { Constants } from '../shared/utils/constants';
import { SearchResults } from '../models/search';
import { SearchParamObject } from '../services/search.service';
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

  showAdvancedFilters = signal(false);

  queryParams: Params = {};
  tableData = signal<TableObject>(new TableObject({ component: ProjectNotificationsTableRowsComponent }));
  filters: FilterObject[] = [];

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private commentPeriodService = inject(CommentPeriodService);
  private readonly tableSignal = this.tableService.getTableSignal(this.tableId);

  constructor() {
    // Watch for table data changes from service
    effect(() => {
      const searchResults = this.tableSignal();
      
      if (searchResults && searchResults.data && searchResults.data !== 0) {
        const updatedTableData = this.tableData();
        updatedTableData.totalListItems = searchResults.totalSearchCount;
        updatedTableData.items = searchResults.data.map((record: any) => {
          this.getProjectCommentPeriod(record);
          return { rowData: record };
        });
        updatedTableData.columns = this.tableColumns;
        updatedTableData.options.showAllPicker = true;

        this.tableData.set(updatedTableData);
      }
    });
  }

  ngOnInit() {
    const currentTableData = this.tableData();
    currentTableData.tableId = this.tableId;
    currentTableData.options.disableRowHighlight = true;
    currentTableData.options.showHeader = false;
    currentTableData.options.rowSpacing = 25;
    this.tableData.set(currentTableData);

    this.setFilters();

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.queryParams = { ...params };
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData());

      if (!params.sortBy) {
        updatedTableData.sortBy = '-_id';
      }

      this.tableData.set(updatedTableData);

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

      // Build filters object from query params
      const filters: Record<string, string> = {};
      this.filtersList.forEach(filterKey => {
        if (this.queryParams[filterKey]) {
          filters[filterKey] = this.queryParams[filterKey];
        }
      });
      
      // Fetch data with current params
      const currentTableData = this.tableData();
      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        this.queryParams['keywords'] || '',
        'ProjectNotification',
        [],
        currentTableData.currentPage,
        currentTableData.pageSize,
        currentTableData.sortBy,
        {},
        true,
        '',
        filters
      ));
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

  onResetControls() {
    // Reset sort to default if it was a score-based sort
    const currentTableData = this.tableData();
    if (currentTableData.sortBy.includes('score')) {
      currentTableData.sortBy = '-datePosted';
      this.tableData.set(currentTableData);
    }
  }

  executeSearch(searchPackage: any) {
    let params: any = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-_id';
    }

    params['currentPage'] = 1;

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(searchPackage, this.filtersList);

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
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
  }

  getProjectCommentPeriod(project: ProjectNotification) {
    this.commentPeriodService.getAllByProjectId(project._id)
      .pipe(first())
      .subscribe((res: any) => {
        if (res && res.data) {
          res.data.forEach((cp: any) => {
            if (!project['commentPeriod'] || (project['commentPeriod'] && cp.daysRemainingCount > project['commentPeriod'].daysRemainingCount)) {
              project['commentPeriod'] = cp;
            }
          });
        }
      });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
