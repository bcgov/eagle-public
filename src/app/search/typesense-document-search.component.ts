import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  NgZone,
  ChangeDetectionStrategy,
  WritableSignal,
  Signal,
} from '@angular/core';
import { HeroBannerComponent, HeroBannerAction } from 'app/shared/hero-banner/hero-banner.component';
import instantsearch from 'instantsearch.js';
import { searchBox, stats, configure } from 'instantsearch.js/es/widgets';
import { connectInfiniteHits, connectRefinementList } from 'instantsearch.js/es/connectors';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatePickerComponent } from 'app/shared/components/date-picker/date-picker.component';
import { TypesenseService } from 'app/services/typesense.service';
import { ConfigService } from 'app/services/config.service';

const INDEX_NAME = 'documents';

const SEARCH_PARAMS = {
  query_by: 'displayName,documentFileName,description,projectName',
  query_by_weights: '8500,5000,8000,3000',
  hitsPerPage: 20,
} as const;

interface DisplayItem {
  label: string;
  count: number;
  isRefined: boolean;
  isDisabled: boolean;
}

interface LegislationGroup {
  year: number;
  heading: string; // e.g. "2018 Act Terms", "" for ungrouped
  items: DisplayItem[];
}

const LEG_ORDER = [2002, 2018, 1996];

function groupByLegislation(
  items: DisplayItem[],
  lookup: Map<string, number>,
  sorter: (a: DisplayItem, b: DisplayItem) => number = sortByName,
): LegislationGroup[] {
  const buckets = new Map<number, DisplayItem[]>();
  for (const item of items) {
    const year = lookup.get(item.label) ?? 0;
    if (!buckets.has(year)) buckets.set(year, []);
    buckets.get(year)!.push(item);
  }
  for (const list of buckets.values()) list.sort(sorter);

  const result: LegislationGroup[] = [];
  for (const year of LEG_ORDER) {
    if (buckets.has(year)) {
      result.push({ year, heading: `${year} Act Terms`, items: buckets.get(year)! });
      buckets.delete(year);
    }
  }
  // Any remaining years not in preferred order
  for (const [year, list] of buckets.entries()) {
    const heading = year > 0 ? `${year} Act Terms` : '';
    result.push({ year, heading, items: list });
  }
  return result;
}

const sortByName = (a: DisplayItem, b: DisplayItem): number => a.label.localeCompare(b.label);

/**
 * Canonical project phase order (2002 Act first, then 2018 Act).
 * Mirrors PHASE_ORDER in typesense-search.component.ts (project list).
 */
const PHASE_ORDER: string[] = [
  // 2002 Act
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
  // 2018 Act
  'Project Designation',
  'Early Engagement',
  'Readiness Decision',
  'Process Planning',
  'Application Development and Review',
  'Effects Assessment',
  'Complete',
  'Other',
];

function sortByPhaseOrder(a: DisplayItem, b: DisplayItem): number {
  const ai = PHASE_ORDER.indexOf(a.label);
  const bi = PHASE_ORDER.indexOf(b.label);
  if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

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

interface FacetDef {
  attribute: string;
  heading: string;
  listType: string;
  sorter: (a: DisplayItem, b: DisplayItem) => number;
}

const FACET_DEFS: FacetDef[] = [
  { attribute: 'type',               heading: 'Type',         listType: 'doctype',      sorter: sortByName },
  { attribute: 'milestone',          heading: 'Milestone',    listType: 'label',        sorter: sortByName },
  { attribute: 'documentAuthorType', heading: 'Author Type',  listType: 'author',       sorter: sortByName },
  { attribute: 'projectPhase',       heading: 'Project Phase', listType: 'projectPhase', sorter: sortByPhaseOrder },
];

@Component({
  selector: 'app-typesense-document-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBannerComponent, DatePipe, DatePickerComponent, ReactiveFormsModule],
  template: `
    <app-hero-banner
      title="Search All Documents"
      description="Search through all documents from the Environmental Assessment Office. Click on a project name to view the project details page, or click the download button to download a document."
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
          aria-controls="docFilterPanel"
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
        <!-- Facet sidebar -->
        <div class="col-md-3">
          <div id="docFilterPanel" class="filter-wrap" [class.filter-wrap--open]="filtersOpen()">
          <div class="filter-inner">
          @if (!filtersLoaded()) {
            <div class="d-flex align-items-center gap-2 py-3 text-muted">
              <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading filters…</span>
              </div>
              <span class="small">Loading filters…</span>
            </div>
          }

          @for (facet of facetDefs; track facet.attribute) {
            <div class="mb-3" [class.d-none]="!filtersLoaded()">
              <h6 class="fw-semibold">{{ facet.heading }}</h6>
              @for (group of grouped[facet.attribute](); track group.year) {
                @if (group.heading) {
                  <small class="d-block text-muted fw-semibold mt-2 mb-1 legislation-heading">{{ group.heading }}</small>
                }
                <ul class="ais-RefinementList-list">
                  @for (item of group.items; track item.label) {
                    <li class="ais-RefinementList-item"
                      [class.ais-RefinementList-item--selected]="item.isRefined"
                      [class.ais-RefinementList-item--disabled]="item.isDisabled">
                      <label class="ais-RefinementList-label">
                        <input type="checkbox" class="ais-RefinementList-checkbox"
                          [checked]="item.isRefined" [disabled]="item.isDisabled"
                          (change)="refine(facet.attribute, item.label)" />
                        <span class="ais-RefinementList-labelText">{{ item.label }}</span>
                        <span class="ais-RefinementList-count">{{ item.count }}</span>
                      </label>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          <div class="mb-3" [class.d-none]="!filtersLoaded()">
            <h6 class="fw-semibold">Date Posted</h6>
            <label class="control-label fw-bold" for="docDateFrom">From</label>
            <lib-date-picker [control]="fromControl" [minDate]="minDate" />
            <label class="control-label fw-bold mt-2" for="docDateTo">To</label>
            <lib-date-picker [control]="toControl" [minDate]="minDate" />
            @if (hasDateFilter()) {
              <button class="btn btn-link btn-sm p-0 text-secondary mt-1" (click)="clearDateFilter()">Clear both</button>
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
            <div class="text-center text-muted py-5">No documents found.</div>
          } @else {
            <div class="d-flex flex-column">
              @for (hit of hits(); track hit.objectID) {
                <article class="card search-result-card">
                  <div class="card-body p-4">
                    <div class="d-flex flex-column flex-md-row gap-3">
                      <div class="flex-fill">
                        <div class="d-flex flex-column gap-2">
                          <h5 class="fw-bold mb-0">{{ hit['displayName'] || hit['documentFileName'] || 'Untitled Document' }}</h5>
                          @if (hit['documentFileName'] && hit['documentFileName'] !== hit['displayName']) {
                            <div class="text-muted small">{{ hit['documentFileName'] }}</div>
                          }
                          <div class="row row-cols-2 row-cols-md-4 g-2 mt-1">
                            @if (hit['projectName']) {
                              <div class="col">
                                <div class="search-result-card-label">Project</div>
                                <div class="search-result-card-value">{{ hit['projectName'] }}</div>
                              </div>
                            }
                            @if (hit['type']) {
                              <div class="col">
                                <div class="search-result-card-label">Type</div>
                                <div class="search-result-card-value">{{ hit['type'] }}</div>
                              </div>
                            }
                            @if (hit['milestone']) {
                              <div class="col">
                                <div class="search-result-card-label">Milestone</div>
                                <div class="search-result-card-value">{{ hit['milestone'] }}</div>
                              </div>
                            }
                            @if (hit['datePosted']) {
                              <div class="col">
                                <div class="search-result-card-label">Date Posted</div>
                                <div class="search-result-card-value">{{ hit['datePosted'] * 1000 | date:'yyyy-MM-dd' }}</div>
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                      <div class="search-result-action">
                        <a
                          class="search-dl-btn"
                          [href]="'/api/document/' + hit['id'] + '/fetch'"
                          target="_blank"
                          rel="noopener noreferrer"
                          (click)="$event.stopPropagation()"
                        >Download</a>
                        @if (hit['projectId']) {
                          <a
                            class="search-dl-btn mt-2"
                            [href]="'/p/' + hit['projectId']"
                            (click)="$event.stopPropagation()"
                          >Go to Project</a>
                        }
                      </div>
                    </div>
                  </div>
                </article>
              }
            </div>
          }

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
    .legislation-heading {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-top: 1px solid #dee2e6;
      padding-top: 0.4rem;
    }
    .search-result-action {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      padding-top: 1rem;
      border-top: 1px solid #dee2e6;
    }
    @media (min-width: 768px) {
      .search-result-action {
        padding-top: 0;
        padding-left: 1.25rem;
        border-top: none;
        border-left: 1px solid #dee2e6;
      }
    }
    .search-dl-btn {
      display: inline-block;
      padding: 0.5rem 1.25rem;
      border-radius: 0.5rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      text-decoration: none;
      text-align: center;
      background-color: rgba(var(--bs-primary-rgb), 0.1);
      color: var(--bs-primary);
      border: none;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .search-dl-btn:hover {
      background-color: var(--bs-primary);
      color: #fff;
    }
  `],
})
export class TypesenseDocumentSearchComponent implements AfterViewInit, OnDestroy {
  readonly heroBannerActions: HeroBannerAction[] = [{
    label: 'Search Projects',
    icon: 'search',
    routerLink: '/projects-list',
    title: 'Search Projects',
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

  readonly facetDefs = FACET_DEFS;

  private readonly facetItems: Record<string, WritableSignal<DisplayItem[]>> = Object.fromEntries(
    FACET_DEFS.map(f => [f.attribute, signal<DisplayItem[]>([])])
  );
  private readonly lawLookups: Record<string, WritableSignal<Map<string, number>>> = Object.fromEntries(
    FACET_DEFS.map(f => [f.attribute, signal(new Map<string, number>())])
  );
  private readonly facetMasters: Record<string, Map<string, DisplayItem>> = Object.fromEntries(
    FACET_DEFS.map(f => [f.attribute, new Map()])
  );
  private readonly refineFns: Record<string, (v: string) => void> = Object.fromEntries(
    FACET_DEFS.map(f => [f.attribute, (_: string) => { /* assigned by connectRefinementList */ }])
  );
  readonly grouped: Record<string, Signal<LegislationGroup[]>> = Object.fromEntries(
    FACET_DEFS.map(f => [
      f.attribute,
      computed(() => groupByLegislation(this.facetItems[f.attribute](), this.lawLookups[f.attribute](), f.sorter)),
    ])
  );

  fromControl = new FormControl<string>('');
  toControl = new FormControl<string>('');
  readonly minDate = new Date(1970, 0, 1);

  private searchInstance: ReturnType<typeof instantsearch> | null = null;
  private observer: IntersectionObserver | null = null;
  private showMore: (() => void) | null = null;
  private configureWidget: any = null;
  private subs: Subscription[] = [];
  private typesense = inject(TypesenseService);
  private configService = inject(ConfigService);
  private zone = inject(NgZone);

  constructor() {
    for (const f of FACET_DEFS) {
      const cached = this.typesense.getLastFacets(INDEX_NAME, f.attribute);
      if (cached.length > 0) {
        this.facetItems[f.attribute].set(mergeItems(this.facetMasters[f.attribute], cached, f.sorter));
        this.filtersLoaded.set(true);
      }
    }
  }

  ngAfterViewInit(): void {
    this.searchInstance = instantsearch({
      searchClient: this.typesense.getSearchClient(SEARCH_PARAMS),
      indexName: INDEX_NAME,
    });

    const customHits = connectInfiniteHits((renderOptions: any) => {
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
        placeholder: 'Search documents by name, file name, project…',
        autofocus: false,
        showSubmit: false,
        showReset: true,
      }),
      customHits({}),
      stats({ container: this.statsEl.nativeElement }),
      ...FACET_DEFS.map(f =>
        connectRefinementList((renderOptions: any) => {
          this.refineFns[f.attribute] = renderOptions.refine;
          if (renderOptions.items.length === 0 && this.facetMasters[f.attribute].size > 0) return;
          this.zone.run(() => {
            this.facetItems[f.attribute].set(mergeItems(this.facetMasters[f.attribute], renderOptions.items, f.sorter));
            this.filtersLoaded.set(true);
            this.typesense.setLastFacets(INDEX_NAME, f.attribute, renderOptions.items);
          });
        })({ attribute: f.attribute, operator: 'or', limit: 100 })
      ),
      (this.configureWidget = configure(SEARCH_PARAMS)),
    ]);

    this.searchInstance.start();

    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.showMore) {
        this.isLoadingMore.set(true);
        this.showMore();
      }
    }, { rootMargin: '200px' });
    this.observer.observe(this.scrollSentinel.nativeElement);

    const onDateChange = () => {
      this.hasDateFilter.set(!!(this.fromControl.value || this.toControl.value));
      this.applyDateFilter();
    };
    this.subs.push(
      this.fromControl.valueChanges.subscribe(onDateChange),
      this.toControl.valueChanges.subscribe(onDateChange),
      this.configService.lists.subscribe((lists: any[]) => {
        for (const f of FACET_DEFS) {
          const m = new Map<string, number>();
          lists.filter(l => l.type === f.listType).forEach(l => m.set(l.name, l.legislation || 0));
          this.lawLookups[f.attribute].set(m);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.observer?.disconnect();
    this.searchInstance?.dispose();
  }

  clearDateFilter(): void {
    this.fromControl.setValue('');
    this.toControl.setValue('');
  }

  refine(attribute: string, value: string): void {
    this.refineFns[attribute]?.(value);
  }

  private applyDateFilter(): void {
    if (!this.searchInstance || !this.configureWidget) return;
    const from = this.fromControl.value;
    const to   = this.toControl.value;
    const numericFilters: string[] = [];
    if (from) numericFilters.push(`datePosted>=${this.dateInputToTs(from)}`);
    if (to)   numericFilters.push(`datePosted<=${this.dateInputToTs(to, true)}`);
    this.searchInstance.removeWidgets([this.configureWidget]);
    this.configureWidget = configure({
      ...SEARCH_PARAMS,
      ...(numericFilters.length ? { numericFilters } : {}),
    });
    this.searchInstance.addWidgets([this.configureWidget]);
  }

  private dateInputToTs(isoStr: string, endOfDay = false): number {
    return Math.floor(new Date(isoStr + 'T00:00:00Z').getTime() / 1000) + (endOfDay ? 86399 : 0);
  }
}
