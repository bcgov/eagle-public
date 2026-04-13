import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  NgZone,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { HeroBannerComponent, HeroBannerAction } from 'app/shared/hero-banner/hero-banner.component';
import instantsearch from 'instantsearch.js';
import { searchBox, stats, configure } from 'instantsearch.js/es/widgets';
import { connectInfiniteHits, connectRefinementList } from 'instantsearch.js/es/connectors';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatePickerComponent } from 'app/shared/components/date-picker/date-picker.component';
import { TypesenseService } from 'app/services/typesense.service';

const INDEX_NAME = 'projects';

/** Typesense query parameters for the projects collection. */
const SEARCH_PARAMS = {
  query_by: 'name,displayName,description,epicProjectId,proponent',
  query_by_weights: '9000,8500,8000,3000,1000',
  hitsPerPage: 20,
} as const;

/**
 * Canonical project phase order, matching the legacy search UI.
 * Phases are ordered by legislation year (2002 first, 2018 second)
 * then by listOrder within each group — mirrors the sort in eagle-admin
 * and eagle-public's existing project list and document search filters.
 *
 * Any phase not listed here will sort alphabetically after the known phases.
 */
const PHASE_ORDER: string[] = [
  // ── 2002 Act phases (listOrder 0-17) ──────────────────────────────────
  'Pre-EA',
  'Pre-Application',
  'Evaluation',
  'Application Review',
  'Further Assessment',
  'Referral',
  'Termination',
  'Withdrawal',
  'Post Decision - Pre-Construction',
  'Post Decision - Construction',
  'Post Decision - Operation',
  'Post Decision - Care & Maintenance',
  'Post Decision - Decommission',
  'Post Decision - Complete',
  'Post Decision - Amendment',
  'Post Decision - Extension',
  'Post Decision - Substantial Start',
  'Post Decision - Suspension',
  // ── 2018 Act phases (listOrder 0-17) ──────────────────────────────────
  'Project Designation',
  'Early Engagement',
  'Readiness Decision',
  'Process Planning',
  'Application Development and Review',
  'Effects Assessment',
  // Referral appears in both acts — deduped, the 2002 entry above takes precedence
  'Post Decision - Amendment',     // 2018 listOrder 12 (alias entry, already 2002 covered)
  'Post Decision - Substantial Start',
  'Post Decision - Extension',
  'Post Decision - Suspension',
  'Complete',
  'Other',
];

/** A single facet option shown in the filter sidebar. */
interface DisplayItem {
  label: string;
  count: number;
  isRefined: boolean;
  isDisabled: boolean;
}

/** Alphabetical comparator for facet items. */
const sortByName = (a: DisplayItem, b: DisplayItem): number => a.label.localeCompare(b.label);

/**
 * Builds the merged display list for a facet.
 * All previously-seen items are preserved in masterMap; items absent from the
 * current search results get count=0 and isDisabled=true (unless still selected).
 */
function mergeItems(
  masterMap: Map<string, DisplayItem>,
  newItems: { label: string; count: number; isRefined: boolean }[],
  sorter: (a: DisplayItem, b: DisplayItem) => number,
): DisplayItem[] {
  for (const [key, item] of masterMap) {
    masterMap.set(key, { ...item, count: 0, isDisabled: !item.isRefined });
  }
  for (const item of newItems) {
    masterMap.set(item.label, { label: item.label, count: item.count, isRefined: item.isRefined, isDisabled: false });
  }
  return Array.from(masterMap.values()).sort(sorter);
}

/**
 * Comparator for refinementList sortBy: preserves the canonical PHASE_ORDER.
 * Selected (isRefined) items bubble to the top within their sorted position;
 * unknown phases fall back to alphabetical at the end.
 */
function sortByPhaseOrder(a: { label: string }, b: { label: string }): number {
  const ai = PHASE_ORDER.indexOf(a.label);
  const bi = PHASE_ORDER.indexOf(b.label);
  if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

@Component({
  selector: 'app-typesense-project-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBannerComponent, DatePickerComponent, ReactiveFormsModule],
  template: `
    <app-hero-banner
      title="Search Environmental Assessment Projects"
      description="Search and filter all environmental assessment projects in British Columbia. Click on a project row to view its details page."
      backgroundImage="/assets/images/hero-banner.jpg"
      [actions]="heroBannerActions"
    />

    <div class="container">
      <div #searchBoxEl class="mb-3"></div>

      <!-- Stats row + mobile filter toggle -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div #statsEl class="text-muted small"></div>
        <button
          class="btn filter-toggle-btn btn-sm d-md-none d-flex align-items-center gap-2"
          [class.filter-toggle-btn--open]="filtersOpen()"
          (click)="filtersOpen.set(!filtersOpen())"
          [attr.aria-expanded]="filtersOpen()"
          aria-controls="filterPanel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
          </svg>
          Filters
          <svg class="filter-chevron" [class.open]="filtersOpen()" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
      </div>

      <div class="row">
        <!-- Facet sidebar: always visible on md+, collapsible on mobile -->
        <div class="col-md-3">
          <div id="filterPanel" class="filter-wrap" [class.filter-wrap--open]="filtersOpen()">
          <div class="filter-inner">
          @if (!filtersLoaded()) {
            <div class="d-flex align-items-center gap-2 py-3 text-muted">
              <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading filters…</span>
              </div>
              <span class="small">Loading filters…</span>
            </div>
          }
          <div class="mb-3" [class.d-none]="!filtersLoaded()">
            <h6 class="fw-semibold">Region</h6>
            <ul class="ais-RefinementList-list">
              @for (item of regionItems(); track item.label) {
                <li class="ais-RefinementList-item"
                  [class.ais-RefinementList-item--selected]="item.isRefined"
                  [class.ais-RefinementList-item--disabled]="item.isDisabled">
                  <label class="ais-RefinementList-label">
                    <input type="checkbox" class="ais-RefinementList-checkbox"
                      [checked]="item.isRefined" [disabled]="item.isDisabled"
                      (change)="refineRegion(item.label)" />
                    <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                    <span class="ais-RefinementList-count">{{ item.count }}</span>
                  </label>
                </li>
              }
            </ul>
          </div>
          <div class="mb-3" [class.d-none]="!filtersLoaded()">
            <h6 class="fw-semibold">Type</h6>
            <ul class="ais-RefinementList-list">
              @for (item of typeItems(); track item.label) {
                <li class="ais-RefinementList-item"
                  [class.ais-RefinementList-item--selected]="item.isRefined"
                  [class.ais-RefinementList-item--disabled]="item.isDisabled">
                  <label class="ais-RefinementList-label">
                    <input type="checkbox" class="ais-RefinementList-checkbox"
                      [checked]="item.isRefined" [disabled]="item.isDisabled"
                      (change)="refineType(item.label)" />
                    <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                    <span class="ais-RefinementList-count">{{ item.count }}</span>
                  </label>
                </li>
              }
            </ul>
          </div>
          <div class="mb-3" [class.d-none]="!filtersLoaded()">
            <h6 class="fw-semibold">Phase</h6>
            <ul class="ais-RefinementList-list">
              @for (item of phaseItems(); track item.label) {
                <li class="ais-RefinementList-item"
                  [class.ais-RefinementList-item--selected]="item.isRefined"
                  [class.ais-RefinementList-item--disabled]="item.isDisabled">
                  <label class="ais-RefinementList-label">
                    <input type="checkbox" class="ais-RefinementList-checkbox"
                      [checked]="item.isRefined" [disabled]="item.isDisabled"
                      (change)="refinePhase(item.label)" />
                    <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                    <span class="ais-RefinementList-count">{{ item.count }}</span>
                  </label>
                </li>
              }
            </ul>
          </div>
          <div class="mb-3" [class.d-none]="!filtersLoaded()">
            <h6 class="fw-semibold">EA Decision</h6>
            <ul class="ais-RefinementList-list">
              @for (item of decisionItems(); track item.label) {
                <li class="ais-RefinementList-item"
                  [class.ais-RefinementList-item--selected]="item.isRefined"
                  [class.ais-RefinementList-item--disabled]="item.isDisabled">
                  <label class="ais-RefinementList-label">
                    <input type="checkbox" class="ais-RefinementList-checkbox"
                      [checked]="item.isRefined" [disabled]="item.isDisabled"
                      (change)="refineDecision(item.label)" />
                    <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                    <span class="ais-RefinementList-count">{{ item.count }}</span>
                  </label>
                </li>
              }
            </ul>
          </div>
          <div class="mb-3" [class.d-none]="!filtersLoaded()">
            <h6 class="fw-semibold">Decision Date</h6>
            <label class="control-label fw-bold" for="dateFrom">From</label>
            <lib-date-picker [control]="fromControl" [minDate]="minDate" />
            <label class="control-label fw-bold mt-2" for="dateTo">To</label>
            <lib-date-picker [control]="toControl" [minDate]="minDate" />
            @if (hasDateFilter()) {
              <button class="btn btn-link btn-sm p-0 text-secondary mt-1" (click)="clearDecisionDate()">Clear both</button>
            }
          </div>
          </div>
          </div>
        </div>

        <!-- Results table -->
        <div class="col-md-9" style="overflow-anchor: none">
          @if (isLoading()) {
            <div class="text-center py-5">
              <div class="spinner-border text-secondary" role="status">
                <span class="visually-hidden">Loading…</span>
              </div>
            </div>
          } @else if (hits().length === 0 && hasSearched()) {
            <div class="text-center text-muted py-5">No projects found.</div>
          } @else {
            <div class="d-flex flex-column">
              @for (hit of hits(); track hit.objectID) {
                <article
                  class="card search-result-card"
                  role="button"
                  tabindex="0"
                  (click)="goToProject(hit.objectID)"
                  (keyup.enter)="goToProject(hit.objectID)"
                >
                  <div class="card-body p-4">
                    <div class="d-flex flex-column flex-md-row align-items-md-center gap-4">

                      <!-- title + metadata grid -->
                      <div class="flex-grow-1">
                        <h5 class="fw-bold mb-3">{{ hit['name'] || 'Unnamed Project' }}</h5>
                        <div class="row row-cols-2 row-cols-md-5 g-2">
                          @if (hit['proponent']) {
                            <div class="col">
                              <div class="search-result-card-label">Proponent</div>
                              <div class="search-result-card-value">{{ hit['proponent'] }}</div>
                            </div>
                          }
                          @if (hit['type']) {
                            <div class="col">
                              <div class="search-result-card-label">Type</div>
                              <div class="search-result-card-value">{{ hit['type'] }}</div>
                            </div>
                          }
                          @if (hit['region']) {
                            <div class="col">
                              <div class="search-result-card-label">Region</div>
                              <div class="search-result-card-value">{{ hit['region'] }}</div>
                            </div>
                          }
                          @if (hit['currentPhaseName']) {
                            <div class="col">
                              <div class="search-result-card-label">Phase</div>
                              <div class="search-result-card-value">{{ hit['currentPhaseName'] }}</div>
                            </div>
                          }
                          @if (hit['eacDecision']) {
                            <div class="col">
                              <div class="search-result-card-label">Decision</div>
                              <div class="search-result-card-value">{{ hit['eacDecision'] }}</div>
                            </div>
                          }
                        </div>
                      </div>

                    </div>
                  </div>
                </article>
              }
            </div>
          }

          <!-- Infinite scroll sentinel: IntersectionObserver triggers showMore() -->
          <div #scrollSentinel class="py-2 text-center">
            @if (isLoadingMore()) {
              <div class="spinner-border spinner-border-sm text-secondary" role="status">
                <span class="visually-hidden">Loading more…</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filter-wrap {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .filter-wrap--open {
      grid-template-rows: 1fr;
    }
    .filter-inner {
      overflow: hidden;
    }
    @media (min-width: 768px) {
      .filter-wrap {
        grid-template-rows: 1fr;
      }
    }
  `],
})
export class TypesenseProjectSearchComponent implements AfterViewInit, OnDestroy {
  readonly heroBannerActions: HeroBannerAction[] = [{
    label: 'Search Documents',
    icon: 'search',
    routerLink: '/search',
    title: 'Search Documents',
  }];

  @ViewChild('searchBoxEl') searchBoxEl!: ElementRef;
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef;
  @ViewChild('statsEl') statsEl!: ElementRef;

  hits = signal<any[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  hasSearched = signal(false);
  hasDateFilter = signal(false);
  filtersOpen = signal(false);
  filtersLoaded = signal(false);
  regionItems = signal<DisplayItem[]>([]);
  typeItems = signal<DisplayItem[]>([]);
  phaseItems = signal<DisplayItem[]>([]);
  decisionItems = signal<DisplayItem[]>([]);

  refineRegion = (_: string) => { /* assigned by connectRefinementList */ };
  refineType = (_: string) => { /* assigned by connectRefinementList */ };
  refinePhase = (_: string) => { /* assigned by connectRefinementList */ };
  refineDecision = (_: string) => { /* assigned by connectRefinementList */ };

  private masterRegion = new Map<string, DisplayItem>();
  private masterType = new Map<string, DisplayItem>();
  private masterPhase = new Map<string, DisplayItem>();
  private masterDecision = new Map<string, DisplayItem>();

  fromControl = new FormControl<string>('');
  toControl = new FormControl<string>('');
  readonly minDate = new Date(1970, 0, 1);

  private searchInstance: ReturnType<typeof instantsearch> | null = null;
  private observer: IntersectionObserver | null = null;
  private showMore: (() => void) | null = null;
  private configureWidget: any = null;
  private subs: Subscription[] = [];
  private typesense = inject(TypesenseService);
  private router = inject(Router);
  private zone = inject(NgZone);

  constructor() {
    // Restore cached facets immediately so filters appear on back-navigation
    const restore = (attr: string, masterMap: Map<string, DisplayItem>, sig: typeof this.regionItems, sorter: (a: DisplayItem, b: DisplayItem) => number) => {
      const cached = this.typesense.getLastFacets(INDEX_NAME, attr);
      if (cached.length > 0) {
        const items = mergeItems(masterMap, cached, sorter);
        sig.set(items);
        this.filtersLoaded.set(true);
      }
    };
    restore('region', this.masterRegion, this.regionItems, sortByName);
    restore('type', this.masterType, this.typeItems, sortByName);
    restore('currentPhaseName', this.masterPhase, this.phaseItems, sortByPhaseOrder);
    restore('eacDecision', this.masterDecision, this.decisionItems, sortByName);
  }

  ngAfterViewInit(): void {
    this.searchInstance = instantsearch({
      searchClient: this.typesense.getSearchClient(SEARCH_PARAMS),
      indexName: INDEX_NAME,
    });

    const customHits = connectInfiniteHits((renderOptions: any) => {
      // results is null on the initial widget mount before the first search completes.
      // Show stale cached hits immediately so the page appears populated at once,
      // then swap in fresh results when the network responds.
      if (renderOptions.results == null) {
        const cached = this.typesense.getLastHits(INDEX_NAME);
        if (cached.length > 0) {
          this.zone.run(() => {
            this.hits.set(cached);
            this.isLoading.set(false);
          });
        }
        return;
      }
      this.zone.run(() => {
        this.typesense.setLastHits(INDEX_NAME, renderOptions.hits);
        this.hits.set([...renderOptions.hits]);
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
        this.hasSearched.set(true);
        this.showMore = renderOptions.isLastPage ? null : renderOptions.showMore;
      });
    });

    this.searchInstance.addWidgets([
      searchBox({
        container: this.searchBoxEl.nativeElement,
        placeholder: 'Search projects by name, description, proponent…',
        autofocus: false,
        showSubmit: false,
        showReset: true,
      }),
      customHits({}),
      stats({ container: this.statsEl.nativeElement }),
      connectRefinementList((renderOptions: any) => {
        this.refineRegion = renderOptions.refine;
        if (renderOptions.items.length === 0 && this.masterRegion.size > 0) return;
        this.zone.run(() => {
          this.regionItems.set(mergeItems(this.masterRegion, renderOptions.items, sortByName));
          this.filtersLoaded.set(true);
          this.typesense.setLastFacets(INDEX_NAME, 'region', renderOptions.items);
        });
      })({ attribute: 'region', operator: 'or', limit: 100 }),
      connectRefinementList((renderOptions: any) => {
        this.refineType = renderOptions.refine;
        if (renderOptions.items.length === 0 && this.masterType.size > 0) return;
        this.zone.run(() => {
          this.typeItems.set(mergeItems(this.masterType, renderOptions.items, sortByName));
          this.typesense.setLastFacets(INDEX_NAME, 'type', renderOptions.items);
        });
      })({ attribute: 'type', operator: 'or', limit: 100 }),
      connectRefinementList((renderOptions: any) => {
        this.refinePhase = renderOptions.refine;
        if (renderOptions.items.length === 0 && this.masterPhase.size > 0) return;
        this.zone.run(() => {
          this.phaseItems.set(mergeItems(this.masterPhase, renderOptions.items, sortByPhaseOrder));
          this.typesense.setLastFacets(INDEX_NAME, 'currentPhaseName', renderOptions.items);
        });
      })({ attribute: 'currentPhaseName', operator: 'or', limit: 50 }),
      connectRefinementList((renderOptions: any) => {
        this.refineDecision = renderOptions.refine;
        if (renderOptions.items.length === 0 && this.masterDecision.size > 0) return;
        this.zone.run(() => {
          this.decisionItems.set(mergeItems(this.masterDecision, renderOptions.items, sortByName));
          this.typesense.setLastFacets(INDEX_NAME, 'eacDecision', renderOptions.items);
        });
      })({ attribute: 'eacDecision', operator: 'or', limit: 100 }),
      (this.configureWidget = configure(SEARCH_PARAMS)),
    ]);

    this.searchInstance.start();

    // Set up IntersectionObserver after search starts so the sentinel is in the DOM
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.showMore) {
        this.isLoadingMore.set(true);
        this.showMore();
      }
    }, { rootMargin: '200px' });
    this.observer.observe(this.scrollSentinel.nativeElement);

    const onDateChange = () => {
      this.hasDateFilter.set(!!(this.fromControl.value || this.toControl.value));
      this.applyDecisionDateFilter();
    };
    this.subs.push(
      this.fromControl.valueChanges.subscribe(onDateChange),
      this.toControl.valueChanges.subscribe(onDateChange),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.observer?.disconnect();
    this.searchInstance?.dispose();
  }

  goToProject(id: string): void {
    if (id) {
      this.router.navigate([`p/${id}/project-details`]);
    }
  }

  private applyDecisionDateFilter(): void {
    if (!this.searchInstance || !this.configureWidget) return;
    const from = this.fromControl.value;
    const to   = this.toControl.value;
    const numericFilters: string[] = [];
    if (from) numericFilters.push(`decisionDate>=${this.dateInputToTs(from)}`);
    if (to)   numericFilters.push(`decisionDate<=${this.dateInputToTs(to, true)}`);
    this.searchInstance.removeWidgets([this.configureWidget]);
    this.configureWidget = configure({
      ...SEARCH_PARAMS,
      ...(numericFilters.length ? { numericFilters } : {}),
    });
    this.searchInstance.addWidgets([this.configureWidget]);
  }

  clearDecisionDate(): void {
    this.fromControl.setValue('');
    this.toControl.setValue('');
  }

  /** Convert a YYYY-MM-DD string to a Unix timestamp in seconds (start of day UTC). */
  private dateInputToTs(isoStr: string, endOfDay = false): number {
    return Math.floor(new Date(isoStr + 'T00:00:00Z').getTime() / 1000) + (endOfDay ? 86399 : 0);
  }
}
