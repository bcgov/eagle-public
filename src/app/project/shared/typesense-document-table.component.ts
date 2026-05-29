import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  NgZone,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  input,
  DestroyRef,
} from '@angular/core';
import { Subject, from, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { TypesenseService } from '../../services/typesense.service';
import { ConfigService } from '../../services/config.service';
import { SearchFilterSidebarComponent } from '../../search/filter-sidebar/search-filter-sidebar.component';
import { SearchResultsListComponent } from '../../search/results-list/search-results-list.component';
import { TypesenseSearchEngine } from '../../search/engine/typesense-search-engine';
import {
  COLLECTIONS,
  LegislationGroup,
  groupByLegislation,
  TAB_FILTER_BY,
  TAB_FACETS,
  FacetDef,
  buildAdapterParams,
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
    SearchFilterSidebarComponent,
    SearchResultsListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypesenseDocumentTableComponent implements OnInit, OnDestroy {
  private readonly analytics     = inject(AnalyticsService);
  private readonly typesense     = inject(TypesenseService);
  private readonly configService = inject(ConfigService);
  private readonly zone          = inject(NgZone);
  private readonly destroyRef    = inject(DestroyRef);
  private readonly cdr           = inject(ChangeDetectorRef);

  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly projId = input.required<string>();
  readonly tabKey = input.required<DocTabKey>();

  // ── Sidebar / accordion UI state (component owns, engine doesn't) ────────────
  sidebarCollapsed = signal(false);
  filtersOpen      = signal(false);
  collapsedFacets  = signal<Set<string>>(new Set());

  // ── Keyword search state ─────────────────────────────────────────────────────
  keywords = signal('');
  private keywordInput$ = new Subject<string>();

  // ── Tab config (set in ngOnInit) ─────────────────────────────────────────────
  cfg!: TabConfig;

  // Expose for template binding
  readonly COLLECTIONS = COLLECTIONS;

  // ── Engine (created once health check passes) ────────────────────────────────
  engine!: TypesenseSearchEngine;

  // ── Computed: grouped facet snapshot for legislation facets ─────────────────
  groupedSnapshot = computed((): Record<string, LegislationGroup[]> => {
    if (!this.engine) return {};
    const snap: Record<string, LegislationGroup[]> = {};
    for (const f of this.cfg?.facets ?? []) {
      snap[f.attribute] = f.grouped
        ? groupByLegislation(
            this.engine.facetItems[f.attribute]?.() ?? [],
            this.engine.lawLookups[f.attribute]?.() ?? new Map(),
            f.sorter,
          )
        : [];
    }
    return snap;
  });

  // ── Computed: flat facet snapshot for sidebar binding ────────────────────────
  facetSnapshot = computed((): Record<string, any[]> => {
    if (!this.engine) return {};
    const snap: Record<string, any[]> = {};
    for (const f of this.cfg?.facets ?? []) {
      snap[f.attribute] = this.engine.facetItems[f.attribute]?.() ?? [];
    }
    return snap;
  });

  // ── Computed: active filter count for badge ──────────────────────────────────
  activeFilterCount = computed(() => {
    if (!this.engine) return 0;
    let count = 0;
    for (const f of this.cfg?.facets ?? []) {
      count += (this.engine.facetItems[f.attribute]?.() ?? []).filter(i => i.isRefined).length;
    }
    if (this.engine.fromCtrl.value || this.engine.toCtrl.value) count++;
    return count;
  });

  // ── ViewChild: sentinel for infinite scroll ──────────────────────────────────
  private resultsColEl: HTMLElement | null = null;

  @ViewChild('tsSentinel')
  set tsSentinel(el: ElementRef | undefined) {
    if (el?.nativeElement) {
      this.engine?.setupObserver(el.nativeElement, this.resultsColEl ?? undefined);
    }
  }

  @ViewChild('tsResultsCol')
  set tsResultsCol(el: ElementRef | undefined) {
    this.resultsColEl = el?.nativeElement ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cfg = TAB_CONFIG[this.tabKey()];
    this.sidebarCollapsed.set(localStorage.getItem(this.cfg.localStorageKey) === 'true');

    // Keyword debounce pipeline
    this.keywordInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(kw => this.engine?.search(kw || ''));

    // Health-check + lists run in parallel.
    combineLatest([
      from(this.typesense.checkHealth()),
      this.configService.lists.pipe(take(1)),
    ]).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(([healthy, lists]) => {
      if (!healthy) return;
      this.startEngine(lists);
    });
  }

  ngOnDestroy(): void {
    this.engine?.dispose();
  }

  // ── Sidebar interactions ─────────────────────────────────────────────────────

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem(this.cfg.localStorageKey, String(next));
  }

  toggleFacet(attribute: string): void {
    const next = new Set(this.collapsedFacets());
    if (next.has(attribute)) next.delete(attribute);
    else next.add(attribute);
    this.collapsedFacets.set(next);
  }

  // ── Search box ───────────────────────────────────────────────────────────────

  onTsInput(event: Event): void {
    const kw = (event.target as HTMLInputElement).value;
    this.keywords.set(kw);
    this.keywordInput$.next(kw);
  }

  clearTsSearch(): void {
    this.keywords.set('');
    this.engine?.search('');
  }

  // ── Analytics ────────────────────────────────────────────────────────────────

  onDownloadClicked(hit: any): void {
    this.analytics.track(`${this.cfg.analyticsPrefix} Downloaded`, {
      document_id:   hit['id'] ?? hit['objectID'],
      document_name: hit['displayName'],
      project_id:    this.projId(),
    });
  }

  // ── Private: engine init ─────────────────────────────────────────────────────

  private startEngine(lists: any[]): void {
    const col    = COLLECTIONS.documents;
    const cfg    = this.cfg;
    const projId = this.projId();
    const facets: readonly FacetDef[] = cfg.facets;

    const baseFilter   = `projectId:=${projId}`;
    const staticFilter = cfg.extraFilter
      ? `${baseFilter} && ${cfg.extraFilter}`
      : baseFilter;

    this.engine = new TypesenseSearchEngine(
      {
        collectionId: 'documents',
        facets,
        searchClient: this.typesense.getSearchClient(buildAdapterParams(col)),
        escapeHTML: false,
        enableContentSnippets: true,
        staticFilter,
        callbacks: {
          onSearchPerformed: (query, nbHits) => {
            this.analytics.track(`${cfg.analyticsPrefix} Search Performed`, {
              query,
              project_id: projId,
              nb_hits:    nbHits,
            });
          },
        },
      },
      this.typesense,
      this.zone,
    );

    // Populate legislation lookups from the initial lists emission
    this.engine.updateLegislationLookups(lists);

    // Notify OnPush tree that engine is now available
    this.cdr.markForCheck();

    this.engine.init(this.destroyRef);

    // Keep legislation lookups fresh on subsequent list updates
    this.configService.lists
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updatedLists => this.engine.updateLegislationLookups(updatedLists));
  }
}
