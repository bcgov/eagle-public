import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';

import { takeWhile } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { ActivityCardComponent } from 'app/shared/components/activity-card/activity-card.component';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { StorageService } from 'app/services/storage.service';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-project-activites',
  templateUrl: './project-activites.component.html',
  styleUrls: ['./project-activites.component.css'],
  imports: [TableTemplateComponent, SearchFilterTemplateComponent],
  standalone: true
})
export class ProjectActivitesComponent implements OnInit, OnDestroy {
  @ViewChild('activitiesHeader', { static: false }) activitiesHeader?: ElementRef;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private storageService = inject(StorageService);

  private alive = true;
  private readonly tableId = 'projectActivities';
  private projId = '';
  private readonly tableSignal$ = toObservable(this.tableService.getTableSignal(this.tableId));

  public loadingState = inject(LoadingStateService);
  public loading = this.loadingState.getOperationState('table-projectActivities');
  public queryParams: Params = {};

  public tableData = signal<TableObject>(new TableObject({ component: ActivityCardComponent, data: { showProjectInfo: false } }));
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
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    // Watch for table data changes from service
    this.tableSignal$.pipe(takeWhile(() => this.alive)).subscribe(searchResults => {
      // Only process when we have actual API results (not initial null value)
      if (searchResults !== null && searchResults !== undefined) {
        const currentTableData = this.tableData();
        // Create new TableObject to ensure change detection with OnPush
        const updatedTableData = new TableObject({
          component: ActivityCardComponent,
          data: { showProjectInfo: false },
          pageSize: currentTableData.pageSize,
          currentPage: currentTableData.currentPage,
          sortBy: currentTableData.sortBy,
          tableId: 'activities-table'
        });
        
        if (searchResults.data && Array.isArray(searchResults.data) && searchResults.data.length > 0) {
          updatedTableData.totalListItems = searchResults.totalSearchCount;
          updatedTableData.items = searchResults.data.map((record: any) => {
            return { rowData: record };
          });
          updatedTableData.columns = this.tableColumns;
        } else {
          updatedTableData.totalListItems = 0;
          updatedTableData.items = [];
        }
        updatedTableData.options.showAllPicker = true;
        updatedTableData.options.disableRowHighlight = true;
        this.tableData.set(updatedTableData);
      }
    });

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params: any = {};
      data.keys.forEach(key => params[key] = data.get(key));
      this.queryParams = { ...params };
      
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData(), 'Activities');

      updatedTableData.sortBy = params.sortByActivities || '-dateAdded';

      this.tableData.set(updatedTableData);
      
      // Fetch data
      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        params['keywordsActivities'] || '',
        'RecentActivity',
        [],
        updatedTableData.currentPage,
        updatedTableData.pageSize,
        updatedTableData.sortBy,
        { project: this.projId },
        true
      ));
    });
  }

  onMessageOut(msg: ITableMessage) {
    const params: any = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPageActivities'] = msg.data;
        break;
      case 'pageSize':
        params['pageSizeActivities'] = msg.data.value;
        params['currentPageActivities'] = 1;
        break;
    }
    this.submit(params);
  }

  executeSearch(searchPackage: any) {
    const params: any = {
      keywordsActivities: searchPackage.keywords || null,
      sortByActivities: searchPackage.keywords && searchPackage.keywordsChanged ? '-score' : '-dateAdded',
      currentPageActivities: 1
    };
    this.submit(params);
  }

  submit(params: any) {
    if (this.activitiesHeader?.nativeElement) {
      const headerElement = this.activitiesHeader.nativeElement;
      this.storageService.state = {
        type: 'scrollPosition',
        data: [window.scrollX, headerElement.offsetTop - (headerElement.clientHeight * 2)]
      };
    }
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route,
      queryParamsHandling: 'merge'
    });
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
