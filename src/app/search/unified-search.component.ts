import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject, input, signal, computed, effect,
  ViewChild, ElementRef, NgZone,
  ChangeDetectionStrategy,
  WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import instantsearch from 'instantsearch.js';
import { configure } from 'instantsearch.js/es/widgets';
import {
  connectInfiniteHits,
  connectRefinementList,
  connectSearchBox,
  connectStats,
} from 'instantsearch.js/es/connectors';
import { TypesenseService } from 'app/services/typesense.service';
import { ConfigService } from 'app/services/config.service';
import { AnalyticsService } from 'app/services/analytics/analytics.service';
import { DatePickerComponent } from 'app/shared/components/date-picker/date-picker.component';
import { SearchProjectCardComponent } from './cards/search-project-card.component';
import { SearchDocumentCardComponent } from './cards/search-document-card.component';
import { SearchActivityCardComponent } from './cards/search-activity-card.component';
import { SearchNotificationCardComponent } from './cards/search-notification-card.component';
import {
  type CollectionId,
  type Tab,
  type DisplayItem,
  type LegislationGroup,
  COLLECTIONS,
  VALID_TABS,
  mergeItems,
  groupByLegislation,
  tabToCollectionId,
} from './search-collections';

// ── Per-collection runtime state ───────────────────────────────────────────────

interface ColState {
  is: ReturnType<typeof instantsearch> | null;
  searchBoxRefine: ((q: string) => void) | null;
  showMore: (() => void) | null;
  observer: IntersectionObserver | null;
  configureWidget: any;
  activeSortBy: string;

  hits: WritableSignal<any[]>;
  isLoading: WritableSignal<boolean>;
  isLoadingMore: WritableSignal<boolean>;
  hasSearched: WritableSignal<boolean>;
  hasError: WritableSignal<boolean>;
  filtersLoaded: WritableSignal<boolean>;
  nbHits: WritableSignal<number>;
  procMs: WritableSignal<number>;
  statsQuery: WritableSignal<string>;

  facetItems: Record<string, WritableSignal<DisplayItem[]>>;
  masterMaps: Record<string, Map<string, DisplayItem>>;
  refineFns: Record<string, (v: string) => void>;
  lawLookups: Record<string, WritableSignal<Map<string, number>>>;

  fromCtrl: FormControl<string | null>;
  toCtrl: FormControl<string | null>;
  hasDateFilter: WritableSignal<boolean>;
  dateSubs: Subscription[];
  lastRefinedQuery: string;

  sortBy: WritableSignal<string>;
}

function createState(id: CollectionId): ColState {
  const col = COLLECTIONS[id];
  const facetItems: Record<string, WritableSignal<DisplayItem[]>> = {};
  const masterMaps: Record<string, Map<string, DisplayItem>> = {};
  const refineFns: Record<string, (v: string) => void> = {};
  const lawLookups: Record<string, WritableSignal<Map<string, number>>> = {};
  for (const f of col.facets) {
    facetItems[f.attribute] = signal<DisplayItem[]>([]);
    masterMaps[f.attribute] = new Map();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    refineFns[f.attribute] = (_: string) => {};
    lawLookups[f.attribute] = signal(new Map<string, number>());
  }
  return {
    is: null, searchBoxRefine: null, showMore: null, observer: null,
    configureWidget: null, activeSortBy: col.defaultSortBy,
    hits: signal([]), isLoading: signal(true), isLoadingMore: signal(false),
    hasSearched: signal(false), hasError: signal(false), filtersLoaded: signal(false),
    nbHits: signal(0), procMs: signal(0), statsQuery: signal(''),
    facetItems, masterMaps, refineFns, lawLookups,
    fromCtrl: new FormControl<string | null>(''),
    toCtrl: new FormControl<string | null>(''),
    hasDateFilter: signal(false), dateSubs: [],
    lastRefinedQuery: '',
    sortBy: signal(col.defaultSortBy),
  };
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'projects',      label: 'Projects'      },
  { id: 'documents',     label: 'Documents'     },
  { id: 'updates',       label: 'Updates'       },
  { id: 'notifications', label: 'Notifications' },
];



@Component({
  selector: 'app-unified-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePickerComponent,
    SearchProjectCardComponent,
    SearchDocumentCardComponent,
    SearchActivityCardComponent,
    SearchNotificationCardComponent,
  ],
  template: `
    <!-- ── Tab bar ───────────────────────────────────────────────── -->
    <div class="tab-bar-wrapper pt-3">
      <div class="container">
        <div class="tab-bar" role="tablist" aria-label="Search dataset tabs">
          @for (tab of tabs; track tab.id) {
            <button
              class="tab-btn"
              [class.active]="activeTab() === tab.id"
              role="tab"
              [attr.aria-selected]="activeTab() === tab.id"
              [id]="'search-tab-' + tab.id"
              [attr.aria-controls]="'search-panel-' + tab.id"
              (click)="switchTab(tab.id)"
            >{{ tab.label }}</button>
          }
        </div>
      </div>
    </div>

    <!-- ── Shared search bar + stats (Typesense tabs only) ──────── -->
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
        <!-- Stats shown on md+ only here; on mobile it moves into the filter row below -->
        @if (activeStatsText()) {
          <div class="d-none d-md-block text-muted small mt-1 text-end">{{ activeStatsText() }}</div>
        }
      </div>

    <!-- ── Panels wrapper (flex child that fills remaining height) ── -->
    <div class="search-panels">

    <!-- ── Collection panels (facets + results) ──────────────────── -->
    <div class="container search-body pt-3" role="tabpanel" [id]="'search-panel-' + activeTab()">
      <div class="row">

          <!-- ── Facets sidebar ───── -->
          <div class="col-md-3">
            <!-- Mobile filter toggle + stats row -->
            <div class="d-md-none d-flex align-items-center justify-content-between mb-3">
              <button
                class="btn filter-toggle-btn btn-sm d-flex align-items-center gap-2"
                [class.filter-toggle-btn--open]="filtersOpen()"
                (click)="filtersOpen.set(!filtersOpen())"
                [attr.aria-expanded]="filtersOpen()"
                aria-controls="searchFilterPanel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                </svg>
                Filters
                <svg class="filter-chevron" [class.open]="filtersOpen()" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
              @if (activeStatsText()) {
                <span class="text-muted small">{{ activeStatsText() }}</span>
              }
            </div>
            <div id="searchFilterPanel" class="filter-wrap" [class.filter-wrap--open]="filtersOpen()">
              <div class="filter-inner">
                <div class="filter-inner-pad">
                @if (!activeFiltersLoaded() && typesenseAvailable()) {
                  <div class="d-flex align-items-center gap-2 py-3 text-muted">
                    <div class="spinner-border spinner-border-sm" role="status">
                      <span class="visually-hidden">Loading filters…</span>
                    </div>
                    <span class="small">Loading filters…</span>
                  </div>
                }
                @for (facet of activeFacets(); track facet.attribute) {
                  <div class="mb-3" [class.d-none]="!activeFiltersLoaded()">
                    <h6 class="fw-semibold">{{ facet.heading }}</h6>
                    @if (facet.grouped) {
                      @for (group of activeGroupedSnapshot()[facet.attribute]; track group.year) {
                        @if (group.heading) {
                          <small class="legislation-heading d-block">{{ group.heading }}</small>
                        }
                        <ul class="ais-RefinementList-list">
                          @for (item of group.items; track item.label) {
                            <li class="ais-RefinementList-item"
                              [class.ais-RefinementList-item--selected]="item.isRefined"
                              [class.ais-RefinementList-item--disabled]="item.isDisabled">
                              <label class="ais-RefinementList-label">
                                <input type="checkbox" class="ais-RefinementList-checkbox"
                                  [checked]="item.isRefined" [disabled]="item.isDisabled"
                                  (change)="refineFacet(facet.attribute, item.label)" />
                                <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                                <span class="ais-RefinementList-count">{{ item.count }}</span>
                              </label>
                            </li>
                          }
                        </ul>
                      }
                    } @else {
                      <ul class="ais-RefinementList-list">
                        @for (item of activeFacetSnapshot()[facet.attribute]; track item.label) {
                          <li class="ais-RefinementList-item"
                            [class.ais-RefinementList-item--selected]="item.isRefined"
                            [class.ais-RefinementList-item--disabled]="item.isDisabled">
                            <label class="ais-RefinementList-label">
                              <input type="checkbox" class="ais-RefinementList-checkbox"
                                [checked]="item.isRefined" [disabled]="item.isDisabled"
                                (change)="refineFacet(facet.attribute, item.label)" />
                              <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                              <span class="ais-RefinementList-count">{{ item.count }}</span>
                            </label>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                }
                @if (activeConfig()?.dateFacet; as df) {
                  <div class="mb-3" [class.d-none]="!activeFiltersLoaded()">
                    <h6 class="fw-semibold">{{ df.heading }}</h6>
                    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                    <label class="control-label fw-bold">{{ df.fromLabel }}</label>
                    @if (activeFromCtrl(); as ctrl) {
                      <lib-date-picker [control]="ctrl" [minDate]="minDate" />
                    }
                    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                    <label class="control-label fw-bold mt-2">{{ df.toLabel }}</label>
                    @if (activeToCtrl(); as ctrl) {
                      <div class="mb-3">
                        <lib-date-picker [control]="ctrl" [minDate]="minDate" />
                      </div>
                    }
                    @if (activeHasDateFilter()) {
                      <button class="btn btn-link btn-sm p-0 text-secondary mt-1"
                        (click)="clearDateFilter()">Clear both</button>
                    }
                  </div>
                }
                @if (activeConfig()?.sortOptions; as opts) {
                  <div class="mb-3" [class.d-none]="!activeFiltersLoaded()">
                    <h6 class="fw-semibold">Sort</h6>
                    @for (opt of opts; track opt.value) {
                      <div class="form-check">
                        <input class="form-check-input" type="radio" name="searchSort"
                          [id]="'sort-' + opt.value"
                          [checked]="activeSortBy() === opt.value"
                          (change)="applySort(opt.value)" />
                        <label class="form-check-label small" [for]="'sort-' + opt.value">
                          {{ opt.label }}
                        </label>
                      </div>
                    }
                  </div>
                }
                </div><!-- /.filter-inner-pad -->
              </div>
            </div>
          </div>

          <!-- ── Results col ─────── -->
          <div class="col-md-9 results-col" #resultsCol>
            @if (!typesenseAvailable()) {
              <div class="text-center py-5 text-muted">
                <p>Search service is temporarily unavailable. Please try again later.</p>
              </div>
            } @else if (activeIsLoading()) {
              <div class="results-loading-overlay">
                <div class="spinner-border text-secondary" role="status">
                  <span class="visually-hidden">Loading…</span>
                </div>
              </div>
            } @else if (activeHasError()) {
              <div class="text-center text-muted py-5">Search timed out — please try again.</div>
            } @else if (activeHits().length === 0 && activeHasSearched()) {
              <div class="text-center text-muted py-5">No results found.</div>
            } @else {
              @switch (activeCollectionId()) {
                @case ('projects') {
                  <div class="d-flex flex-column">
                    @for (hit of activeHits(); track hit['id'] ?? hit['objectID']; let i = $index) {
                      <app-search-project-card [hit]="hit" (clicked)="trackResultClick(hit, i)" />
                    }
                  </div>
                }
                @case ('documents') {
                  <div class="d-flex flex-column">
                    @for (hit of activeHits(); track hit['objectID'] ?? hit['id']; let i = $index) {
                      <app-search-document-card [hit]="hit"
                        (downloadClicked)="trackDocDownload(hit, i)"
                        (projectClicked)="trackDocProjectClick(hit, i)" />
                    }
                  </div>
                }
                @case ('activities') {
                  <div class="d-flex flex-column">
                    @for (hit of activeHits(); track hit['objectID'] ?? hit['id']; let i = $index) {
                      <app-search-activity-card [hit]="hit"
                        (projectClicked)="trackResultClick(hit, i)" />
                    }
                  </div>
                }
                @case ('notifications') {
                  <div class="d-flex flex-column">
                    @for (hit of activeHits(); track hit['id'] ?? hit['objectID']; let i = $index) {
                      <app-search-notification-card [hit]="hit"
                        (projectClicked)="trackResultClick(hit, i)" />
                    }
                  </div>
                }
              }
            }
            <div #scrollSentinel class="py-2 text-center">
              @if (activeIsLoadingMore()) {
                <div class="spinner-border spinner-border-sm text-secondary" role="status">
                  <span class="visually-hidden">Loading more…</span>
                </div>
              }
            </div>
          </div>

        </div>
      </div>

    </div><!-- /.search-panels -->
  `,
  styles: [`
    .tab-bar-wrapper .container {
      position: relative;
    }
    .tab-bar-wrapper .container::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: calc(var(--bs-gutter-x, 1.5rem) * .5);
      right: calc(var(--bs-gutter-x, 1.5rem) * .5);
      height: 2px;
      background: #dee2e6;
      z-index: 0;
    }
    .tab-bar {
      display: flex;
      gap: 0;
      white-space: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tab-bar::-webkit-scrollbar { display: none; }
    .tab-btn {
      flex-shrink: 0;
      padding: 0.6rem 1.25rem;
      border: none;
      border-bottom: 3px solid transparent;
      background: transparent;
      font-size: 0.9rem;
      font-weight: 600;
      color: #6c757d;
      cursor: pointer;
      position: relative;
      z-index: 1;
      transition: color 0.15s ease, border-bottom-color 0.15s ease;
    }
    .tab-btn:hover { color: var(--bs-primary, #003366); }
    .tab-btn.active {
      color: var(--bs-primary, #003366);
      border-bottom-color: var(--bc-gold, #e3a82b);
    }
    .results-col {
      position: relative;
      overflow-anchor: none;
      min-height: 500px;
    }
    .results-loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .filter-wrap {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .filter-wrap--open { grid-template-rows: 1fr; }
    .filter-inner { overflow: hidden; }
    .filter-inner-pad { padding-bottom: 0.5rem; }
    /* Date picker borders blend with the grey filter panel — darken them slightly */
    .filter-inner lib-date-picker .date-input-wrapper {
      border-color: #adb5bd;
    }
    @media (min-width: 768px) {
      .filter-wrap { grid-template-rows: 1fr; }

      /* ── Fixed-height search layout ── */
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }
      .search-panels {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      /* notifications tab: single scrollable column */
      .search-panels > .container {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      /* collection two-panel layout */
      .search-body {
        flex: 1;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: hidden;
      }
      .search-body > .row {
        height: 100%;
        overflow: hidden;
        flex-wrap: nowrap;
      }
      .search-body .col-md-3 {
        height: 100%;
        overflow-y: auto;
        flex-shrink: 0;
        min-width: 0;
      }
      .results-col {
        height: 100%;
        overflow-y: auto;
        min-height: unset;
        min-width: 0;
      }
    }
  `],
})
export class UnifiedSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly tabs = TABS;
  readonly minDate = new Date(1970, 0, 1);
  typesenseAvailable = input(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  activeTab   = signal<Tab>('projects');
  searchQuery = signal('');
  filtersOpen = signal(false);

  // ── Per-collection state (created upfront, IS instances created lazily) ─────
  private states: Record<CollectionId, ColState> = {
    projects:      createState('projects'),
    documents:     createState('documents'),
    activities:    createState('activities'),
    notifications: createState('notifications'),
  };

  // ── Scroll sentinel + results column (ViewChild setters) ───────────────────
  private sentinelEl: HTMLElement | null = null;
  private resultsColEl: HTMLElement | null = null;

  @ViewChild('scrollSentinel')
  set scrollSentinel(el: ElementRef | undefined) {
    this.sentinelEl = el?.nativeElement ?? null;
    const id = this.activeCollectionId();
    if (el && id && this.states[id].is) this.setupObserver(id);
  }

  @ViewChild('resultsCol')
  set resultsCol(el: ElementRef | undefined) {
    this.resultsColEl = el?.nativeElement ?? null;
    const id = this.activeCollectionId();
    if (el && id && this.sentinelEl && this.states[id].is) this.setupObserver(id);
  }

  // ── Services ─────────────────────────────────────────────────────────────────
  private typesense     = inject(TypesenseService);
  private configService = inject(ConfigService);
  private analytics     = inject(AnalyticsService);
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private zone          = inject(NgZone);
  private destroy$ = new Subject<void>();
  private searchInput$ = new Subject<string>();
  private lastTrackedQuery = new Map<CollectionId, string>();

  // ── Derived computed signals ─────────────────────────────────────────────────
  activeCollectionId = computed((): CollectionId | null => tabToCollectionId(this.activeTab()));
  activePlaceholder  = computed(() => { const id = this.activeCollectionId(); return id ? COLLECTIONS[id].placeholder : ''; });
  activeConfig       = computed(() => { const id = this.activeCollectionId(); return id ? COLLECTIONS[id] : null; });
  activeFacets       = computed(() => { const id = this.activeCollectionId(); return id ? COLLECTIONS[id].facets : []; });

  activeHits          = computed(() => this.sig<any[]>('hits', []));
  activeIsLoading     = computed(() => this.sig<boolean>('isLoading', true));
  activeIsLoadingMore = computed(() => this.sig<boolean>('isLoadingMore', false));
  activeHasSearched   = computed(() => this.sig<boolean>('hasSearched', false));
  activeHasError      = computed(() => this.sig<boolean>('hasError', false));
  activeFiltersLoaded = computed(() => this.sig<boolean>('filtersLoaded', false));
  activeHasDateFilter = computed(() => this.sig<boolean>('hasDateFilter', false));
  activeSortBy        = computed(() => this.sig<string>('sortBy', ''));

  activeFromCtrl = computed(() => { const id = this.activeCollectionId(); return id ? this.states[id].fromCtrl : null; });
  activeToCtrl   = computed(() => { const id = this.activeCollectionId(); return id ? this.states[id].toCtrl   : null; });

  activeStatsText = computed((): string => {
    const id = this.activeCollectionId();
    if (!id) return '';
    const s = this.states[id];
    if (!s.hasSearched()) return '';
    const n = s.nbHits(), ms = s.procMs();
    const base = `${n.toLocaleString()} result${n !== 1 ? 's' : ''}`;
    return `${base} in ${ms} ms`;
  });

  activeFacetSnapshot = computed((): Record<string, DisplayItem[]> => {
    const id = this.activeCollectionId();
    if (!id) return {};
    const s = this.states[id];
    const snap: Record<string, DisplayItem[]> = {};
    for (const f of this.activeFacets()) snap[f.attribute] = s.facetItems[f.attribute]();
    return snap;
  });

  activeGroupedSnapshot = computed((): Record<string, LegislationGroup[]> => {
    if (this.activeCollectionId() !== 'documents') return {};
    const s = this.states.documents;
    const snap: Record<string, LegislationGroup[]> = {};
    for (const f of COLLECTIONS.documents.facets) {
      snap[f.attribute] = f.grouped
        ? groupByLegislation(s.facetItems[f.attribute](), s.lawLookups[f.attribute](), f.sorter)
        : [];
    }
    return snap;
  });

  // ── Constructor: reactive effects ────────────────────────────────────────────
  constructor() {
    effect(() => { if (this.typesenseAvailable()) { const id = this.activeCollectionId(); if (id) this.ensureActive(id); } });
    // Drive searchBoxRefine only when the query actually changed for this collection.
    // Without this guard the effect would fire on every tab switch (activeCollectionId
    // changes), causing a flood of redundant searches against already-live IS instances.
    effect(() => {
      const q = this.searchQuery();
      const id = this.activeCollectionId();
      if (id) {
        const s = this.states[id];
        if (s.searchBoxRefine && q !== s.lastRefinedQuery) {
          s.lastRefinedQuery = q;
          s.isLoading.set(true);
          s.hasError.set(false);
          s.searchBoxRefine(q);
        }
      }
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const snap = this.route.snapshot.queryParamMap;
    this.activeTab.set(this.parseTab(snap.get('tab')));
    this.searchQuery.set(snap.get('q') ?? '');

    // Debounced input → update signal + URL after 200 ms pause
    // (Algolia InstantSearch performance guide recommends 200 ms; >300 ms degrades UX)
    this.searchInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(q => {
      this.searchQuery.set(q);
      this.updateUrl(this.activeTab(), q);
    });

    // Route subscription: only call ensureActive when the TAB changes.
    // q-only changes are handled by the searchInput$ pipeline and the signal
    // effect above — calling ensureActive here too would fire the search twice.
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      const tab = this.parseTab(p.get('tab'));
      const q   = p.get('q') ?? '';
      const prevTab = this.activeTab();
      this.activeTab.set(tab);
      // Only sync q from URL when it differs from what we already have
      // (covers external navigation / back-forward, not our own updateUrl calls)
      if (q !== this.searchQuery()) {
        this.searchQuery.set(q);
      }
      if (tab !== prevTab) {
        const id = tabToCollectionId(tab);
        if (id) this.ensureActive(id);
      }
    });
  }

  ngAfterViewInit(): void {
    const id = this.activeCollectionId();
    if (id) this.ensureActive(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    (Object.keys(this.states) as CollectionId[]).forEach(id => this.teardown(id));
  }

  // ── Public handlers ───────────────────────────────────────────────────────────
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
    // Push raw value to debounced pipeline — search fires after 200 ms pause
    this.searchInput$.next((e.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    const prevQuery = this.searchQuery();
    this.searchInput$.next('');
    // Also set immediately so the X button disappears and input value syncs
    this.searchQuery.set('');
    this.updateUrl(this.activeTab(), '');
    if (prevQuery) this.analytics.track('Search Cleared', { previous_query: prevQuery, collection: this.activeCollectionId() });
  }

  refineFacet(attribute: string, label: string): void {
    const id = this.activeCollectionId();
    if (id) {
      this.states[id].refineFns[attribute]?.(label);
      this.analytics.track('Search Filter Applied', { facet_attribute: attribute, facet_value: label, collection: id });
    }
  }

  clearDateFilter(): void {
    const id = this.activeCollectionId();
    if (!id) return;
    this.states[id].fromCtrl.setValue('');
    this.states[id].toCtrl.setValue('');
    this.analytics.track('Search Date Filter Cleared', { collection: id });
  }

  applySort(value: string): void {
    const s = this.states.activities;
    if (s.sortBy() === value) return;
    s.sortBy.set(value);
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

  // ── Private: collection lifecycle ─────────────────────────────────────────────
  private ensureActive(id: CollectionId): void {
    if (!this.typesenseAvailable()) return;
    const s = this.states[id];
    if (id === 'activities' && s.is && s.activeSortBy !== s.sortBy()) this.teardown('activities');
    if (!s.is) this.initCollection(id);
    else this.setupObserver(id); // reconnect sentinel — ensures only the active collection's observer runs
    // searchBoxRefine is NOT called here. Two paths already cover it:
    //   - constructor effect: fires on every searchQuery() change once live
    //   - initCollection initialUiState: IS.js fires with the correct query on start()
    // Calling it a third time here caused duplicate requests on tab switch.
  }

  private initCollection(id: CollectionId): void {
    const col = COLLECTIONS[id];
    const s   = this.states[id];
    const sortBy = s.sortBy();

    const params: any = { query_by: col.queryBy, query_by_weights: col.queryByWeights };
    if (sortBy) params['sort_by'] = sortBy;

    // Pass the current query as initialUiState so IS.js's automatic start() search
    // fires with the correct query rather than q='*'. This eliminates the need to
    // call searchBoxRefine() after start() — removing the double-request that caused
    // browser connection-pool saturation during rapid tab switching.
    const initialQ = this.searchQuery();
    s.is = instantsearch({
      searchClient: this.typesense.getSearchClient(params),
      indexName: col.indexName,
      ...(initialQ ? { initialUiState: { [col.indexName]: { query: initialQ } } } : {}),
    });
    s.activeSortBy = sortBy;
    s.isLoading.set(true);

    const customSearchBox = connectSearchBox((rs: any) => { s.searchBoxRefine = rs.refine; });
    const customStats     = connectStats((rs: any) => {
      this.zone.run(() => { s.nbHits.set(rs.nbHits ?? 0); s.procMs.set(rs.processingTimeMS ?? 0); s.statsQuery.set(rs.query ?? ''); });
    });
    const customHits = connectInfiniteHits((rs: any) => {
      if (rs.results == null) {
        const cached = this.typesense.getLastHits(col.indexName);
        if (cached.length > 0) this.zone.run(() => { s.hits.set(cached); s.isLoading.set(false); });
        return;
      }
      this.zone.run(() => {
        this.typesense.setLastHits(col.indexName, rs.hits);
        s.hits.set([...rs.hits]);
        s.isLoading.set(false);
        s.isLoadingMore.set(false);
        s.hasSearched.set(true);
        s.hasError.set(false);
        s.showMore = rs.isLastPage ? null : rs.showMore;
        // Track search only when query text changes (not on load-more or filter-only updates)
        const rawQ = (rs.results?.query as string) ?? '';
        const normQ = rawQ === '*' ? '' : rawQ;
        if (this.lastTrackedQuery.get(id) !== normQ) {
          this.lastTrackedQuery.set(id, normQ);
          this.analytics.track('Search Performed', {
            query: normQ,
            collection: id,
            tab: this.activeTab(),
            nb_hits: (rs.results?.nbHits as number) ?? 0,
            proc_ms: (rs.results?.processingTimeMS as number) ?? 0,
          });
        }
      });
    });

    const widgets: any[] = [customSearchBox({}), customStats({}), customHits({})];

    for (const f of col.facets) {
      const cached = this.typesense.getLastFacets(col.indexName, f.attribute);
      if (cached.length > 0) { s.facetItems[f.attribute].set(mergeItems(s.masterMaps[f.attribute], cached, f.sorter)); s.filtersLoaded.set(true); }
      widgets.push(
        connectRefinementList((rs: any) => {
          s.refineFns[f.attribute] = rs.refine;
          if (rs.items.length === 0 && s.masterMaps[f.attribute].size > 0) return;
          this.zone.run(() => {
            s.facetItems[f.attribute].set(mergeItems(s.masterMaps[f.attribute], rs.items, f.sorter));
            s.filtersLoaded.set(true);
            this.typesense.setLastFacets(col.indexName, f.attribute, rs.items);
          });
        })({ attribute: f.attribute, operator: f.operator, limit: f.limit })
      );
    }

    s.configureWidget = configure({ hitsPerPage: col.hitsPerPage });
    widgets.push(s.configureWidget);
    s.is.addWidgets(widgets);
    s.is.start();
    // Record the query we just handed to IS.js so the effect doesn't repeat it.
    s.lastRefinedQuery = initialQ;

    s.is.on('error', () => {
      this.zone.run(() => { s.isLoading.set(false); s.hasError.set(true); });
    });

    if (this.sentinelEl) this.setupObserver(id);

    if (id === 'documents') {
      s.dateSubs.push(this.configService.lists.subscribe((lists: any[]) => {
        for (const f of col.facets) {
          if (!f.listType) continue;
          const m = new Map<string, number>();
          lists.filter(l => l.type === f.listType).forEach((l: any) => m.set(l.name, l.legislation || 0));
          s.lawLookups[f.attribute].set(m);
        }
      }));
    }

    if (col.dateFacet) {
      const onDateChange = (filterType: 'from' | 'to') => (v: string | null) => {
        s.hasDateFilter.set(!!(s.fromCtrl.value || s.toCtrl.value));
        this.applyDateFilter(id);
        if (v) this.analytics.track('Search Date Filter Applied', { filter_type: filterType, date_value: v, collection: id });
      };
      s.dateSubs.push(
        s.fromCtrl.valueChanges.subscribe(onDateChange('from')),
        s.toCtrl.valueChanges.subscribe(onDateChange('to')),
      );
    }
  }

  private teardown(id: CollectionId): void {
    const s = this.states[id];
    s.observer?.disconnect(); s.observer = null;
    s.is?.dispose(); s.is = null;
    s.searchBoxRefine = null; s.showMore = null;
    s.dateSubs.forEach(d => d.unsubscribe()); s.dateSubs = [];
  }

  private setupObserver(id: CollectionId): void {
    if (!this.sentinelEl) return;
    // Disconnect ALL other collections' observers — only the active collection should
    // ever watch the sentinel. After rapid tab switching, multiple IS instances could
    // each have an observer; a stale one firing showMore() causes spurious searches.
    for (const key of Object.keys(this.states) as CollectionId[]) {
      if (key !== id) this.states[key].observer?.disconnect();
    }
    const s = this.states[id];
    s.observer?.disconnect();
    // Use the results column as root so IntersectionObserver fires correctly
    // when the col itself is the scroll container (fixed-height layout).
    // Falls back to viewport (null) when resultsColEl is not yet available.
    s.observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && s.showMore) { s.isLoadingMore.set(true); s.showMore(); }
    }, { root: this.resultsColEl ?? null, rootMargin: '200px' });
    s.observer.observe(this.sentinelEl);
  }

  private applyDateFilter(id: CollectionId): void {
    const s = this.states[id]; const col = COLLECTIONS[id];
    if (!s.is || !s.configureWidget || !col.dateFacet) return;
    const from = s.fromCtrl.value, to = s.toCtrl.value;
    const nf: string[] = [];
    if (from) nf.push(`${col.dateFacet.field}>=${this.ts(from)}`);
    if (to)   nf.push(`${col.dateFacet.field}<=${this.ts(to, true)}`);
    s.is.removeWidgets([s.configureWidget]);
    s.configureWidget = configure({ hitsPerPage: col.hitsPerPage, ...(nf.length ? { numericFilters: nf } : {}) });
    s.is.addWidgets([s.configureWidget]);
  }

  // ── Private helpers ────────────────────────────────────────────────────────────
  private sig<T>(key: keyof ColState, fallback: T): T {
    const id = this.activeCollectionId();
    if (!id) return fallback;
    const v = this.states[id][key];
    return (typeof (v as any) === 'function' ? (v as any)() : v) as T;
  }

  private parseTab(raw: string | null): Tab {
    return VALID_TABS.includes(raw as Tab) ? (raw as Tab) : 'projects';
  }

  private updateUrl(tab: Tab, q: string): void {
    this.router.navigate([], { queryParams: { tab, q: q || null }, queryParamsHandling: 'replace', replaceUrl: true });
  }

  private ts(iso: string, endOfDay = false): number {
    return Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 1000) + (endOfDay ? 86399 : 0);
  }
}

