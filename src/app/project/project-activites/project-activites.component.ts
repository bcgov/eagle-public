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

  private alive = true;
  private readonly tableId = 'projectActivities';
  private projId = '';
  private tableSignal = this.tableService.getTableSignal(this.tableId);

  public loading = signal(true);
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
        this.loading.set(false);
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

      if (!params.sortBy) {
        updatedTableData.sortBy = '-dateAdded';
      }

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
    let params: any = {};
    switch (msg.label) {
      case 'pageNum':
        params['currentPageActivities'] = msg.data;
        break;
      case 'pageSize':
        params['pageSizeActivities'] = msg.data.value;
        if (params['pageSizeActivities'] === this.tableData().totalListItems) {
          this.loading.set(true);
        }
        params['currentPageActivities'] = 1;
        break;
    }
    this.submit(params);
  }

  executeSearch(searchPackage: any) {
    let params: any = {};
    if (searchPackage.keywords) {
      params['keywordsActivities'] = searchPackage.keywords;
      if (searchPackage.keywordsChanged) {
        params['sortByActivities'] = '-score';
      }
    } else {
      params['keywordsActivities'] = null;
      params['sortByActivities'] = '-dateAdded';
    }
    params['currentPageActivities'] = 1;
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
  }

  ngOnDestroy() {
    this.alive = false;
  }
}
