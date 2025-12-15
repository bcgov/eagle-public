import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, inject } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeWhile } from 'rxjs/operators';

import { SearchResults } from 'app/models/search';
import { ActivitiesListTableRowsComponent } from './activities-list-table-rows/activities-list-table-rows.component';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { StorageService } from 'app/services/storage.service';
import { TableService } from 'app/services/table.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.css'],
  imports: [CommonModule, TableTemplateComponent, SearchFilterTemplateComponent],
  standalone: true
})
export class ProjectActivitesComponent implements OnInit, OnDestroy {
  @ViewChild('activitiesHeader', { static: true }) activitiesHeader!: ElementRef;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private storageService = inject(StorageService);
  private _changeDetectionRef = inject(ChangeDetectorRef);

  private alive = true;
  private tableId = 'projectActivities';

  public loading = true;
  public queryParams: Params = {};

  public tableData: TableObject = new TableObject({ component: ActivitiesListTableRowsComponent });
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

  ngOnInit() {
    this.tableData.options.showPageCountDisplay = true;
    this.tableData.options.showPagination = true;

    this.tableData.tableId = 'activities-table';

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.queryParams = { ...params };
      // Get params from route, shove into the tableTemplateUtils so that we get a new dataset to work with.
      this.tableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData, 'Activities');

      if (!params.sortBy) {
        this.tableData.sortBy = '-dateAdded';
      }

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

        this.loading = false;
        this._changeDetectionRef.detectChanges();
      }
    });
  }

  onMessageOut(msg: ITableMessage) {
    let params: any = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPageActivities'] = msg.data;
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPageActivities'];
        break;
      case 'pageSize':
        params['pageSizeActivities'] = msg.data.value;
        if (params['pageSizeActivities'] === this.tableData.totalListItems) {
          this.loading = true;
        }
        params['currentPageActivities'] = 1;
        this.tableService.data[this.tableId].cachedConfig.pageSize = params['pageSizeActivities'];
        this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPageActivities'];
        break;
      default:
        break;
    }
    this.submit(params);
  }

  executeSearch(searchPackage: any) {
    let params: any = {};
    if (searchPackage.keywords) {
      params['keywordsActivities'] = searchPackage.keywords;
      this.tableService.data[this.tableId].cachedConfig.keywords = params['keywordsActivities'];
      // always change sortBy to '-score' if keyword search is directly triggered by user
      if (searchPackage.keywordsChanged) {
        params['sortByActivities'] = '-score';
        this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortByActivities'];
      }
    } else {
      params['keywordsActivities'] = null;
      params['sortByActivities'] = '-dateAdded';
      this.tableService.data[this.tableId].cachedConfig.keywords = '';
      this.tableService.data[this.tableId].cachedConfig.sortBy = params['sortByActivities'];
    }
    params['currentPageActivities'] = 1;
    this.tableService.data[this.tableId].cachedConfig.currentPage = params['currentPageActivities'];
    this.submit(params);
  }

  submit(params: any) {
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
    this.tableService.refreshData(this.tableId);
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
