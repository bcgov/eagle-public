/**
 * TypesenseSearchEngine — framework-agnostic class that encapsulates a single
 * instantsearch.js session backed by a Typesense collection.
 *
 * Both TypesenseDocumentTableComponent (project detail tabs) and
 * UnifiedSearchComponent (global /search page) create one instance per active
 * collection.  All IS.js state is exposed as Angular signals so templates can
 * bind directly.
 */

import { signal, WritableSignal, DestroyRef, NgZone } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import instantsearch from 'instantsearch.js';
import { configure } from 'instantsearch.js/es/widgets';
import {
  connectInfiniteHits,
  connectRefinementList,
  connectSearchBox,
  connectStats,
} from 'instantsearch.js/es/connectors';
import {
  COLLECTIONS,
  mergeItems,
  isoToUnixTimestamp,
  type CollectionId,
  type FacetDef,
  type DisplayItem,
} from '../search-collections';
import type { TypesenseService } from 'app/services/typesense.service';

// ── Public config ─────────────────────────────────────────────────────────────

/** Callbacks fired by the engine — callers use these for analytics, etc. */
export interface SearchEngineCallbacks {
  /** Fired after each completed search (not on load-more or filter-only) */
  onSearchPerformed?: (query: string, nbHits: number, procMs: number) => void;
}

export interface SearchEngineConfig {
  /** Collection to search */
  collectionId: CollectionId;
  /**
   * Facets for this instance.  May be a subset of COLLECTIONS[id].facets —
   * e.g. project-detail tabs only show facets relevant to their document subset.
   */
  facets: readonly FacetDef[];
  /**
   * Pre-created Typesense search client.  The caller decides whether to use the
   * standard client or the multi-search documents client.
   */
  searchClient: any;
  /**
   * Typesense filter string always appended to every query.
   * '' for global search; 'projectId:=X && ...' for project-detail tabs.
   *
   * CRITICAL: passed via configure({ filters }) — NOT via
   * additionalSearchParameters.filter_by.  The TypesenseInstantSearchAdapter
   * uses `_adaptFilters() || additionalSearchParameters.filter_by`; when any
   * widget-level facet is active, _adaptFilters() is non-empty and the ||
   * short-circuits, silently dropping filter_by.  Using configure() ensures the
   * static filter is always included.
   */
  staticFilter?: string;
  /**
   * Whether IS.js should escape HTML in hit values.
   * false → raw <mark> tags flow through for [innerHTML] highlight rendering.
   * Default: true (safe for most uses; set false for unified-search doc tabs).
   */
  escapeHTML?: boolean;
  /** When true, fires a document_chunks multi_search after each query >= 3 chars
   *  and updates TypesenseService._contentSnippets for SearchDocumentCardComponent.
   *  Use for the 'documents' collection only. */
  enableContentSnippets?: boolean;
  /** Query to pre-populate via initialUiState on the first IS.js start(). */
  initialQuery?: string;
  /** Callbacks for analytics / side effects */
  callbacks?: SearchEngineCallbacks;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class TypesenseSearchEngine {

  // ── Signals (template binds directly) ──────────────────────────────────────
  readonly hits          = signal<any[]>([]);
  readonly isLoading     = signal(true);
  readonly isLoadingMore = signal(false);
  readonly hasSearched   = signal(false);
  readonly hasError      = signal(false);
  readonly filtersLoaded = signal(false);
  readonly nbHits        = signal(0);
  readonly procMs        = signal(0);
  readonly hasDateFilter = signal(false);

  /** Per-facet display items (merged IS.js items + master-map to preserve disabled count) */
  readonly facetItems: Record<string, WritableSignal<DisplayItem[]>> = {};
  /**
   * Per-facet master maps (label → DisplayItem).  Persists across IS.js
   * renders so items with count=0 remain visible as disabled rather than
   * disappearing entirely.
   */
  readonly masterMaps: Record<string, Map<string, DisplayItem>> = {};
  /** Per-facet refine functions wired up by connectRefinementList */
  readonly refineFns:  Record<string, (v: string) => void> = {};
  /** Per-facet legislation-year lookup (populated by caller via updateLegislationLookups()) */
  readonly lawLookups: Record<string, WritableSignal<Map<string, number>>> = {};

  /** Date range controls — bind [control]="engine.fromCtrl" in the template */
  readonly fromCtrl = new FormControl<string | null>('');
  readonly toCtrl   = new FormControl<string | null>('');

  // ── Private IS.js state ────────────────────────────────────────────────────
  private is:              ReturnType<typeof instantsearch> | null = null;
  private searchBoxRefine: ((q: string) => void) | null = null;
  private showMoreFn:      (() => void) | null = null;
  private configureWidget: any = null;
  private observer:        IntersectionObserver | null = null;
  private dateSubs:        Subscription[] = [];
  /**
   * Query that was most recently handed to IS.js (either via initialUiState or
   * search()).  The hits callback compares its result query to this to guard
   * against stale IS.js renders that would flash "No results" mid-search.
   */
  private lastRefinedQuery = '';

  constructor(
    private readonly config: SearchEngineConfig,
    private readonly typesense: TypesenseService,
    private readonly zone: NgZone,
  ) {
    for (const f of config.facets) {
      this.facetItems[f.attribute] = signal<DisplayItem[]>([]);
      this.masterMaps[f.attribute] = new Map();
      this.refineFns[f.attribute]  = (_: string) => { /* noop until IS.js init */ };
      this.lawLookups[f.attribute] = signal(new Map<string, number>());
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Start the instantsearch session.  Must be called once, inside (or after)
   * Angular's injection context so that takeUntilDestroyed(destroyRef) works.
   */
  init(destroyRef: DestroyRef): void {
    const col          = COLLECTIONS[this.config.collectionId];
    const facets       = this.config.facets;
    const staticFilter = this.config.staticFilter ?? '';
    const escapeHTML   = this.config.escapeHTML ?? true;
    const initialQ     = this.config.initialQuery ?? '';

    this.is = instantsearch({
      searchClient: this.config.searchClient,
      indexName: col.indexName,
      ...(initialQ ? { initialUiState: { [col.indexName]: { query: initialQ } } } : {}),
    });
    this.lastRefinedQuery = initialQ;
    this.isLoading.set(true);

    // ── Connectors ───────────────────────────────────────────────────────────
    const customSearchBox = connectSearchBox((rs: any) => {
      this.searchBoxRefine = rs.refine;
    });

    const customStats = connectStats((rs: any) => {
      this.zone.run(() => {
        this.nbHits.set(rs.nbHits ?? 0);
        this.procMs.set(rs.processingTimeMS ?? 0);
      });
    });

    const customHits = connectInfiniteHits((rs: any) => {
      if (rs.results == null) {
        // IS.js called back before the first response — serve from cache.
        const cached = this.typesense.getLastHits(col.indexName);
        if (cached.length > 0) {
          this.zone.run(() => { this.hits.set(cached); this.isLoading.set(false); });
        }
        return;
      }
      // Guard against stale/transitional IS.js renders: when a new query starts,
      // IS.js fires the connector with the OLD rs.results but rs.hits=[] for the
      // new query.  Without this guard that clears hits and sets isLoading=false
      // prematurely — causing a "No results found" flash.
      const rawQ  = (rs.results?.query as string) ?? '';
      const normQ = rawQ === '*' ? '' : rawQ;
      if (normQ !== this.lastRefinedQuery) return;

      this.zone.run(() => {
        // Deduplicate: chunk-only results can appear multiple times when IS.js
        // fires search() repeatedly (documents multi-search).
        const seen = new Set<string>();
        const uniqueHits = rs.hits.filter((h: any) => {
          const key = h.objectID ?? h.id;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        this.typesense.setLastHits(col.indexName, uniqueHits);
        this.hits.set(uniqueHits);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
        this.hasSearched.set(true);
        this.hasError.set(false);
        this.showMoreFn = rs.isLastPage ? null : rs.showMore;

        const nb = (rs.results?.nbHits as number) ?? 0;
        const ms = (rs.results?.processingTimeMS as number) ?? 0;
        this.config.callbacks?.onSearchPerformed?.(normQ, nb, ms);

        // Fetch PDF content snippets — fire-and-forget, updates _contentSnippets signal
        if (this.config.enableContentSnippets && normQ.length >= 3) {
          const ids = uniqueHits.map((h: any) => h.objectID ?? h.id ?? '').filter(Boolean);
          if (ids.length) void this.typesense.fetchChunkSnippets(normQ, ids);
        }
      });
    });

    const widgets: any[] = [customSearchBox({}), customStats({}), customHits({ escapeHTML })];

    // ── Facet refinement lists ────────────────────────────────────────────────
    for (const f of facets) {
      // Pre-populate facet items from cache so the sidebar renders immediately on
      // tab switch without waiting for IS.js's first response.
      const cached = this.typesense.getLastFacets(col.indexName, f.attribute);
      if (cached.length > 0) {
        this.facetItems[f.attribute].set(mergeItems(this.masterMaps[f.attribute], cached, f.sorter));
      }
      widgets.push(
        connectRefinementList((rs: any) => {
          this.refineFns[f.attribute] = rs.refine;
          this.zone.run(() => {
            // Skip item merge only on init when IS.js returns 0 items but cache
            // already populated the master map.  Always run zone.run() so Angular
            // detects the refineFns update and the filtersLoaded flip.
            if (rs.items.length > 0 || this.masterMaps[f.attribute].size === 0) {
              this.facetItems[f.attribute].set(
                mergeItems(this.masterMaps[f.attribute], rs.items, f.sorter));
              this.typesense.setLastFacets(col.indexName, f.attribute, rs.items);
            }
            this.filtersLoaded.set(true);
          });
        })({ attribute: f.attribute, operator: f.operator, limit: f.limit })
      );
    }

    // ── Configure widget (static filter + hitsPerPage) ────────────────────────
    this.configureWidget = configure({
      hitsPerPage: col.hitsPerPage,
      ...(staticFilter ? { filters: staticFilter } : {}),
    });
    widgets.push(this.configureWidget);

    // Clear stale hits before starting so a previous context doesn't bleed in.
    this.typesense.setLastHits(col.indexName, []);
    this.is.addWidgets(widgets);
    this.is.start();

    this.is.on('error', () => {
      this.zone.run(() => { this.isLoading.set(false); this.hasError.set(true); });
    });

    // ── Date filter subscriptions ─────────────────────────────────────────────
    if (col.dateFacet) {
      const onDateChange = (_filterType: 'from' | 'to') => (_v: string | null) => {
        this.hasDateFilter.set(!!(this.fromCtrl.value || this.toCtrl.value));
        this.applyDateFilter();
      };
      this.dateSubs.push(
        this.fromCtrl.valueChanges
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(onDateChange('from')),
        this.toCtrl.valueChanges
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(onDateChange('to')),
      );
    }
  }

  dispose(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.is?.dispose();
    this.is = null;
    this.searchBoxRefine = null;
    this.showMoreFn = null;
    this.dateSubs.forEach(s => s.unsubscribe());
    this.dateSubs = [];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * The last query string handed to IS.js.  Read by the parent component's
   * query-driving effect to avoid re-firing the same search after a tab switch
   * (the engine was just created with this query as initialQuery).
   */
  get lastQuery(): string { return this.lastRefinedQuery; }

  /** Drive the IS.js search box to the given query string. */
  search(query: string): void {
    this.lastRefinedQuery = query === '' ? '' : query;
    this.searchBoxRefine?.(query || '');
  }

  /** Toggle a facet refinement value (IS.js `refine` call). */
  refine(attribute: string, value: string): void {
    this.refineFns[attribute]?.(value);
  }

  /** Load the next page (infinite scroll trigger). */
  showMore(): void {
    if (this.showMoreFn) {
      this.isLoadingMore.set(true);
      this.showMoreFn();
    }
  }

  /** Clear both date controls (triggers subscription → applyDateFilter). */
  clearDateFilter(): void {
    this.fromCtrl.setValue('');
    this.toCtrl.setValue('');
  }

  /**
   * Refresh legislation-year lookups from the ConfigService lists payload.
   * Call whenever configService.lists emits so grouped facet labels stay current.
   */
  updateLegislationLookups(lists: any[]): void {
    for (const f of this.config.facets) {
      if (!f.listType) continue;
      const m = new Map<string, number>();
      lists
        .filter((l: any) => l.type === f.listType)
        .forEach((l: any) => m.set(l.name, l.legislation || 0));
      this.lawLookups[f.attribute].set(m);
    }
  }

  /**
   * Wire the infinite-scroll sentinel element.  Call whenever ViewChild resolves
   * or the results column mounts.
   *
   * @param sentinel   The element to observe (placed below the last card).
   * @param root       Scroll container root (pass resultsColEl when the column
   *                   itself scrolls; omit to fall back to viewport).
   */
  setupObserver(sentinel: HTMLElement, root?: HTMLElement | null): void {
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && this.showMoreFn) {
          this.isLoadingMore.set(true);
          this.showMoreFn();
        }
      },
      { root: root ?? null, rootMargin: '200px' },
    );
    this.observer.observe(sentinel);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private applyDateFilter(): void {
    if (!this.is || !this.configureWidget) return;
    const col          = COLLECTIONS[this.config.collectionId];
    if (!col.dateFacet) return;
    const staticFilter = this.config.staticFilter ?? '';
    const from = this.fromCtrl.value, to = this.toCtrl.value;
    const nf: string[] = [];
    if (from) nf.push(`${col.dateFacet.field}>=${isoToUnixTimestamp(from)}`);
    if (to)   nf.push(`${col.dateFacet.field}<=${isoToUnixTimestamp(to, true)}`);
    this.is.removeWidgets([this.configureWidget]);
    this.configureWidget = configure({
      hitsPerPage: col.hitsPerPage,
      ...(staticFilter ? { filters: staticFilter } : {}),
      ...(nf.length ? { numericFilters: nf } : {}),
    });
    this.is.addWidgets([this.configureWidget]);
  }
}
