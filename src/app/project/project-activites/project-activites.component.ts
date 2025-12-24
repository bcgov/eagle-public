import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, effect } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeWhile } from 'rxjs/operators';

import { ActivitiesListTableRowsComponent } from './activities-list-table-rows/activities-list-table-rows.component';
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
  private loadingState = inject(LoadingStateService);

  private alive = true;
  private readonly tableId = 'projectActivities';
  private projId = '';
  private tableSignal = this.tableService.getTableSignal(this.tableId);

  public loading = this.loadingState.isLoading;
  public queryParams: Params = {};

  public tableData = signal<TableObject>(new TableObject({ component: ActivitiesListTableRowsComponent }));
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

  constructor() {
    // Watch for table data changes from service
    effect(() => {
      const searchResults = this.tableSignal();
      
      // Only process when we have actual API results (not initial null value)
      if (searchResults !== null && searchResults !== undefined) {
        const updatedTableData = this.tableData();
        if (searchResults.data && Array.isArray(searchResults.data) && searchResults.data.length > 0) {
          updatedTableData.totalListItems = searchResults.totalSearchCount;
          updatedTableData.items = searchResults.data.map((record: any) => {
            return { rowData: record };
          });
          updatedTableData.columns = this.tableColumns;
          updatedTableData.options.showAllPicker = true;
        } else {
          updatedTableData.totalListItems = 0;
          updatedTableData.items = [];
        }
        this.tableData.set(updatedTableData);
      }
    });
  }

  ngOnInit() {
    // Get project ID from parent route
    this.projId = this.route.parent?.snapshot.params['projId'] || '';

    const currentTableData = this.tableData();
    currentTableData.options.showPageCountDisplay = true;
    currentTableData.options.showPagination = true;
    currentTableData.tableId = 'activities-table';
    this.tableData.set(currentTableData);

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
    const headerElement = this.activitiesHeader.nativeElement;
    this.storageService.state = {
      type: 'scrollPosition',
      data: [window.scrollX, headerElement.offsetTop - (headerElement.clientHeight * 2)]
    };
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
