import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject, signal, input, computed, effect,
  ViewChild, ElementRef, NgZone,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TypesenseService } from 'app/services/typesense.service';
import { ConfigService } from 'app/services/config.service';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { TypesenseSearchEngine } from './engine/typesense-search-engine';
import { SearchFilterSidebarComponent } from './filter-sidebar/search-filter-sidebar.component';
import { SearchResultsListComponent } from './results-list/search-results-list.component';
import {
  type CollectionId,
  type Tab,
  type DisplayItem,
  type LegislationGroup,
  COLLECTIONS,
  VALID_TABS,
  groupByLegislation,
  tabToCollectionId,
  buildAdapterParams,
} from './search-collections';
import { initTabArrows, TabArrowsHandle } from 'app/shared/utils/tab-arrows';

const TABS: { id: Tab; label: string }[] = [
  { id: 'projects',      label: 'Projects'              },
  { id: 'documents',     label: 'Documents'             },
  { id: 'updates',       label: 'Updates'               },
  { id: 'notifications', label: 'Project Notifications' },
];

@Component({
  selector: 'app-unified-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SearchFilterSidebarComponent,
    SearchResultsListComponent,
  ],
  template: `
    <!-- Tab bar -->
    <div class="tabs-container pt-3">
      <div class="container">
        <ul class="nav-tabs" role="tablist" aria-label="Search dataset tabs">
          @for (tab of tabs; track tab.id) {
            <li class="nav-item">
              <button
                class="nav-link"
                [class.active]="activeTab() === tab.id"
                role="tab"
                [attr.aria-selected]="activeTab() === tab.id"
                [id]="'search-tab-' + tab.id"
                [attr.aria-controls]="'search-panel-' + tab.id"
                (click)="switchTab(tab.id)"
              >{{ tab.label }}</button>
            </li>
          }
        </ul>
      </div>
    </div>

    <!-- Shared search bar -->
    <div class="container pt-3 pb-0">
      <div class="ais-SearchBox">
        <form class="ais-SearchBox-form" novalidate (submit)="$event.preventDefault()">
          <input
            class="ais-SearchBox-input"
            type="search"
            [placeholder]="activePlaceholder()"
            [value]="searchQuery()"
            [disabled]="!typesenseAvailable()"
            (input)="onSearchInput($event)"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          />
          @if (searchQuery()) {
            <button class="ais-SearchBox-reset" type="button"
              (click)="clearSearch()" aria-label="Clear search">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
                fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
              </svg>
            </button>
          }
        </form>
      </div>
    </div>

    <!-- Collection panels -->
    <div class="search-panels">
      <div class="container search-body pt-3"
        role="tabpanel" [id]="'search-panel-' + activeTab()">

        <!-- Filter bar: Open Filters toggle + stats -->
        <div class="filter-bar mb-3">
          <button class="filter-bar__toggle" type="button"
            (click)="toggleSidebar()"
            [attr.aria-expanded]="!sidebarCollapsed()"
            aria-controls="searchFilterSidebar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
              fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
            </svg>
            {{ sidebarCollapsed() ? 'Open Filters' : 'Close Filters' }}
            @if (activeFilterCount() > 0) {
              <span class="filter-sidebar__badge">{{ activeFilterCount() }}</span>
            }
          </button>
          @if (activeStatsText()) {
            <span class="text-muted small ms-auto">{{ activeStatsText() }}</span>
          }
        </div>

        <div class="search-columns">

          <!-- Filter sidebar -->
          <app-search-filter-sidebar
            sidebarId="searchFilterSidebar"
            ariaLabel="Search filters"
            [facets]="activeFacets()"
            [facetSnapshot]="activeFacetSnapshot()"
            [groupedSnapshot]="activeGroupedSnapshot()"
            [filtersLoaded]="activeFiltersLoaded()"
            [sidebarCollapsed]="sidebarCollapsed()"
            [filtersOpen]="filtersOpen()"
            [collapsedFacets]="collapsedFacets()"
            [dateFacet]="activeConfig()?.dateFacet"
            [fromCtrl]="activeFromCtrl()"
            [toCtrl]="activeToCtrl()"
            [hasDateFilter]="activeHasDateFilter()"
            [sortOptions]="activeConfig()?.sortOptions"
            [activeSortBy]="activeSortByValue()"
            [activeFilterCount]="activeFilterCount()"
            [typesenseAvailable]="typesenseAvailable()"
            (toggleSidebar)="toggleSidebar()"
            (toggleFiltersOpen)="filtersOpen.set(!filtersOpen())"
            (toggleFacet)="toggleFacet($event)"
            (refineFacet)="refineFacet($event.attribute, $event.value)"
            (clearDateFilter)="clearDateFilter()"
            (sortChanged)="applySort($event)" />

          <!-- Results column -->
          <div class="results-col" #resultsCol>
            @if (!typesenseAvailable()) {
              <div class="text-center py-5 text-muted">
                <p>Search service is temporarily unavailable. Please try again later.</p>
              </div>
            } @else if (activeCollectionId(); as colId) {
              <app-search-results-list
                [collectionId]="colId"
                [hits]="activeHits()"
                [isLoading]="activeIsLoading()"
                [isLoadingMore]="activeIsLoadingMore()"
                [hasSearched]="activeHasSearched()"
                [hasError]="activeHasError()"
                (resultClicked)="trackResultClick($event.hit, $event.index)"
                (downloadClicked)="trackDocDownload($event, 0)"
                (projectClicked)="trackDocProjectClick($event.hit, $event.index)" />
            }
            <div #scrollSentinel></div>
          </div>

        </div><!-- /.search-columns -->
      </div><!-- /.search-body -->
    </div><!-- /.search-panels -->
  `,
  styles: [`:host { display: flex; flex-direction: column; flex: 1; min-height: 0; }`],
})
export class UnifiedSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly tabs = TABS;
  typesenseAvailable = input(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  activeTab        = signal<Tab>('projects');
  searchQuery      = signal('');
  sidebarCollapsed = signal(localStorage.getItem('filterSidebarCollapsed') === 'true');
  filtersOpen      = signal(false);
  collapsedFacets  = signal<Set<string>>(new Set());
  activeSortByValue = signal(COLLECTIONS.activities.defaultSortBy);

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem('filterSidebarCollapsed', String(next));
  }

  toggleFacet(attribute: string): void {
    const next = new Set(this.collapsedFacets());
    if (next.has(attribute)) next.delete(attribute);
    else next.add(attribute);
    this.collapsedFacets.set(next);
  }

  // ── Engines (one per active collection, created lazily) ─────────────────────
  private engines = signal<Partial<Record<CollectionId, TypesenseSearchEngine>>>({});
  /** Tracks the subscription to configService.lists for the documents engine. */
  private lawLookupSub: Subscription | null = null;

  // ── ViewChild: scroll sentinel + results column ──────────────────────────────
  private sentinelEl:   HTMLElement | null = null;
  private resultsColEl: HTMLElement | null = null;

  @ViewChild('scrollSentinel')
  set scrollSentinel(el: ElementRef | undefined) {
    this.sentinelEl = el?.nativeElement ?? null;
    const id = this.activeCollectionId();
    if (el && id && this.engines()[id]) this.setupObserver(id);
  }

  @ViewChild('resultsCol')
  set resultsCol(el: ElementRef | undefined) {
    this.resultsColEl = el?.nativeElement ?? null;
    const id = this.activeCollectionId();
    if (el && id && this.sentinelEl && this.engines()[id]) this.setupObserver(id);
  }

  // ── Services ────────────────────────────────────────────────────────────────
  private typesense     = inject(TypesenseService);
  private configService = inject(ConfigService);
  private analytics     = inject(AnalyticsService);
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private zone          = inject(NgZone);
  private destroyRef    = inject(DestroyRef);
  private searchInput$  = new Subject<string>();
  private tabArrowsHandle: TabArrowsHandle | null = null;
  private lastTrackedQuery = new Map<CollectionId, string>();

  // ── Derived computed signals ─────────────────────────────────────────────────
  activeCollectionId = computed((): CollectionId | null => tabToCollectionId(this.activeTab()));
  activePlaceholder  = computed(() => { const id = this.activeCollectionId(); return id ? COLLECTIONS[id].placeholder : ''; });
  activeConfig       = computed(() => { const id = this.activeCollectionId(); return id ? COLLECTIONS[id] : null; });
  activeFacets       = computed(() => { const id = this.activeCollectionId(); return id ? COLLECTIONS[id].facets : []; });

  activeHits          = computed(()  => this.engineSig('hits', []));
  activeIsLoading     = computed(()  => this.engineSig('isLoading', true));
  activeIsLoadingMore = computed(()  => this.engineSig('isLoadingMore', false));
  activeHasSearched   = computed(()  => this.engineSig('hasSearched', false));
  activeHasError      = computed(()  => this.engineSig('hasError', false));
  activeFiltersLoaded = computed(()  => this.engineSig('filtersLoaded', false));
  activeHasDateFilter = computed(()  => this.engineSig('hasDateFilter', false));

  activeFromCtrl = computed(() => {
    const id = this.activeCollectionId();
    return id ? (this.engines()[id]?.fromCtrl ?? null) : null;
  });
  activeToCtrl = computed(() => {
    const id = this.activeCollectionId();
    return id ? (this.engines()[id]?.toCtrl ?? null) : null;
  });

  activeStatsText = computed((): string => {
    const id = this.activeCollectionId();
    if (!id) return '';
    const e = this.engines()[id];
    if (!e || !e.hasSearched()) return '';
    const n = e.nbHits(), ms = e.procMs();
    return `${n.toLocaleString()} result${n !== 1 ? 's' : ''}${ms > 0 ? ' in ' + ms + ' ms' : ''}`;
  });

  activeFacetSnapshot = computed((): Record<string, DisplayItem[]> => {
    const id = this.activeCollectionId();
    if (!id) return {};
    const e = this.engines()[id];
    if (!e) return {};
    const snap: Record<string, DisplayItem[]> = {};
    for (const f of this.activeFacets()) snap[f.attribute] = e.facetItems[f.attribute]?.() ?? [];
    return snap;
  });

  activeGroupedSnapshot = computed((): Record<string, LegislationGroup[]> => {
    if (this.activeCollectionId() !== 'documents') return {};
    const e = this.engines().documents;
    if (!e) return {};
    const snap: Record<string, LegislationGroup[]> = {};
    for (const f of COLLECTIONS.documents.facets) {
      snap[f.attribute] = f.grouped
        ? groupByLegislation(e.facetItems[f.attribute]?.() ?? [], e.lawLookups[f.attribute]?.() ?? new Map(), f.sorter)
        : [];
    }
    return snap;
  });

  activeFilterCount = computed(() => {
    const id = this.activeCollectionId();
    if (!id) return 0;
    const e = this.engines()[id];
    if (!e) return 0;
    let count = 0;
    for (const f of COLLECTIONS[id].facets) {
      count += (e.facetItems[f.attribute]?.() ?? []).filter((i: any) => i.isRefined).length;
    }
    if (e.fromCtrl.value || e.toCtrl.value) count++;
    return count;
  });

  // ── Constructor: reactive effects ────────────────────────────────────────────
  constructor() {
    // Activate engine for current collection when Typesense becomes available
    effect(() => {
      if (this.typesenseAvailable()) {
        const id = this.activeCollectionId();
        if (id) this.ensureActive(id);
      }
    });
    // Drive searchBoxRefine when the query changes (guard: skip if engine was
    // just created with this query as initialQuery — avoids duplicate requests
    // on tab switch when the engine was initialized with the same query).
    effect(() => {
      const q  = this.searchQuery();
      const id = this.activeCollectionId();
      if (id) {
        const engine = this.engines()[id];
        if (engine && q !== engine.lastQuery) engine.search(q);
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const snap = this.route.snapshot.queryParamMap;
    this.activeTab.set(this.parseTab(snap.get('tab')));
    this.searchQuery.set(snap.get('q') ?? '');

    // Eagerly trigger law-lookup list loading so data is in the ReplaySubject
    // buffer before the Documents tab is first opened — prevents grouped-facet
    // layout shift on first open.
    this.configService.lists.pipe(take(1)).subscribe();

    this.searchInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(q => {
      this.searchQuery.set(q);
      this.updateUrl(this.activeTab(), q);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      const raw = p.get('tab');
      const tab = this.parseTab(raw);
      const q   = p.get('q') ?? '';
      const prevTab = this.activeTab();
      this.activeTab.set(tab);
      if (q !== this.searchQuery()) this.searchQuery.set(q);
      if (raw !== tab) this.updateUrl(tab, q);
      if (tab !== prevTab) {
        const id = tabToCollectionId(tab);
        if (id) this.ensureActive(id);
      }
    });
  }

  ngAfterViewInit(): void {
    const id = this.activeCollectionId();
    if (id) this.ensureActive(id);
    this.tabArrowsHandle = initTabArrows();
  }

  ngOnDestroy(): void {
    this.tabArrowsHandle?.cleanup();
    this.lawLookupSub?.unsubscribe();
    (Object.keys(this.engines()) as CollectionId[]).forEach(id => this.teardown(id));
  }

  // ── Public handlers ──────────────────────────────────────────────────────────
  switchTab(tab: Tab): void {
    const prevTab = this.activeTab();
    this.activeTab.set(tab);
    this.searchQuery.set('');
    const id = tabToCollectionId(tab);
    if (id) this.ensureActive(id);
    this.updateUrl(tab, '');
    if (tab !== prevTab) this.analytics.track('Search Tab Changed', { from_tab: prevTab, to_tab: tab });
  }

  onSearchInput(e: Event): void {
    this.searchInput$.next((e.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    const prevQuery = this.searchQuery();
    this.searchInput$.next('');
    this.searchQuery.set('');
    this.updateUrl(this.activeTab(), '');
    if (prevQuery) this.analytics.track('Search Cleared', { previous_query: prevQuery, collection: this.activeCollectionId() });
  }

  refineFacet(attribute: string, value: string): void {
    const id = this.activeCollectionId();
    if (id) {
      this.engines()[id]?.refine(attribute, value);
      this.analytics.track('Search Filter Applied', { facet_attribute: attribute, facet_value: value, collection: id });
    }
  }

  clearDateFilter(): void {
    const id = this.activeCollectionId();
    if (!id) return;
    this.engines()[id]?.clearDateFilter();
    this.analytics.track('Search Date Filter Cleared', { collection: id });
  }

  applySort(value: string): void {
    if (this.activeSortByValue() === value) return;
    this.activeSortByValue.set(value);
    this.analytics.track('Search Sort Changed', { sort_value: value, collection: 'activities' });
    if (this.activeCollectionId() === 'activities') {
      this.teardown('activities');
      this.ensureActive('activities');
    }
  }

  trackResultClick(hit: any, position: number): void {
    this.analytics.track('Search Result Clicked', {
      result_type: 'project',
      result_id: hit['id'] ?? hit['objectID'],
      result_title: hit['name'] ?? 'Unknown',
      position,
      query: this.searchQuery(),
    });
  }

  trackDocDownload(hit: any, position: number): void {
    this.analytics.track('Search Download Clicked', {
      document_id: hit['id'] ?? hit['objectID'],
      document_name: hit['displayName'] ?? hit['documentFileName'] ?? 'Unknown',
      position,
      query: this.searchQuery(),
    });
  }

  trackDocProjectClick(hit: any, position: number): void {
    this.analytics.track('Search Result Clicked', {
      result_type: 'document',
      result_id: hit['id'] ?? hit['objectID'],
      result_title: hit['displayName'] ?? hit['documentFileName'] ?? 'Unknown',
      position,
      query: this.searchQuery(),
    });
  }

  // ── Private: collection lifecycle ────────────────────────────────────────────
  private ensureActive(id: CollectionId): void {
    if (!this.typesenseAvailable()) return;
    // Activities: if sort changed, teardown and recreate
    if (id === 'activities' && this.engines().activities) {
      // sortBy is embedded in the searchClient params at creation time;
      // the engine does not expose sort change — we recreate on sort change (handled by applySort).
    }
    if (!this.engines()[id]) this.createEngine(id);
    else this.setupObserver(id);
  }

  private createEngine(id: CollectionId): void {
    const col    = COLLECTIONS[id];
    const sortBy = id === 'activities' ? this.activeSortByValue() : col.defaultSortBy;
    const q      = this.searchQuery();

    const params = buildAdapterParams(col, sortBy);

    const searchClient = this.typesense.getSearchClient(params);

    const engine = new TypesenseSearchEngine(
      {
        collectionId: id,
        facets: col.facets,
        searchClient,
        escapeHTML: false,
        enableContentSnippets: id === 'documents',
        initialQuery: q,
        callbacks: {
          onSearchPerformed: (query, nbHits, procMs) => {
            if (this.lastTrackedQuery.get(id) !== query) {
              this.lastTrackedQuery.set(id, query);
              this.analytics.track('Search Performed', {
                query,
                collection: id,
                tab: this.activeTab(),
                nb_hits: nbHits,
                proc_ms: procMs,
              });
            }
          },
        },
      },
      this.typesense,
      this.zone,
    );

    this.engines.update(e => ({ ...e, [id]: engine }));
    engine.init(this.destroyRef);

    if (id === 'documents') {
      this.lawLookupSub?.unsubscribe();
      this.lawLookupSub = this.configService.lists.subscribe(lists => {
        this.engines().documents?.updateLegislationLookups(lists);
      });
    }

    if (this.sentinelEl) this.setupObserver(id);
  }

  private teardown(id: CollectionId): void {
    this.engines()[id]?.dispose();
    this.engines.update(e => { const n = { ...e }; delete n[id]; return n; });
    if (id === 'documents') {
      this.lawLookupSub?.unsubscribe();
      this.lawLookupSub = null;
    }
  }

  private setupObserver(id: CollectionId): void {
    if (!this.sentinelEl) return;
    this.engines()[id]?.setupObserver(this.sentinelEl, this.resultsColEl ?? undefined);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────
  private engineSig<T>(key: 'hits' | 'isLoading' | 'isLoadingMore' | 'hasSearched' | 'hasError' | 'filtersLoaded' | 'hasDateFilter' | 'nbHits' | 'procMs', fallback: T): T {
    const id = this.activeCollectionId();
    if (!id) return fallback;
    const engine = this.engines()[id];
    if (!engine) return fallback;
    return (engine[key] as any)() as T;
  }

  private parseTab(raw: string | null): Tab {
    if (raw === 'content') return 'documents';
    return VALID_TABS.includes(raw as Tab) ? (raw as Tab) : 'projects';
  }

  private updateUrl(tab: Tab, q: string): void {
    this.router.navigate([], { queryParams: { tab, q: q || null }, queryParamsHandling: 'replace', replaceUrl: true });
  }
}
