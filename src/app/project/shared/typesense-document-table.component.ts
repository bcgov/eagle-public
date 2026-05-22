import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
  NgZone,
  ViewChild,
  ElementRef,
  WritableSignal,
  OnInit,
  OnDestroy,
  input,
  DestroyRef,
} from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, from, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import instantsearch from 'instantsearch.js';
import { configure } from 'instantsearch.js/es/widgets';
import {
  connectInfiniteHits,
  connectRefinementList,
  connectSearchBox,
  connectStats,
} from 'instantsearch.js/es/connectors';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { TypesenseService } from '../../services/typesense.service';
import { ConfigService } from '../../services/config.service';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { TableObject } from '../../shared/components/table-template/table-object';
import { ProjectDocTableRowsComponent } from './project-doc-table-rows.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import {
  COLLECTIONS,
  DisplayItem,
  LegislationGroup,
  mergeItems,
  groupByLegislation,
  isoToUnixTimestamp,
  TAB_FILTER_BY,
  TAB_FACETS,
  FacetDef,
} from '../../search/search-collections';

// ── Per-tab static configuration ─────────────────────────────────────────────

export type DocTabKey = 'documents' | 'application' | 'certificate' | 'amendment';

interface TabConfig {
  readonly facets: readonly FacetDef[];
  readonly extraFilter: string | null;
  readonly analyticsPrefix: string;
  readonly localStorageKey: string;
  readonly searchPlaceholder: string;
  readonly filterAriaLabel: string;
  readonly emptyMessage: string;
}

const TAB_CONFIG: Record<DocTabKey, TabConfig> = {
  documents: {
    facets: TAB_FACETS['documents'],
    extraFilter: null,
    analyticsPrefix: 'Document',
    localStorageKey: 'docTabSidebarCollapsed',
    searchPlaceholder: 'Search documents…',
    filterAriaLabel: 'Document filters',
    emptyMessage: 'No results found.',
  },
  application: {
    facets: TAB_FACETS['application'],
    extraFilter: TAB_FILTER_BY['application'],
    analyticsPrefix: 'Application Document',
    localStorageKey: 'appTabSidebarCollapsed',
    searchPlaceholder: 'Search application documents…',
    filterAriaLabel: 'Application document filters',
    emptyMessage: 'No application documents found.',
  },
  certificate: {
    facets: TAB_FACETS['certificate'],
    extraFilter: TAB_FILTER_BY['certificate'],
    analyticsPrefix: 'Certificate Document',
    localStorageKey: 'certTabSidebarCollapsed',
    searchPlaceholder: 'Search certificate documents…',
    filterAriaLabel: 'Certificate document filters',
    emptyMessage: 'No certificate documents found.',
  },
  amendment: {
    facets: TAB_FACETS['amendment'],
    extraFilter: TAB_FILTER_BY['amendment'],
    analyticsPrefix: 'Amendment Document',
    localStorageKey: 'amendTabSidebarCollapsed',
    searchPlaceholder: 'Search amendment documents…',
    filterAriaLabel: 'Amendment document filters',
    emptyMessage: 'No amendment documents found.',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-typesense-document-table',
  templateUrl: './typesense-document-table.component.html',
  styleUrls: ['./typesense-document-table.component.css'],
  imports: [
    TableTemplateComponent,
    DatePickerComponent,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('sidebar', [
      state('open',      style({ width: '250px', minWidth: '250px', marginRight: '1.5rem', paddingRight: '0.75rem' })),
      state('collapsed', style({ width: '0',     minWidth: '0',     marginRight: '0',       paddingRight: '0'       })),
      transition('open <=> collapsed', animate('250ms cubic-bezier(0.4, 0, 0.2, 1)')),
    ]),
  ],
})
export class TypesenseDocumentTableComponent implements OnInit, OnDestroy {
  private readonly analytics    = inject(AnalyticsService);
  private readonly typesense    = inject(TypesenseService);
  private readonly configService = inject(ConfigService);
  private readonly zone          = inject(NgZone);
  private readonly destroyRef    = inject(DestroyRef);

  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly projId = input.required<string>();
  readonly tabKey = input.required<DocTabKey>();

  // ── State: signals ──────────────────────────────────────────────────────────
  tsHits          = signal<any[]>([]);
  tsLoading       = signal(true);
  tsLoadingMore   = signal(false);
  tsHasSearched   = signal(false);
  tsHasError      = signal(false);
  tsNbHits        = signal(0);
  tsProcMs        = signal(0);
  tsFiltersLoaded = signal(false);
  tsHasDateFilter = signal(false);
  tsFiltersOpen   = signal(false);
  tsKeywords      = signal('');

  tsFromCtrl = new FormControl<string | null>('');
  tsToCtrl   = new FormControl<string | null>('');

  // Initialized in ngOnInit after tabKey input is available
  cfg!: TabConfig;
  tsFacets: readonly FacetDef[] = [];
  sidebarCollapsed = signal(false); // overwritten in ngOnInit with localStorage value

  tsFacetItems: Record<string, WritableSignal<DisplayItem[]>>        = {};
  private tsMasterMaps: Record<string, Map<string, DisplayItem>>     = {};
  tsRefineFns:  Record<string, (v: string) => void>                  = {};
  tsLawLookups: Record<string, WritableSignal<Map<string, number>>>  = {};

  tsGroupedSnapshot = computed((): Record<string, LegislationGroup[]> => {
    const snap: Record<string, LegislationGroup[]> = {};
    for (const f of this.tsFacets) {
      snap[f.attribute] = f.grouped
        ? groupByLegislation(
            this.tsFacetItems[f.attribute]?.() ?? [],
            this.tsLawLookups[f.attribute]?.() ?? new Map(),
            f.sorter
          )
        : [];
    }
    return snap;
  });

  private readonly DOC_COLUMNS = [
    { name: 'Document Name', value: 'displayName', width: 'col-4'                },
    { name: 'Date',          value: 'datePosted',  width: 'col-2', nosort: true },
    { name: 'Type',          value: 'type',        width: 'col-2', nosort: true },
    { name: 'Milestone',     value: 'milestone',   width: 'col-2', nosort: true },
    { name: '',              value: 'download',    width: 'col-2', nosort: true },
  ] as const;

  tableDataObj = computed(() => new TableObject({
    component: ProjectDocTableRowsComponent,
    columns: [...this.DOC_COLUMNS],
    items: this.tsHits().map(hit => ({
      rowData: {
        _id:              hit['id'] ?? hit['objectID'],
        displayName:      hit['displayName'],
        _datePosted:      hit['datePosted'] ? new Date(hit['datePosted'] * 1000) : null,
        type:             hit['type'],
        milestone:        hit['milestone'],
        documentFileName: hit['documentFileName'],
      },
    })),
    options: {
      showHeader: true,
      showTopControls: false,
      showPagination: false,
      showPageSizePicker: false,
      showPageCountDisplay: false,
    },
    totalListItems: this.tsHits().length,
    currentPage: 1,
    pageSize: Math.max(this.tsHits().length, 1),
  }));

  activeFilterCount = computed(() => {
    let count = 0;
    for (const f of this.tsFacets) {
      count += (this.tsFacetItems[f.attribute]?.() ?? []).filter(i => i.isRefined).length;
    }
    if (this.tsFromCtrl.value || this.tsToCtrl.value) count++;
    return count;
  });

  readonly tsMinDate = new Date(1970, 0, 1);

  private tsShowMore: (() => void) | null = null;
  private tsSearchBoxRefine: ((q: string) => void) | null = null;
  private tsIs: ReturnType<typeof instantsearch> | null = null;
  private tsConfigWidget: any = null;
  private tsStaticFilter = '';
  private tsSentinelObserver: IntersectionObserver | null = null;
  private tsResultsColEl: HTMLElement | null = null;
  private tsKeywordInput$ = new Subject<string>();

  @ViewChild('tsSentinel')
  set tsSentinel(el: ElementRef | undefined) {
    if (el?.nativeElement) this.tsSetupObserver(el.nativeElement);
  }

  @ViewChild('tsResultsCol')
  set tsResultsCol(el: ElementRef | undefined) {
    this.tsResultsColEl = el?.nativeElement ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cfg = TAB_CONFIG[this.tabKey()];
    this.tsFacets = this.cfg.facets;
    this.sidebarCollapsed.set(localStorage.getItem(this.cfg.localStorageKey) === 'true');

    for (const f of this.tsFacets) {
      this.tsFacetItems[f.attribute] = signal<DisplayItem[]>([]);
      this.tsMasterMaps[f.attribute] = new Map();
      this.tsRefineFns[f.attribute]  = (_: string) => { /* noop until IS initialised */ };
      this.tsLawLookups[f.attribute] = signal(new Map<string, number>());
    }

    // Keyword debounce pipeline
    this.tsKeywordInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(kw => { this.tsSearchBoxRefine?.(kw || ''); });

    // Health-check and lists run in parallel.
    // checkHealth() is idempotent — returns cached result immediately on
    // subsequent calls, so navigating between tabs incurs no extra round-trip.
    combineLatest([
      from(this.typesense.checkHealth()),
      this.configService.lists.pipe(take(1)),
    ]).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(([healthy, lists]) => {
      if (!healthy) { this.tsLoading.set(false); return; }
      this.initCollection(lists);
    });
  }

  ngOnDestroy(): void {
    this.tsTeardown();
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem(this.cfg.localStorageKey, String(next));
  }

  // ── Typesense: init ──────────────────────────────────────────────────────────

  private initCollection(lists: any[]): void {
    const col = COLLECTIONS.documents;
    const cfg = this.cfg;
    const projId = this.projId();

    // Populate legislation lookup from lists metadata
    for (const f of this.tsFacets) {
      if (!f.listType) continue;
      const m = new Map<string, number>();
      lists.filter(l => l.type === f.listType).forEach(l => m.set(l.name, l.legislation || 0));
      this.tsLawLookups[f.attribute].set(m);
    }

    const baseFilter = `projectId:=${projId}`;
    this.tsStaticFilter = cfg.extraFilter ? `${baseFilter} && ${cfg.extraFilter}` : baseFilter;

    // NOTE: The static filter is passed via configure({ filters }) below, NOT via
    // additionalSearchParameters.filter_by. The TypesenseInstantSearchAdapter uses
    // "_adaptFilters() || additionalSearchParameters.filter_by" — if any widget-level
    // facet filter is active, _adaptFilters() is non-empty and the || short-circuits,
    // silently dropping the static filter_by (losing projectId and tab constraints).
    // Passing the filter via configure() ensures _adaptFilters() always includes it.
    this.tsIs = instantsearch({
      searchClient: this.typesense.getSearchClient({
        query_by:         col.queryBy,
        query_by_weights: col.queryByWeights,
      }),
      indexName: col.indexName,
    });

    const customSearchBox = connectSearchBox((rs: any) => {
      this.tsSearchBoxRefine = rs.refine;
    });

    const customStats = connectStats((rs: any) => {
      this.zone.run(() => {
        this.tsNbHits.set(rs.nbHits ?? 0);
        this.tsProcMs.set(rs.processingTimeMS ?? 0);
      });
    });

    const customHits = connectInfiniteHits((rs: any) => {
      if (rs.results == null) return;
      this.zone.run(() => {
        this.typesense.setLastHits(col.indexName, rs.hits);
        this.tsHits.set([...rs.hits]);
        this.tsLoading.set(false);
        this.tsLoadingMore.set(false);
        this.tsHasSearched.set(true);
        this.tsHasError.set(false);
        this.tsShowMore = rs.isLastPage ? null : rs.showMore;
        const rawQ = (rs.results?.query as string) ?? '';
        const normQ = rawQ === '*' ? '' : rawQ;
        this.analytics.track(`${cfg.analyticsPrefix} Search Performed`, {
          query: normQ,
          project_id: projId,
          nb_hits: (rs.results?.nbHits as number) ?? 0,
        });
      });
    });

    const widgets: any[] = [customSearchBox({}), customStats({}), customHits({})];

    for (const f of this.tsFacets) {
      widgets.push(
        connectRefinementList((rs: any) => {
          this.tsRefineFns[f.attribute] = rs.refine;
          if (rs.items.length === 0 && this.tsMasterMaps[f.attribute].size > 0) return;
          this.zone.run(() => {
            this.tsFacetItems[f.attribute].set(mergeItems(this.tsMasterMaps[f.attribute], rs.items, f.sorter));
            this.tsFiltersLoaded.set(true);
          });
        })({ attribute: f.attribute, operator: f.operator, limit: f.limit })
      );
    }

    this.tsConfigWidget = configure({ hitsPerPage: col.hitsPerPage, filters: this.tsStaticFilter });
    widgets.push(this.tsConfigWidget);
    this.tsIs.addWidgets(widgets);
    // Clear stale hits from other contexts before starting
    this.typesense.setLastHits(col.indexName, []);
    this.tsIs.start();

    this.tsIs.on('error', () => {
      this.zone.run(() => { this.tsLoading.set(false); this.tsHasError.set(true); });
    });

    // Date filter subscriptions
    const onDateChange = (filterType: 'from' | 'to') => (v: string | null) => {
      this.tsHasDateFilter.set(!!(this.tsFromCtrl.value || this.tsToCtrl.value));
      this.tsApplyDateFilter();
      if (v) this.analytics.track(`${cfg.analyticsPrefix} Date Filter Applied`, {
        filter_type: filterType, date_value: v, project_id: projId,
      });
    };
    this.tsFromCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(onDateChange('from'));
    this.tsToCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(onDateChange('to'));

    // Live legislation lookup updates (configService.lists can re-emit after the app starts)
    this.configService.lists.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updatedLists => {
      for (const f of this.tsFacets) {
        if (!f.listType) continue;
        const m = new Map<string, number>();
        updatedLists.filter((l: any) => l.type === f.listType).forEach((l: any) => m.set(l.name, l.legislation || 0));
        this.tsLawLookups[f.attribute].set(m);
      }
    });
  }

  private tsApplyDateFilter(): void {
    if (!this.tsIs || !this.tsConfigWidget) return;
    const col = COLLECTIONS.documents;
    const df = col.dateFacet;
    if (!df) return;
    const from = this.tsFromCtrl.value, to = this.tsToCtrl.value;
    const nf: string[] = [];
    if (from) nf.push(`${df.field}>=${isoToUnixTimestamp(from)}`);
    if (to)   nf.push(`${df.field}<=${isoToUnixTimestamp(to, true)}`);
    this.tsIs.removeWidgets([this.tsConfigWidget]);
    this.tsConfigWidget = configure({ hitsPerPage: col.hitsPerPage, filters: this.tsStaticFilter, ...(nf.length ? { numericFilters: nf } : {}) });
    this.tsIs.addWidgets([this.tsConfigWidget]);
  }

  private tsSetupObserver(sentinel: HTMLElement): void {
    this.tsSentinelObserver?.disconnect();
    this.tsSentinelObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && this.tsShowMore) {
        this.tsLoadingMore.set(true);
        this.tsShowMore();
      }
    }, { root: this.tsResultsColEl ?? null, rootMargin: '200px' });
    this.tsSentinelObserver.observe(sentinel);
  }

  private tsTeardown(): void {
    this.tsSentinelObserver?.disconnect();
    this.tsIs?.dispose();
    this.tsIs = null;
  }

  // ── Public handlers ──────────────────────────────────────────────────────────

  onTsInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.tsKeywords.set(value);
    this.tsKeywordInput$.next(value);
  }

  clearTsSearch(): void {
    this.tsKeywords.set('');
    this.tsKeywordInput$.next('');
  }

  refineTsFacet(attribute: string, label: string): void {
    this.tsRefineFns[attribute]?.(label);
    this.analytics.track(`${this.cfg.analyticsPrefix} Filter Applied`, {
      facet_attribute: attribute, facet_value: label, project_id: this.projId(),
    });
  }

  clearTsDateFilter(): void {
    this.tsFromCtrl.setValue('');
    this.tsToCtrl.setValue('');
  }
}
