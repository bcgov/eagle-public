import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, Params, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { takeWhile, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { PROJECT_LIST_TABLE_ID, PROJECT_LIST_TABLE_COLUMNS, FILTER_CONFIGS, FILTER_LIST, DATE_FILTER_LIST, FilterConfig } from './project-list.constants';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { FilterObject, FilterType } from 'app/shared/components/search-filter-template/filter-object';
import { ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';
import { OrgService } from 'app/services/org.service';
import { Org } from 'app/models/organization';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { ConfigService } from 'app/services/config.service';
import { LoadingStateService } from 'app/services/loading-state.service';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
  imports: [CommonModule, RouterLink, TableTemplateComponent, SearchFilterTemplateComponent, HeroBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tableTemplateUtils = inject(TableTemplate);
  private tableService = inject(TableService);
  private orgService = inject(OrgService);
  private configService = inject(ConfigService);
  private loadingState = inject(LoadingStateService);
  private destroyRef = inject(DestroyRef);

  // Signals for component state
  readonly showAdvancedFilters = signal(false);
  readonly filters = signal<FilterObject[]>([]);
  readonly tableData = signal<TableObject>(new TableObject({ 
    component: ProjectListTableRowsComponent,
    sortBy: '+name'
  }));
  
  // Use loading state from service instead of local signal
  readonly loadingTableData = this.loadingState.getOperationState(`table-${PROJECT_LIST_TABLE_ID}`);
  
  // Computed signals for loading state
  private listsLoaded = signal(false);
  private proponentsLoaded = signal(false);
  readonly loadingLists = computed(() => !this.listsLoaded() || !this.proponentsLoaded());
  
  // Table configuration
  readonly tableColumns = PROJECT_LIST_TABLE_COLUMNS;

  // Component state
  private alive = true;
  private proponents: Org[] = [];
  private eaDecisions: any[] = [];
  private iaacInvolvements: any[] = [];
  private phases: any[] = [];
  private tableSignal = this.tableService.getTableSignal(PROJECT_LIST_TABLE_ID);
  private tableSignal$ = toObservable(this.tableSignal);

  constructor() {}

  ngOnInit() {
    // Watch table signal for updates
    this.tableSignal$
      .pipe(
        takeWhile(() => this.alive),
        skip(1) // Skip initial empty value
      )
      .subscribe(searchResults => {
        if (searchResults && searchResults.data !== undefined) {
          const current = this.tableData();
          const newTableData = new TableObject({
            component: ProjectListTableRowsComponent,
            pageSize: current.pageSize,
            currentPage: current.currentPage,
            sortBy: current.sortBy
          });

          newTableData.totalListItems = searchResults.totalSearchCount || 0;
          newTableData.items = (searchResults.data && Array.isArray(searchResults.data)) 
            ? searchResults.data.map((record: any) => ({ rowData: record }))
            : [];
          newTableData.columns = this.tableColumns;
          newTableData.options.showAllPicker = true;

          this.tableData.set(newTableData);
        }
        
        // Loading state is now managed by TableService
      });
    
    // Fetch proponents for filter options
    this.orgService.fetchProponent();
    
    // Load lists and proponents, then build filters and process params
    combineLatest([
      this.orgService.getValue(),
      this.configService.lists
    ]).pipe(takeWhile(() => this.alive)).subscribe(([orgs, lists]) => {
      if (orgs && orgs.length > 0) {
        this.proponents = orgs;
        this.proponentsLoaded.set(true);
      }

      if (lists && lists.length > 0) {
        lists.forEach((item: any) => {
          switch (item.type) {
            case 'eaDecision':
              this.eaDecisions.push(Object.assign({}, item));
              break;
            case 'CEAA':
              this.iaacInvolvements.push(Object.assign({}, item));
              break;
            case 'projectPhase':
              this.phases.push(Object.assign({}, item));
              break;
          }
        });
        this.listsLoaded.set(true);
      }

      // Once both loaded, build filters and process initial params
      if (this.proponentsLoaded() && this.listsLoaded() && this.filters().length === 0) {
        this.filters.set(this.buildFilters());
        this.updateTableFromQueryParams(this.route.snapshot.queryParams);
      }
    });

    // Subscribe to query params changes
    this.route.queryParams.pipe(
      takeWhile(() => this.alive),
      skip(1), // Skip initial value (already handled above)
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ).subscribe(params => {
      this.updateTableFromQueryParams(params);
    });
  }

  private buildFilters(): FilterObject[] {
    return FILTER_CONFIGS.map(config => this.createFilter(config));
  }

  private createFilter(config: FilterConfig): FilterObject {
    // Use object lookup for dynamic options (more efficient than if-else chain)
    const dynamicOptions: Record<string, any[]> = {
      'eaDecision': this.eaDecisions,
      'CEAAInvolvement': this.iaacInvolvements,
      'currentPhaseName': this.phases,
      'proponent': this.proponents
    };
    
    const options = dynamicOptions[config.id] || config.options || [];

    // Create appropriate definition based on type
    let definition: any;
    if (config.type === FilterType.DateRange && config.dateConfig) {
      definition = {
        startDateId: config.dateConfig.startId,
        startDateLabel: config.dateConfig.startLabel,
        endDateId: config.dateConfig.endId,
        endDateLabel: config.dateConfig.endLabel
      };
    } else {
      definition = {
        options,
        useGroup: config.useGroup,
        matchId: config.matchId
      };
    }

    return new FilterObject(config.id, config.type, config.label, definition, config.panelSize ?? null);
  }

  private updateTableFromQueryParams(params: Params): void {
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
    const allFilterKeys = [...FILTER_LIST, ...DATE_FILTER_LIST];
    const filters = this.tableTemplateUtils.getFiltersFromParams(params, allFilterKeys);
    
    this.tableService.fetchData(new SearchParamObject(
      PROJECT_LIST_TABLE_ID,
      params['keywords'] || '',
      'Project',
      [],
      +(params['currentPage'] || 1),
      +(params['pageSize'] || 10),
      params['sortBy'] || '+name',
      {},
      true,
      '',
      filters
    ));
  }

  private hasFilterParams(params: Params): boolean {
    return FILTER_LIST.some(filter => params[filter]);
  }

  navSearchHelp(): void {
    this.router.navigate(['/search-help']);
  }

  executeSearch(searchPackage: any): void {
    const hasKeywords = searchPackage.keywords?.trim();
    
    // Get current params to preserve sorting and other state
    const currentParams = this.route.snapshot.queryParams;
    
    // Build params for URL
    const params: Params = {
      currentPage: 1,
      keywords: hasKeywords || null,
      // When searching with keywords, sort by relevance (-score)
      // When clearing search, reset to default ascending name (+name)
      // When keywords haven't changed, preserve current sort
      sortBy: hasKeywords 
        ? (searchPackage.keywordsChanged ? '-score' : (currentParams['sortBy'] || '+name'))
        : '+name'
    };
    
    // Get filters for URL (with null values to clear)
    const filters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage,
      FILTER_LIST,
      DATE_FILTER_LIST
    );
    
    const newParams = { ...params, ...filters };
    
    // Always submit - loading state is managed by TableService
    // Navigation and fetchData will handle everything
    this.submit(newParams);
  }

  onMessageOut(msg: ITableMessage): void {
    const params = this.buildTableMessageParams(msg);
    // Merge with current query params to preserve filters
    const currentParams = this.route.snapshot.queryParams;
    
    const newParams = { ...currentParams, ...params };
    
    // Always submit - loading state is managed by TableService
    this.submit(newParams);
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
    // Navigate - queryParams subscription will handle the rest
    this.router.navigate([], {
      queryParams: params,
      relativeTo: this.route
    });
  }

  ngOnDestroy(): void {
    this.alive = false;
  }
}
