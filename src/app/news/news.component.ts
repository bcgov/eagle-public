import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, effect, untracked } from '@angular/core';

import { Router, ActivatedRoute, Params } from '@angular/router';
import { takeWhile } from 'rxjs/operators';

import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { ActivityCardComponent } from 'app/shared/components/activity-card/activity-card.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrl: './news.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableTemplateComponent, HeroBannerComponent, SearchFilterTemplateComponent],
  standalone: true
})
export class NewsListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private loadingState = inject(LoadingStateService);

  private tableId = 'news';
  private alive = true;

  loading = this.loadingState.getOperationState('table-news');
  tableData = signal<TableObject>(new TableObject({ component: ActivityCardComponent }));
  
  tableColumns: IColumnObject[] = [
    {
      name: 'Headline',
      value: 'headline',
      width: 'col-10',
      nosort: true
    },
    {
      name: 'Date',
      value: 'dateAdded',
      width: 'col-2',
      nosort: false
    }
  ];

  constructor() {
    // Watch for table data changes from service
    const tableSignal = this.tableService.getTableSignal(this.tableId);
    effect(() => {
      const searchResults = tableSignal();
      
      // Only process if we have valid data and it's not the initial null state
      if (searchResults && searchResults.data && searchResults.totalSearchCount !== undefined) {
        // Use untracked to read current tableData without creating a dependency
        const currentTableData = untracked(() => this.tableData());
        const newTableData = new TableObject({
          component: ActivityCardComponent,
          pageSize: currentTableData.pageSize,
          currentPage: currentTableData.currentPage,
          sortBy: currentTableData.sortBy
        });

        newTableData.totalListItems = searchResults.totalSearchCount;
        newTableData.items = searchResults.data.map((record: any) => ({ rowData: record }));
        newTableData.columns = this.tableColumns;
        newTableData.options.showPageCountDisplay = true;
        newTableData.options.showPagination = true;
        newTableData.options.showAllPicker = true;
        newTableData.options.disableRowHighlight = true;

        this.tableData.set(newTableData);
      }
    });
  }

  ngOnInit(): void {
    // Subscribe to query params and fetch data
    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const params = (data as any)['params'] || {};
      
      const updatedTableData = this.tableTemplateUtils.updateTableObjectWithUrlParams(params, this.tableData());

      if (updatedTableData.sortBy === '-datePosted') {
        updatedTableData.sortBy = '-dateAdded';
      }

      this.tableData.set(updatedTableData);

      // Fetch data with current params
      this.tableService.fetchData(new SearchParamObject(
        this.tableId,
        params['keywords'] || '',
        'RecentActivity',
        [],
        updatedTableData.currentPage,
        updatedTableData.pageSize,
        updatedTableData.sortBy,
        {},
        true
      ));
    });
  }

  onMessageOut(msg: ITableMessage): void {
    const params: Params = {};
    const currentParams = this.route.snapshot.queryParams;
    
    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = this.toggleSortDirection(msg.data);
        params['currentPage'] = 1;
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
    }
    
    this.submit({ ...currentParams, ...params });
  }

  private toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;
    
    // If we're sorting by the same field, toggle direction
    if (currentSort?.includes(field)) {
      return (currentSort?.[0] === '+' ? '-' : '+') + field;
    }
    
    // Default to descending for new field
    return '-' + field;
  }

  submit(params: Params): void {
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route
    });
  }

  ngOnDestroy(): void {
    this.alive = false;
  }

  executeSearch(searchEvent: any): void {
    const params: Params = {
      ...this.route.snapshot.queryParams,
      currentPage: 1
    };
    
    if (searchEvent.keywords) {
      params['keywords'] = searchEvent.keywords;
    } else {
      delete params['keywords'];
    }
    
    this.submit(params);
  }
}
