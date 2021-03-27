import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { SearchResults } from 'app/models/search';
import { ActivitiesListTableRowsComponent } from './activities-list-table-rows/activities-list-table-rows.component';
import { IColumnObject, TableObject2 } from 'app/shared/components/table-template-2/table-object-2';
import { TableTemplate } from 'app/shared/components/table-template-2/table-template';
import { ITableMessage } from 'app/shared/components/table-template-2/table-row-component';
import { takeWhile } from 'rxjs/operators';
import { ActivitiesService } from 'app/services/activities.service';
import { StorageService } from 'app/services/storage.service';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.scss']
})
export class ProjectActivitesComponent implements OnInit, OnDestroy {
  @ViewChild('activitiesHeader', { static: true }) activitiesHeader: ElementRef;
  private alive = true;

  public loading = true;
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
    private storageService: StorageService,
    private _changeDetectionRef: ChangeDetectorRef) { }

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;

    this.tableData.tableId = 'activities-table';

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      this.queryParams = { ...data['params'] };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(data['params'], this.tableData, 'Activities');

      if (!data['params'].sortBy) {
        this.tableData.sortBy = '-dateAdded';
      }

      this._changeDetectionRef.detectChanges();
    });

    this.activitiesService.getValue().pipe(takeWhile(() => this.alive)).subscribe((searchResults: SearchResults) => {
      if (searchResults.data !== 0) {
        this.tableData.totalListItems = searchResults.totalSearchCount;
        this.tableData.items = searchResults.data.map(record => {
          return { rowData: record };
        });
        this.tableData.columns = this.tableColumns;
        this.tableData.options.showAllPicker = true;

        this.loading = false;
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  onMessageOut(msg: ITableMessage) {
    let params = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPageActivities'] = msg.data;
        this.activitiesService.fetchDataConfig.currentPage = params['currentPageActivities'];
        break;
      case 'pageSize':
        params['pageSizeActivities'] = msg.data.value;
        if (params['pageSizeActivities'] === this.tableData.totalListItems) {
          this.loading = true;
        }
        params['currentPageActivities'] = 1;
        this.activitiesService.fetchDataConfig.pageSize = params['pageSizeActivities'];
        this.activitiesService.fetchDataConfig.currentPage = params['currentPageActivities'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  executeSearch(searchPackage) {
    let params = {};
    if (searchPackage.keywords) {
      params['keywordsActivities'] = searchPackage.keywords;
      this.activitiesService.fetchDataConfig.keywords = params['keywordsActivities'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortByActivities'] = '-score';
        this.activitiesService.fetchDataConfig.sortBy = params['sortByActivities'];
      }
    } else {
      params['keywordsActivities'] = null;
      params['sortByActivities'] = '-dateAdded';
      this.activitiesService.fetchDataConfig.keywords = '';
      this.activitiesService.fetchDataConfig.sortBy = params['sortByActivities'];
    }
    params['currentPageActivities'] = 1;
    this.activitiesService.fetchDataConfig.currentPage = params['currentPageActivities'];
    this.submit(params);
  }

  submit(params) {
    this.storageService.state.scrollPosition = {
      type: 'scrollPosition',
      data: [window.scrollX, this.activitiesHeader.nativeElement.offsetTop - (this.activitiesHeader.nativeElement.clientHeight * 2)]
    };
    this.router.navigate(
      [],
      {
        queryParams: params,
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    this.activitiesService.refreshData();
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
