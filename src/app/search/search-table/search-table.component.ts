import {
  Component, OnInit, OnDestroy, AfterViewInit, inject, input, signal, computed,
  ChangeDetectionStrategy, Type, ViewChild, ElementRef,
} from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, combineLatest, lastValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { TypesenseService } from 'app/services/typesense.service';
import { ConfigService } from 'app/services/config.service';
import { ApiService } from 'app/services/api';
import { NotificationProjectService } from 'app/services/notification-project.service';
import { TableTemplateComponent } from 'app/shared/components/table-template/table-template.component';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { ITableMessage, TableRowComponent } from 'app/shared/components/table-template/table-row-component';
import { DatePickerComponent } from 'app/shared/components/date-picker/date-picker.component';
import { SearchNotificationCardComponent } from './search-notification-card.component';
import {
  type CollectionId, type Tab, type DisplayItem, type LegislationGroup,
  type TableTab,
  COLLECTIONS, TABLE_TABS, SEARCH_TABLE_DEFS,
  tabToCollectionId, isoToUnixTimestamp,
  mergeItems, groupByLegislation,
} from '../search-collections';
import { SearchProjectTableRowsComponent } from './search-project-table-rows.component';
import { SearchDocTableRowsComponent } from './search-doc-table-rows.component';
import { SearchActivityTableRowsComponent } from './search-activity-table-rows.component';

const ROW_COMPONENTS: Partial<Record<TableTab, Type<TableRowComponent>>> = {
  projects:  SearchProjectTableRowsComponent,
  documents: SearchDocTableRowsComponent,
  updates:   SearchActivityTableRowsComponent,
};

@Component({
  selector: 'app-search-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TableTemplateComponent,
    DatePickerComponent,
    SearchNotificationCardComponent,
  ],
  templateUrl: './search-table.component.html',
  styleUrl: './search-table.component.css',
  animations: [
    trigger('sidebar', [
      state('open', style({ width: '250px', minWidth: '250px', marginRight: '1.5rem', paddingRight: '0.75rem' })),
      state('collapsed', style({ width: '0', minWidth: '0', marginRight: '0', paddingRight: '0' })),
      transition('open <=> collapsed', animate('250ms cubic-bezier(0.4, 0, 0.2, 1)')),
    ]),
  ],
})
export class SearchTableComponent implements OnInit, AfterViewInit, OnDestroy {
  typesenseAvailable = input(false);

  // TABLE_TABS for table views; content tab handled by UnifiedSearchComponent via wrapper
  readonly tabs = TABLE_TABS;
  readonly minDate = new Date(1970, 0, 1);

  // Notification cards rendered directly (not via TableTemplateComponent)
  notificationItems = signal<any[]>([]);

  // ── State signals ───────────────────────────────────────────────────────────
  activeTab     = signal<TableTab>('documents');
  searchQuery   = signal('');
  loading       = signal(true);  // true until first search completes — avoids flash of empty-state
  totalFound    = signal(0);
  procMs        = signal(0);
  tableData     = signal<TableObject>(new TableObject({}));
  sidebarCollapsed  = signal(localStorage.getItem('filterSidebarCollapsed') === 'true');
  collapsedFacets   = signal<Set<string>>(new Set());
  filtersOpen   = signal(false);
  filtersLoaded = signal(false);

  // Facet state
  facetItems    = signal<Record<string, DisplayItem[]>>({});
  groupedFacets = signal<Record<string, LegislationGroup[]>>({});
  activeRefinements = signal<Record<string, Set<string>>>({});

  // Date filter state
  fromCtrl = new FormControl<string | null>('');
  toCtrl   = new FormControl<string | null>('');

  // Current config (derived)
  activeDef        = computed(() => SEARCH_TABLE_DEFS[this.activeTab()]);
  activeCollectionId = computed((): CollectionId | null =>
    tabToCollectionId(this.activeTab() as Tab));
  activeConfig     = computed(() => {
    const colId = this.activeCollectionId();
    return colId ? COLLECTIONS[colId] : null;
  });
  activeFacets      = computed(() => this.activeConfig()?.facets ?? []);
  activePlaceholder = computed(() => this.activeConfig()?.placeholder ?? 'Search…');

  activeFilterCount = computed(() => {
    const refs = this.activeRefinements();
    let count = 0;
    for (const s of Object.values(refs)) count += s.size;
    if (this.fromCtrl.value) count++;
    if (this.toCtrl.value) count++;
    return count;
  });

  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private typesenseService = inject(TypesenseService);
  private configService    = inject(ConfigService);
  private api              = inject(ApiService);
  private notificationService = inject(NotificationProjectService);

  @ViewChild('sidebarRef') private sidebarRef!: ElementRef<HTMLElement>;
  private resizeObserver!: ResizeObserver;

  private destroy$ = new Subject<void>();
  private masterMaps: Record<string, Map<string, DisplayItem>> = {};
  private lawLookups: Record<string, Map<string, number>> = {};

  // Must be a class field — toObservable() requires injection context
  private typesenseAvailable$ = toObservable(this.typesenseAvailable);

  ngOnInit(): void {
    this.buildLawLookups();

    // Wait for Typesense to be available before running any search.
    // Route params fire synchronously on subscription; typesenseAvailable starts false.
    // combineLatest re-fires whenever either changes, filter(available) skips cold start.
    combineLatest([
      this.route.queryParams.pipe(distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))),
      this.typesenseAvailable$,
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([, available]) => available),
    ).subscribe(([params]) => {
      this.applyParams(params);
      this.executeSearch();
    });

    // Date filter subscriptions
    this.fromCtrl.valueChanges.pipe(
      takeUntil(this.destroy$), debounceTime(300),
    ).subscribe(() => this.onDateChange());
    this.toCtrl.valueChanges.pipe(
      takeUntil(this.destroy$), debounceTime(300),
    ).subscribe(() => this.onDateChange());
  }

  // ── Tab switching ─────────────────────────────────────────────────────────
  switchTab(tab: TableTab): void {
    const params: Params = {
      tab,
      keywords: this.searchQuery() || null,
      currentPage: 1,
      pageSize: null,
      sortBy: null,
    };
    // Clear old filter params
    const oldDef = SEARCH_TABLE_DEFS[this.activeTab()];
    for (const f of [...oldDef.filterList, ...oldDef.dateFilterList]) {
      params[f] = null;
    }
    this.activeRefinements.set({});
    this.fromCtrl.setValue('', { emitEvent: false });
    this.toCtrl.setValue('', { emitEvent: false });
    this.masterMaps = {};
    this.navigate(params);
  }

  // ── Search input ──────────────────────────────────────────────────────────
  onSearchInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.searchQuery.set(q);
    this.debounceSearch(q);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.navigate({ keywords: null, currentPage: 1 });
  }

  private searchDebounceTimer: any;
  private debounceSearch(q: string): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.navigate({ keywords: q || null, currentPage: 1 });
    }, 350);
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  toggleFacet(attribute: string): void {
    const next = new Set(this.collapsedFacets());
    if (next.has(attribute)) next.delete(attribute);
    else next.add(attribute);
    this.collapsedFacets.set(next);
  }

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem('filterSidebarCollapsed', String(next));
  }

  refineFacet(attribute: string, value: string): void {
    const refs = { ...this.activeRefinements() };
    if (!refs[attribute]) refs[attribute] = new Set();
    else refs[attribute] = new Set(refs[attribute]);

    if (refs[attribute].has(value)) {
      refs[attribute].delete(value);
    } else {
      refs[attribute].add(value);
    }
    this.activeRefinements.set(refs);

    const params: Params = { currentPage: 1 };
    params[attribute] = refs[attribute].size > 0
      ? Array.from(refs[attribute]).join(',')
      : null;
    this.navigate(params);
  }

  clearDateFilter(): void {
    this.fromCtrl.setValue('', { emitEvent: false });
    this.toCtrl.setValue('', { emitEvent: false });
    const def = this.activeDef();
    const params: Params = { currentPage: 1 };
    for (const d of def.dateFilterList) params[d] = null;
    this.navigate(params);
  }

  private onDateChange(): void {
    const def = this.activeDef();
    const fromDate = this.fromCtrl.value;
    const toDate   = this.toCtrl.value;
    const params: Params = { currentPage: 1 };
    if (def.dateFilterList.length >= 2) {
      params[def.dateFilterList[0]] = fromDate || null;
      params[def.dateFilterList[1]] = toDate   || null;
    }
    this.navigate(params);
  }

  // ── Table events ──────────────────────────────────────────────────────────
  onTableMessage(msg: ITableMessage): void {
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
        params['sortBy'] = this.toggleSort(msg.data);
        params['currentPage'] = 1;
        break;
    }
    this.navigate(params);
  }

  private toggleSort(field: string): string {
    const current = this.tableData().sortBy;
    if (current?.includes(field)) {
      return (current[0] === '+' ? '-' : '+') + field;
    }
    return '+' + field;
  }

  // ── URL param management ─────────────────────────────────────────────────

  private navigate(partialParams: Params): void {
    const current = this.route.snapshot.queryParams;
    this.router.navigate([], {
      queryParams: { ...current, ...partialParams },
      relativeTo: this.route,
      queryParamsHandling: 'merge',
    });
  }

  private applyParams(params: Params): void {
    // Tab
    const tab = params['tab'];
    if (tab && TABLE_TABS.some(t => t.id === tab)) {
      this.activeTab.set(tab as TableTab);
    }

    // Keywords
    this.searchQuery.set(params['keywords'] || '');

    // Facet refinements
    const def = SEARCH_TABLE_DEFS[this.activeTab()];
    const refs: Record<string, Set<string>> = {};
    for (const attr of def.filterList) {
      if (params[attr]) {
        refs[attr] = new Set(params[attr].split(','));
      }
    }
    this.activeRefinements.set(refs);

    // Date filters
    if (def.dateFilterList.length >= 2) {
      this.fromCtrl.setValue(params[def.dateFilterList[0]] || '', { emitEvent: false });
      this.toCtrl.setValue(params[def.dateFilterList[1]] || '', { emitEvent: false });
    }
  }

  // ── Typesense search ──────────────────────────────────────────────────────

  private executeSearch(): void {
    const colId = this.activeCollectionId();
    if (!colId) return;

    // Notifications use eagle-api (documents pre-joined); all other tabs use Typesense
    if (colId === 'notifications') {
      this.executeNotificationSearch();
      return;
    }

    if (!this.typesenseAvailable()) return;

    const col    = COLLECTIONS[colId];
    const def    = this.activeDef();
    const params = this.route.snapshot.queryParams;

    const page     = +(params['currentPage'] || 1);
    const pageSize = +(params['pageSize'] || 25);
    const sortBy   = params['sortBy'] || def.defaultSort;

    // Build Typesense sort_by
    const tsSortBy = this.urlSortToTypesense(sortBy, def);

    // Build filter_by from active refinements + date
    const filterParts: string[] = [];
    const refs = this.activeRefinements();
    for (const [attr, values] of Object.entries(refs)) {
      if (values.size > 0) {
        const vals = Array.from(values).map(v => '`' + v + '`').join(',');
        filterParts.push(`${attr}:=[${vals}]`);
      }
    }

    // Date filters
    const dateFacet = col.dateFacet;
    if (dateFacet && def.dateFilterList.length >= 2) {
      const from = params[def.dateFilterList[0]];
      const to   = params[def.dateFilterList[1]];
      if (from) filterParts.push(`${dateFacet.field}:>=${isoToUnixTimestamp(from)}`);
      if (to)   filterParts.push(`${dateFacet.field}:<=${isoToUnixTimestamp(to, true)}`);
    }

    // Build facet_by
    const facetBy = col.facets.map(f => f.attribute).join(',');

    const searchParams: Record<string, string> = {
      q:          this.searchQuery() || '*',
      query_by:   col.queryBy,
      page:       String(page),
      per_page:   String(pageSize),
      facet_by:   facetBy,
      max_facet_values: '100',
    };
    if (col.queryByWeights) searchParams['query_by_weights'] = col.queryByWeights;
    if (tsSortBy) searchParams['sort_by'] = tsSortBy;
    if (filterParts.length) searchParams['filter_by'] = filterParts.join(' && ');

    this.loading.set(true);

    this.typesenseService.searchCollection(colId, searchParams).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: res => {
        this.loading.set(false);
        this.filtersLoaded.set(true);
        this.totalFound.set(res.found ?? 0);
        this.procMs.set(res.search_time_ms ?? 0);
        this.updateTable(res, page, pageSize, sortBy, def, colId);
        this.updateFacets(res.facet_counts ?? [], colId);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private async executeNotificationSearch(): Promise<void> {
    this.loading.set(true);
    try {
      const def    = this.activeDef();
      const params = this.route.snapshot.queryParams;

      const result = await lastValueFrom(
        this.notificationService.search(
          this.searchQuery() || '',
          this.activeRefinements(),
          {
            fromKey: def.dateFilterList[0] || undefined,
            toKey:   def.dateFilterList[1] || undefined,
            params:  params as Record<string, string>,
          },
        )
      );

      this.notificationItems.set(result.items);
      this.totalFound.set(result.totalCount);
      this.facetItems.set(result.facets);
      this.groupedFacets.set({});
    } catch {
      this.notificationItems.set([]);
      this.totalFound.set(0);
    } finally {
      this.loading.set(false);
      this.filtersLoaded.set(true);
    }
  }

  private updateTable(
    res: any, page: number, pageSize: number, sortBy: string,
    def: any, colId: CollectionId,
  ): void {
    const tab = this.activeTab();
    const items = (res.hits ?? []).map((hit: any) => ({
      rowData: this.mapHit(hit, colId),
    }));

    const td = new TableObject({
      component: ROW_COMPONENTS[tab],
      currentPage: page,
      pageSize: pageSize,
      sortBy: sortBy,
      columns: def.columns,
    });
    td.totalListItems = res.found ?? 0;
    td.items = items;
    td.pageSizeOptions = [
      { displayText: '10', value: 10 },
      { displayText: '25', value: 25 },
      { displayText: '50', value: 50 },
      { displayText: '100', value: 100 },
    ];
    td.options = {
      showHeader: tab !== 'notifications',
      showPagination: true,
      showPageSizePicker: true,
      showPageCountDisplay: true,
      showTopControls: false,
      showAllPicker: (res.found ?? 0) <= 250,
      disableRowHighlight: tab !== 'projects',
      rowSpacing: tab === 'notifications' ? 25 : 0,
    };

    this.tableData.set(td);
  }

  private mapHit(hit: any, colId: CollectionId): any {
    const d = hit.document;
    switch (colId) {
      case 'projects':
        return {
          _id:              d.id,
          name:             d.name,
          proponent:        d.proponent,
          type:             d.type,
          region:           d.region,
          currentPhaseName: d.currentPhaseName,
          eacDecision:      d.eacDecision,
        };
      case 'documents':
        return {
          _id:              d.id,
          displayName:      d.displayName,
          projectId:        d.projectId,
          projectName:      d.projectName,
          _datePosted:      d.datePosted ? new Date(d.datePosted * 1000) : null,
          type:             d.type,
          milestone:        d.milestone,
          documentFileName: d.documentFileName,
        };
      case 'activities':
        return {
          _id:         d.id,
          headline:    d.headline,
          projectId:   d.projectId,
          projectName: d.projectName,
          type:        d.type,
          _dateAdded:  d.dateAdded ? new Date(d.dateAdded * 1000) : null,
        };
      default:
        return d;
    }
  }

  private updateFacets(facetCounts: any[], colId: CollectionId): void {
    const col = COLLECTIONS[colId];
    const refs = this.activeRefinements();
    const items: Record<string, DisplayItem[]> = {};
    const grouped: Record<string, LegislationGroup[]> = {};

    for (const fc of facetCounts) {
      const attr = fc.field_name;
      const facetDef = col.facets.find(f => f.attribute === attr);
      if (!facetDef) continue;

      const newItems = (fc.counts ?? []).map((c: any) => ({
        label: c.value,
        count: c.count,
        isRefined: refs[attr]?.has(c.value) ?? false,
      }));

      if (!this.masterMaps[attr]) this.masterMaps[attr] = new Map();
      const merged = mergeItems(this.masterMaps[attr], newItems, facetDef.sorter);
      items[attr] = merged;

      if (facetDef.grouped && facetDef.listType) {
        const lookup = this.lawLookups[facetDef.listType] ?? new Map();
        grouped[attr] = groupByLegislation(merged, lookup, facetDef.sorter);
      }
    }

    this.facetItems.set(items);
    this.groupedFacets.set(grouped);
  }

  private buildLawLookups(): void {
    const lists = this.configService.lists;
    lists.pipe(takeUntil(this.destroy$)).subscribe(allLists => {
      const lookups: Record<string, Map<string, number>> = {};
      for (const item of allLists) {
        if (item.legislation && item.name) {
          if (!lookups[item.type]) lookups[item.type] = new Map();
          lookups[item.type].set(item.name, item.legislation);
        }
      }
      this.lawLookups = lookups;
    });
  }

  // ── Sort conversion ──────────────────────────────────────────────────────

  /** Converts URL sort format (+field / -field) to Typesense (field:asc / field:desc) */
  private urlSortToTypesense(urlSort: string, def: any): string {
    if (!urlSort) return '';
    const dir = urlSort.charAt(0) === '-' ? 'desc' : 'asc';
    const rawField = urlSort.charAt(0) === '+' || urlSort.charAt(0) === '-' ? urlSort.slice(1) : urlSort;
    const tsField = def.sortFieldMap[rawField] || rawField;

    // For text search with keywords, prepend text match relevance
    if (this.searchQuery() && this.searchQuery() !== '*') {
      return `_text_match:desc,${tsField}:${dir}`;
    }
    return `${tsField}:${dir}`;
  }

  // offsetTop = layout distance from body top; stable without waiting for paint.
  private setSidebarMaxHeight(): void {
    const el = this.sidebarRef?.nativeElement;
    if (!el) return;
    document.documentElement.style.setProperty(
      '--sidebar-max-h',
      `${Math.max(100, window.innerHeight - el.offsetTop - 16)}px`,
    );
  }

  ngAfterViewInit(): void {
    this.setSidebarMaxHeight();
    this.resizeObserver = new ResizeObserver(() => this.setSidebarMaxHeight());
    this.resizeObserver.observe(document.documentElement);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.searchDebounceTimer);
    this.resizeObserver?.disconnect();
    document.documentElement.style.removeProperty('--sidebar-max-h');
  }
}
