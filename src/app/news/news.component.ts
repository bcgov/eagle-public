import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ActivitiesListTableRowsComponent } from 'app/project/project-activites/activities-list-table-rows/activities-list-table-rows.component';
import { ActivitiesService } from 'app/services/activities.service';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss']
})

export class NewsListComponent implements OnInit, OnDestroy {
  public loading = true;
  private alive = true;
  public queryParams: Params;

  public tableData: TableObject2 = new TableObject2({ component: ActivitiesListTableRowsComponent });
  public tableColumns: IColumnObject[] = [
    {
      name: 'Headline',
      value: 'headine',
      width: 'col-10',
      nosort: true
    },
    {
      name: 'Date',
      value: 'dateAdded',
      width: 'col-2',
      nosort: true
    }
  ];
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tableTemplateUtils: TableTemplate,
    private activitiesService: ActivitiesService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData);

      if (this.tableData.sortBy === '-datePosted') {
        this.tableData.sortBy = '-dateAdded';
      }
      this._changeDetectionRef.detectChanges();
    });

    this.activitiesService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      this.tableData.totalListItems = searchResults.totalSearchCount;
      this.tableData.items = searchResults.data.map(record => {
        return { rowData: record };
      });
      this.tableData.columns = this.tableColumns;
      this.tableData.options.showAllPicker = true;

      this.loading = false;

      this._changeDetectionRef.detectChanges();
    });
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
        this.activitiesService.fetchDataConfig.sortBy = params['sortBy'];
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        this.activitiesService.fetchDataConfig.currentPage = params['currentPage'];
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        if (params['pageSize'] === this.tableData.totalListItems) {
          this.loading = true;
        }
        params['currentPage'] = 1;
        this.activitiesService.fetchDataConfig.pageSize = params['pageSize'];
        this.activitiesService.fetchDataConfig.currentPage = params['currentPage'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  submit(params) {
    this.router.navigate(
      [],
      {
        queryParams: params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.activitiesService.refreshData();
  }

  executeSearch(searchPackage) {
    let params = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      this.activitiesService.fetchDataConfig.keywords = params['keywords'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
        this.activitiesService.fetchDataConfig.sortBy = params['sortBy'];
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-dateAdded';
      this.activitiesService.fetchDataConfig.keywords = '';
      this.activitiesService.fetchDataConfig.sortBy = params['sortBy'];
    }
    params['currentPage'] = 1;
    this.activitiesService.fetchDataConfig.currentPage = params['currentPage'];
    this.submit(params);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
