import { Component, OnInit, OnDestroy, signal, input, inject, ChangeDetectionStrategy, computed, Injector, runInInjectionContext } from '@angular/core';

import { Router, ActivatedRoute, Params, RouterLink } from '@angular/router';
import { takeWhile, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { TableListConfig } from './table-list-config.interface';
import { TableObject } from '../table-template/table-object';
import { TableTemplate } from '../table-template/table-template';
import { FilterObject } from '../search-filter-template/filter-object';
import { ITableMessage } from '../table-template/table-row-component';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableTemplateComponent } from '../table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../search-filter-template/search-filter-template.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { LoadingStateService } from 'app/services/loading-state.service';

/**
 * Generic table-list component that handles common table-based list pages
 * Configured via TableListConfig input to support different data types
 */
@Component({
  selector: 'app-table-list',
  templateUrl: './table-list.component.html',
  styleUrls: ['./table-list.component.css'],
  imports: [
    RouterLink,
    TableTemplateComponent,
    SearchFilterTemplateComponent,
    HeroBannerComponent
],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class TableListComponent implements OnInit, OnDestroy {
  config = input.required<TableListConfig>();

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  public loadingState = inject(LoadingStateService);
  private injector = inject(Injector);

  // Signals for component state
  readonly showAdvancedFilters = signal(false);
  readonly filters = signal<FilterObject[]>([]);
  readonly tableData = signal<TableObject>(new TableObject({}));
  
  // Store filter data to pass to table rows
  private filterData: any = null;

  // Component state
  private alive = true;

  // Computed loading state based on config
  readonly loadingTableData = computed(() => {
    const cfg = this.config();
    return this.loadingState.getOperationState(`table-${cfg.tableId}`)();
  });

  ngOnInit() {
    const cfg = this.config();

    // Initialize table data with correct configuration
    this.tableData.set(new TableObject({
      component: cfg.tableRowComponent,
      sortBy: cfg.defaultSort,
      options: cfg.tableOptions
    }));

    // Watch table signal for updates (using injector context)
    const tableSignal = this.tableService.getTableSignal(cfg.tableId);
    runInInjectionContext(this.injector, () => {
      toObservable(tableSignal)
        .pipe(
          takeWhile(() => this.alive),
          skip(1) // Skip initial empty value
        )
        .subscribe(searchResults => {
          if (searchResults && searchResults.data !== undefined && searchResults.data !== 0) {
            this.updateTableData(searchResults);
          }
        });
    });

    // Initialize any required data fetching
    if (cfg.initializeData) {
      cfg.initializeData();
    }

    // Subscribe to filter data source
    cfg.filterDataSource
      .pipe(takeWhile(() => this.alive))
      .subscribe(data => {
        // Store the filter data to pass to table rows
        this.filterData = data;
        
        // Check if filter data is loaded
        const isLoaded = cfg.isFilterDataLoaded 
          ? cfg.isFilterDataLoaded(data)
          : data !== null && data !== undefined;

        if (isLoaded && this.filters().length === 0) {
          const builtFilters = cfg.filterBuilder(data);
          this.filters.set(builtFilters);
          this.updateTableFromQueryParams(this.route.snapshot.queryParams);
        }
      });

    // Subscribe to query params changes
    this.route.queryParams
      .pipe(
        takeWhile(() => this.alive),
        skip(1), // Skip initial emission to avoid duplicate with filter subscription
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      )
      .subscribe(params => {
        if (this.filters().length > 0) {
          this.updateTableFromQueryParams(params);
        }
      });
  }

  private updateTableData(searchResults: any): void {
    const cfg = this.config();
    const current = this.tableData();
    
    const newTableData = new TableObject({
      component: cfg.tableRowComponent,
      pageSize: current.pageSize,
      currentPage: current.currentPage,
      sortBy: current.sortBy
    });

    newTableData.totalListItems = searchResults.totalSearchCount || 0;
    newTableData.items = Array.isArray(searchResults.data)
      ? searchResults.data.map((record: any) => ({ rowData: record }))
      : [];
    newTableData.columns = cfg.tableColumns;
    newTableData.options.showAllPicker = true;
    
    // Apply custom table options from config
    if (cfg.tableOptions) {
      Object.assign(newTableData.options, cfg.tableOptions);
    }
    
    // Pass filter data (lists) to table rows via data property
    newTableData.data = {
      lists: this.filterData || []
    };

    this.tableData.set(newTableData);
  }

  private updateTableFromQueryParams(params: Params): void {
    const cfg = this.config();
    
    const updatedTable = this.tableTemplateUtils.updateTableObjectWithUrlParams(
      params,
      this.tableData()
    );

    // Show advanced filters if any filter params are present
    if (this.hasFilterParams(params)) {
      this.showAdvancedFilters.set(true);
    }

    this.tableData.set(updatedTable);

    // Fetch data with new params
    const allFilterKeys = [...cfg.filterList, ...cfg.dateFilterList];
    const filters = this.tableTemplateUtils.getFiltersFromParams(params, allFilterKeys);

    this.tableService.fetchData(new SearchParamObject(
      cfg.tableId,
      params['keywords'] || '',
      cfg.datasetType,
      [],
      +(params['currentPage'] || 1),
      +(params['pageSize'] || 10),
      params['sortBy'] || cfg.defaultSort,
      {},
      true,
      '',
      filters
    ));
  }

  private hasFilterParams(params: Params): boolean {
    const cfg = this.config();
    return cfg.filterList.some(filter => params[filter]);
  }

  executeSearch(searchPackage: any): void {
    const cfg = this.config();
    const hasKeywords = searchPackage.keywords?.trim();
    const currentParams = this.route.snapshot.queryParams;

    const params: Params = {
      currentPage: 1,
      keywords: hasKeywords || null,
      sortBy: hasKeywords
        ? (searchPackage.keywordsChanged ? '-score' : (currentParams['sortBy'] || cfg.defaultSort))
        : cfg.defaultSort
    };

    const filters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage,
      cfg.filterList,
      cfg.dateFilterList
    );

    this.submit({ ...params, ...filters });
  }

  onMessageOut(msg: ITableMessage): void {
    const currentParams = this.route.snapshot.queryParams;
    this.submit({ ...currentParams, ...this.buildTableMessageParams(msg) });
  }

  private buildTableMessageParams(msg: ITableMessage): Params {
    const params: Params = {};

    switch (msg.label) {
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
      case 'columnSort':
        params['sortBy'] = this.toggleSortDirection(msg.data);
        params['currentPage'] = 1;
        break;
    }

    return params;
  }

  private toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;

    // If we're sorting by the same field, toggle direction
    if (currentSort?.includes(field)) {
      return (currentSort?.[0] === '+' ? '-' : '+') + field;
    }

    // Default to ascending for new field
    return '+' + field;
  }

  private submit(params: Params): void {
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route
    });
  }

  ngOnDestroy(): void {
    this.alive = false;
  }
}
