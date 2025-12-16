import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute, Params, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeWhile } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

import { FilterObject, FilterType, MultiSelectDefinition, DateFilterDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';
import { ConfigService } from 'app/services/config.service';
import { IColumnObject, TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { OrgService } from 'app/services/org.service';
import { Org } from 'app/models/organization';
import { TableService } from 'app/services/table.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import {
  PROJECT_LIST_TABLE_ID,
  PROJECT_LIST_TABLE_COLUMNS,
  FILTER_CONFIGS,
  FILTER_LIST,
  DATE_FILTER_LIST,
  LEGISLATION_FILTER_GROUP,
  type FilterConfig
} from './project-list.constants';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
  imports: [CommonModule, RouterLink, TableTemplateComponent, SearchFilterTemplateComponent, HeroBannerComponent],
  standalone: true
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private orgService = inject(OrgService);
  private configService = inject(ConfigService);

  // Signals for component state
  readonly loadingTableParams = signal(true);
  readonly loadingTableData = signal(true);
  readonly showAdvancedFilters = signal(false);
  readonly filters = signal<FilterObject[]>([]);
  readonly tableData = signal<TableObject>(new TableObject({ component: ProjectListTableRowsComponent }));
  
  // Computed signals for loading state
  private listsLoaded = signal(false);
  private proponentsLoaded = signal(false);
  readonly loadingLists = computed(() => !this.listsLoaded() || !this.proponentsLoaded());
  
  // Table configuration
  readonly tableColumns = PROJECT_LIST_TABLE_COLUMNS;

  // Component state
  private alive = true;
  private initialLoad = true;
  private proponents: Org[] = [];
  private eaDecisions: any[] = [];
  private iaacInvolvements: any[] = [];
  private phases: any[] = [];
  private filtersBuilt = false;

  ngOnInit() {
    // Load lists and proponents, then build filters
    combineLatest([
      this.orgService.getValue(),
      this.configService.lists
    ]).pipe(takeWhile(() => this.alive)).subscribe(([orgs, lists]) => {
      let shouldBuildFilters = false;

      // Only process if data has changed
      if (orgs?.length > 0 && this.proponents.length === 0) {
        this.proponents = orgs;
        this.proponentsLoaded.set(true);
        shouldBuildFilters = true;
      }
      
      if (lists?.length > 0 && this.eaDecisions.length === 0) {
        // Single pass through lists to categorize
        for (const item of lists) {
          switch (item.type) {
            case 'eaDecisions':
              this.eaDecisions.push(item);
              break;
            case 'ceaaInvolvements':
              this.iaacInvolvements.push(item);
              break;
            case 'projectPhase':
              this.phases.push(item);
              break;
          }
        }
        this.listsLoaded.set(true);
        shouldBuildFilters = true;
      }

      // Build filters only once when both are loaded
      if (!this.filtersBuilt && this.proponentsLoaded() && this.listsLoaded()) {
        this.filters.set(this.buildFilters());
        this.filtersBuilt = true;
      }
    });

    // Subscribe to query params
    this.route.queryParams.pipe(takeWhile(() => this.alive)).subscribe(params => {
      this.updateTableFromQueryParams(params);
    });

    // Subscribe to table results
    this.tableService.getValue(PROJECT_LIST_TABLE_ID).pipe(takeWhile(() => this.alive)).subscribe((searchResults: any) => {
      if (searchResults?.data && searchResults.data !== 0) {
        this.updateTableWithResults(searchResults);
      }
    });
  }

  private buildFilters(): FilterObject[] {
    return FILTER_CONFIGS.map(config => this.createFilter(config));
  }

  private createFilter(config: FilterConfig): FilterObject {
    // Use object lookup for dynamic options (more efficient than if-else chain)
    const dynamicOptions: Record<string, any[]> = {
      'eacDecision': this.eaDecisions,
      'CEAAInvolvement': this.iaacInvolvements,
      'currentPhaseName': this.phases,
      'proponent': this.proponents
    };
    
    const options = dynamicOptions[config.id] || config.options || [];

    // Create appropriate definition based on type
    let definition: any;
    if (config.type === FilterType.DateRange && config.dateConfig) {
      const dc = config.dateConfig;
      definition = new DateFilterDefinition(dc.startId, dc.startLabel, dc.endId, dc.endLabel);
    } else {
      const group = config.useGroup ? LEGISLATION_FILTER_GROUP : null;
      definition = new MultiSelectDefinition(options, [], group, null, config.matchId ?? false);
    }

    return new FilterObject(config.id, config.type, config.label, definition, config.panelSize ?? null);
  }

  private updateTableFromQueryParams(params: Params): void {
    const updatedTable = this.tableTemplateUtils.updateTableObjectWithUrlParams(
      params,
      this.tableData()
    );

    if (!params['sortBy']) {
      updatedTable.sortBy = '+name';
    }

    // Show advanced filters if any filter params are present
    if (this.initialLoad && this.hasFilterParams(params)) {
      this.showAdvancedFilters.set(true);
      this.initialLoad = false;
    }

    this.tableData.set(updatedTable);
    this.loadingTableParams.set(false);
  }

  private hasFilterParams(params: Params): boolean {
    return FILTER_LIST.some(filter => params[filter]);
  }

  private updateTableWithResults(searchResults: any): void {
    const current = this.tableData();
    const newTableData = new TableObject({
      component: ProjectListTableRowsComponent,
      pageSize: current.pageSize,
      currentPage: current.currentPage,
      sortBy: current.sortBy
    });

    newTableData.totalListItems = searchResults.totalSearchCount;
    newTableData.items = searchResults.data.map((record: any) => ({ rowData: record }));
    newTableData.columns = this.tableColumns;
    newTableData.options.showAllPicker = true;

    this.tableData.set(newTableData);
    this.loadingTableData.set(false);
  }

  navSearchHelp(): void {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage: any): void {
    const params = this.buildSearchParams(searchPackage);
    const queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage,
      FILTER_LIST,
      DATE_FILTER_LIST
    );

    this.updateTableServiceCache(params, searchPackage, queryFilters);
    this.submit(params, queryFilters);
  }

  private buildSearchParams(searchPackage: any): Params {
    const params: Params = { currentPage: 1 };

    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '+name';
    }

    return params;
  }

  private updateTableServiceCache(params: Params, searchPackage: any, queryFilters: any): void {
    const cache = this.tableService.data[PROJECT_LIST_TABLE_ID].cachedConfig;
    
    cache.keywords = params['keywords'] || '';
    cache.sortBy = params['sortBy'] || cache.sortBy;
    cache.currentPage = params['currentPage'];
    
    // Filter out null values for API calls
    cache.filters = Object.fromEntries(
      Object.entries(queryFilters).filter(([_, value]) => value != null)
    );
  }

  onMessageOut(msg: ITableMessage): void {
    const params = this.buildTableMessageParams(msg);
    this.submit(params);
  }

  private buildTableMessageParams(msg: ITableMessage): Params {
    const params: Params = {};
    const cache = this.tableService.data[PROJECT_LIST_TABLE_ID].cachedConfig;

    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = cache.sortBy = this.toggleSortDirection(msg.data);
        break;
      case 'pageNum':
        params['currentPage'] = cache.currentPage = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = cache.pageSize = msg.data.value;
        params['currentPage'] = cache.currentPage = 1;
        
        if (params['pageSize'] === this.tableData().totalListItems) {
          this.loadingTableData.set(true);
        }
        break;
    }

    return params;
  }

  private toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;
    return (currentSort?.[0] === '+' ? '-' : '+') + field;
  }

  private submit(params: Params, filters: any = null): void {
    const finalParams = filters ? { ...params, ...filters } : params;
    
    this.router.navigate([], {
      queryParams: finalParams,
      relativeTo: this.route,
      queryParamsHandling: 'merge'
    });
    
    this.loadingTableData.set(true);
    this.tableService.refreshData(PROJECT_LIST_TABLE_ID);
  }

  ngOnDestroy(): void {
    this.alive = false;
  }
}
