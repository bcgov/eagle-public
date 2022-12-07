import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Constants } from 'app/shared/utils/constants';
import { SearchResults } from 'app/models/search';
import {
  IColumnObject,
  TableObject2,
} from 'app/shared/components/table-template-2/table-object-2';
import { ProjectNotificationsTableRowsComponent } from './project-notifications-table-rows/project-notifications-table-rows.component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { first, takeWhile } from 'rxjs/operators';
import {
  FilterObject,
  FilterType,
  MultiSelectDefinition,
} from 'app/shared/components/search-filter-template/filter-object';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { TableService } from 'app/services/table.service';
import { ProjectNotification } from 'app/models/projectNotification';
import { CommentPeriodService } from 'app/services/commentperiod.service';

@Component({
  selector: 'app-project-notifications',
  templateUrl: './project-notifications.component.html',
  styleUrls: ['./project-notifications.component.scss'],
})
export class ProjectNotificationsListComponent implements OnInit, OnDestroy {
  private alive = true;
  private filtersList = ['type', 'region', 'pcp', 'decision'];
  private tableId = 'notificationProject';

  public tableColumns: IColumnObject[] = [
    {
      name: 'Project Notifications',
      value: '',
      width: 'col-12',
      nosort: true,
    },
  ];

  public loadingLists = true;
  public loadingTableParams = true;
  public loadingTableData = true;

  public queryParams: Params;
  public tableData: TableObject2 = new TableObject2({
    component: ProjectNotificationsTableRowsComponent,
  });
  public showAdvancedFilters = false;
  public filters: FilterObject[] = [];
  private initialLoad = true;

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
    this.loadingLists = false;
    this._changeDetectionRef.detectChanges();

    this.route.queryParamMap
      .pipe(takeWhile(() => this.alive))
      .subscribe((data) => {
        this.queryParams = { ...data['params'] };
        // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
        this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(
          data['params'],
          this.tableData
        );

        if (!data['params'].sortBy) {
          this.tableData.sortBy = '-_id';
        }

        if (
          this.initialLoad &&
          (this.queryParams['type'] ||
            this.queryParams['region'] ||
            this.queryParams['pcp'] ||
            this.queryParams['decision'])
        ) {
          this.showAdvancedFilters = true;
          this.initialLoad = false;
        }
        this.loadingTableParams = false;
        this._changeDetectionRef.detectChanges();
      });

    this.tableService
      .getValue(this.tableId)
      .pipe(takeWhile(() => this.alive))
      .subscribe((searchResults: SearchResults) => {
        if (searchResults.data !== 0) {
          this.tableData.totalListItems = searchResults.totalSearchCount;
          this.tableData.items = searchResults.data.map((record) => {
            this.getProjectCommentPeriod(record);
            return { rowData: record };
          });
          this.tableData.columns = this.tableColumns;
          this.tableData.options.showAllPicker = true;

          this.loadingTableData = false;
          this._changeDetectionRef.detectChanges();
          let seachInput = document.getElementById('search-input');
          if (seachInput !== null) {
            seachInput.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest',
            });
            seachInput = null;
          }
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
      new MultiSelectDefinition(Constants.PCP_COLLECTION, [], null, null, true),
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

    this.filters = [typeFilter, regionFilter, pcpFilter, decisionFilter];
  }

  navSearchHelp() {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage) {
    let params = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.tableService.data[this.tableId].cachedConfig.keywords =
        params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.tableService.data[this.tableId].cachedConfig.sortBy =
          params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-_id';
      this.tableService.data[this.tableId].cachedConfig.keywords = '';
      this.tableService.data[this.tableId].cachedConfig.sortBy =
        params['sortBy'];
    }

    params['currentPage'] = 1;
    this.tableService.data[this.tableId].cachedConfig.currentPage =
      params['currentPage'];

    let queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage,
      this.filtersList
    );
    this.tableService.data[this.tableId].cachedConfig.filters = queryFilters;

    this.submit(params, queryFilters);
  }

  onMessageOut(msg: ITableMessage) {
    let params = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage =
          params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loadingTableData = true;
        }
        params['currentPage'] = 1;
        this.tableService.data[this.tableId].cachedConfig.pageSize =
          params['pageSize'];
        this.tableService.data[this.tableId].cachedConfig.currentPage =
          params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params, filters = null) {
    this.router.navigate([], {
      queryParams: filters ? { ...params, ...filters } : params,
      relativeTo: this.route,
      queryParamsHandling: 'merge',
    });
    this.loadingTableData = true;
    this.tableService.refreshData(this.tableId);
  }

  getProjectCommentPeriod(project: ProjectNotification) {
    this.commentPeriodService
      .getAllByProjectId(project._id)
      .pipe(first())
      .subscribe((res: any) => {
        if (res && res.data) {
          res.data.forEach((cp) => {
            if (
              !project['commentPeriod'] ||
              (project['commentPeriod'] &&
                cp.daysRemainingCount >
                  project['commentPeriod'].daysRemainingCount)
            ) {
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
