import { computed, DestroyRef, inject, WritableSignal, Signal, afterNextRender } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { take, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { TableTemplate } from '../../shared/components/table-template/table-template';
import { TableService } from '../../services/table.service';
import { LoadingStateService } from '../../services/loading-state.service';
import { ConfigService } from '../../services/config.service';
import { Utils } from '../../shared/utils/utils';
import { DocumentTableRowsComponent } from '../documents/project-document-table-rows/project-document-table-rows.component';

/**
 * Abstract base class for project document tab components
 * (Amendments, Application, Certificates, Documents).
 *
 * Provides shared inject()s, lifecycle wiring, and common methods.
 * Subclasses implement the data-loading specifics and filter setup.
 *
 * Usage:
 *   1. Extend this class in your component.
 *   2. Declare abstract properties (tableId, tableColumns, tableData, filtersList, dateFiltersList).
 *   3. In the constructor, set projId, call clearTable, then call setup().
 *   4. Implement initListData() and fetchDataWithCurrentParams().
 */
export abstract class ProjectDocumentTabBase {
  protected readonly route         = inject(ActivatedRoute);
  protected readonly router        = inject(Router);
  protected readonly tableTemplateUtils = inject(TableTemplate);
  protected readonly tableService  = inject(TableService);
  protected readonly loadingState  = inject(LoadingStateService);
  protected readonly configService = inject(ConfigService);
  protected readonly utils         = inject(Utils);
  protected readonly destroyRef    = inject(DestroyRef);

  protected projId = '';
  protected lists: any[] = [];
  public queryParams: Params = {};

  /** Initialized by setup() — available after constructor. */
  public loading!: Signal<boolean>;

  // ── Abstract members ──────────────────────────────────────────────────────

  /** Unique table identifier used by TableService. */
  protected abstract readonly tableId: string;

  /** Filter param keys (excluding date filters). */
  protected abstract readonly filtersList: string[];

  /** Date-range filter param keys. */
  protected abstract readonly dateFiltersList: string[];

  /** Column definitions rendered by the table template. */
  public abstract readonly tableColumns: IColumnObject[];

  /** Signal holding the current table state. */
  public abstract readonly tableData: WritableSignal<TableObject>;

  // ── Optional overrides ────────────────────────────────────────────────────

  /**
   * Advanced-filter panel visibility signal. Override with `signal(false)` in
   * subclasses that have a filter panel. Null = no filter panel (Certificates).
   */
  protected readonly showAdvancedFilters: WritableSignal<boolean> | null = null;

  /**
   * Set to true in subclasses where table rows should show the featured star
   * (Documents tab). All other tabs set showFeatured = false.
   */
  protected readonly showFeatured: boolean = false;

  readonly isTypesense = computed(() => !!this.configService.config().TYPESENSE_ENABLED);

  // ── Lifecycle wiring ──────────────────────────────────────────────────────

  /**
   * Wire up table signal subscription and the lists→queryParamMap chain.
   * Must be called from the subclass constructor after projId is set and
   * the table has been cleared.
   */
  protected setup(): void {
    this.loading = this.loadingState.getOperationState(`table-${this.tableId}`);

    // React to table service updates (MongoDB path)
    toObservable(this.tableService.getTableSignal(this.tableId))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(searchResults => {
        if (searchResults?.data) {
          const current = this.tableData();
          const updated = new TableObject({
            component: DocumentTableRowsComponent,
            pageSize:    current.pageSize,
            currentPage: current.currentPage,
            sortBy:      current.sortBy,
          });
          updated.totalListItems    = searchResults.totalSearchCount;
          updated.items             = searchResults.data.map((record: any) => {
            record.showFeatured = this.showFeatured;
            return { rowData: record };
          });
          updated.columns           = this.tableColumns;
          updated.options.showAllPicker = true;
          this.tableData.set(updated);
          this.loadingState.stopLoading(`table-${this.tableId}`);
        }
      });

    // Load list metadata immediately so filter components are ready on first render.
    this.configService.lists.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => {
      this.lists = list;
      this.initListData(list);
      if (this.showAdvancedFilters) {
        const snap = this.route.snapshot.queryParamMap;
        if ([...this.filtersList, ...this.dateFiltersList].some(k => snap.has(k))) {
          this.showAdvancedFilters.set(true);
        }
      }
    });

    // Build the fetch pipeline in the constructor (injection context required for
    // takeUntilDestroyed), but subscribe only after Angular has painted the first frame.
    // afterNextRender() guarantees the skeleton is on screen before any fetch fires.
    const fetchPipeline$ = this.configService.lists.pipe(
      take(1),
      switchMap(() => this.route.queryParamMap),
      takeUntilDestroyed(this.destroyRef)
    );

    afterNextRender(() => {
      fetchPipeline$.subscribe(() => this.fetchDataWithCurrentParams());
    });
  }

  // ── Abstract methods ──────────────────────────────────────────────────────

  /**
   * Parse the config lists into local option arrays and call setFilters().
   * Called once when lists metadata becomes available.
   */
  protected abstract initListData(list: any[]): void;

  /**
   * Read current URL params from the route snapshot, update tableData,
   * and dispatch a fetch to the table service.
   * Called on each route query-param change.
   */
  protected abstract fetchDataWithCurrentParams(): void;

  // ── Shared methods ────────────────────────────────────────────────────────

  onMessageOut(msg: ITableMessage): void {
    const params: Params = {};
    switch (msg.label) {
      case 'columnSort':
        params['sortBy']      = this.toggleSortDirection(msg.data);
        params['currentPage'] = 1;
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize']    = msg.data.value;
        params['currentPage'] = 1;
        break;
    }
    this.submit({ ...this.route.snapshot.queryParams, ...params });
  }

  executeSearch(searchPackage: any): void {
    const params: any = {
      keywords:  searchPackage.keywords || null,
      sortBy:    searchPackage.keywords && searchPackage.keywordsChanged ? '-score' : '-datePosted',
      currentPage: 1,
    };
    const queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage, this.filtersList, this.dateFiltersList
    );
    this.submit(params, queryFilters);
  }

  onToggleFiltersPanel(event: { showPanel: boolean }): void {
    this.showAdvancedFilters?.set(event.showPanel);
  }

  submit(params: any, filters: any = null): void {
    this.router.navigate([], {
      queryParams:         filters ? { ...params, ...filters } : params,
      relativeTo:          this.route,
      queryParamsHandling: 'merge',
    });
  }

  protected toggleSortDirection(field: string): string {
    const currentSort = this.tableData().sortBy;
    if (currentSort?.includes(field)) {
      return (currentSort[0] === '+' ? '-' : '+') + field;
    }
    return '-' + field;
  }

  /** Build a filters object from current queryParams for the given lists. */
  protected buildFilters(): Record<string, string> {
    const result: Record<string, string> = {};
    [...this.filtersList, ...this.dateFiltersList].forEach(key => {
      if (this.queryParams[key]) result[key] = this.queryParams[key];
    });
    return result;
  }

  /** Read current route snapshot params into queryParams + update tableData. */
  protected readCurrentParams(defaultSortBy = '-datePosted'): TableObject {
    const snap = this.route.snapshot.queryParamMap;
    this.queryParams = { ...(snap as any)['params'] };
    const updated = this.tableTemplateUtils.updateTableObjectWithUrlParams(this.queryParams, this.tableData());
    if (!this.queryParams['sortBy']) {
      updated.sortBy = defaultSortBy;
    }
    // Set columns immediately so the skeleton can mirror real table layout
    // before data arrives (avoids layout shift when results pop in).
    if (!updated.columns?.length) {
      updated.columns = this.tableColumns;
    }
    this.tableData.set(updated);
    return updated;
  }
}
