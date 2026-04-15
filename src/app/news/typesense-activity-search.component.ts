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
  WritableSignal,
} from '@angular/core';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { ActivityCardComponent } from 'app/shared/components/activity-card/activity-card.component';
import instantsearch from 'instantsearch.js';
import { searchBox, stats, configure } from 'instantsearch.js/es/widgets';
import { connectInfiniteHits, connectRefinementList } from 'instantsearch.js/es/connectors';
import { TypesenseService } from 'app/services/typesense.service';

const INDEX_NAME = 'activities';

const SEARCH_PARAMS = {
  query_by:         'headline,content,notificationName',
  query_by_weights: '9000,8000,3000',
  sort_by:          'pinned:desc,dateAdded:desc',
  hitsPerPage:      20,
} as const;

const SORT_OPTIONS = [
  { label: 'Pinned First',  value: 'pinned:desc,dateAdded:desc' },
  { label: 'Newest First',  value: 'dateAdded:desc' },
  { label: 'Relevance',     value: '_text_match:desc,dateAdded:desc' },
] as const;

interface DisplayItem {
  label: string;
  count: number;
  isRefined: boolean;
  isDisabled: boolean;
}

/**
 * Converts a Typesense activities hit into the rowData shape expected by
 * ActivityCardComponent. Handles date conversion and project object assembly.
 */
function hitToRowData(hit: any): any {
  // Use Typesense highlighted versions (matched terms wrapped in <mark>) when available.
  // _highlightResult is populated by the InstantSearch adapter for all indexed fields.
  const hl = hit['_highlightResult'] ?? {};
  return {
    _id:          hit['id'],
    headline:     hl['headline']?.value ?? hit['headline'] ?? '',
    content:      hl['content']?.value ?? hit['contentHtml'] ?? hit['content'] ?? '',
    dateAdded:    hit['dateAdded'] ? new Date(hit['dateAdded'] * 1000) : null,
    type:         hit['type']     ?? null,
    project:      hit['projectId']
      ? { _id: hit['projectId'], name: hit['projectName'] ?? '' }
      : null,
    notificationName: hit['notificationName'] ?? null,
    documentUrl:  hit['documentUrl'] ?? null,
    contentUrl:   hit['contentUrl']  ?? null,
    active:       hit['active']  ?? true,
    pinned:       hit['pinned']  ?? false,
    complianceAndEnforcement: hit['complianceAndEnforcement'] ?? false,
    // pcp not stored in Typesense — "View Engagement" button will not render
    pcp:          null,
  };
}

function mergeItems(
  masterMap: Map<string, DisplayItem>,
  newItems: { label: string; count: number; isRefined: boolean }[],
): DisplayItem[] {
  for (const [key, item] of masterMap) {
    masterMap.set(key, { ...item, count: 0, isDisabled: !item.isRefined });
  }
  for (const item of newItems) {
    masterMap.set(item.label, { label: item.label, count: item.count, isRefined: item.isRefined, isDisabled: false });
  }
  return Array.from(masterMap.values()).sort((a, b) => a.label.localeCompare(b.label));
}

@Component({
  selector: 'app-typesense-activity-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBannerComponent, ActivityCardComponent],
  template: `
    <app-hero-banner
      title="News and Updates"
      description="Search news and updates from Environmental Assessment projects."
      backgroundImage="/assets/images/hero-banner.jpg"
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
          aria-controls="activityFilterPanel"
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
          <div id="activityFilterPanel" class="filter-wrap" [class.filter-wrap--open]="filtersOpen()">
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
            <h6 class="fw-semibold">Activity Type</h6>
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
            <h6 class="fw-semibold">Sort</h6>
            @for (opt of sortOptions; track opt.value) {
              <div class="form-check">
                <input
                  class="form-check-input" type="radio" name="activitySort"
                  [id]="'sort-' + opt.value"
                  [value]="opt.value"
                  [checked]="activeSortValue() === opt.value"
                  (change)="applySort(opt.value)"
                />
                <label class="form-check-label small" [for]="'sort-' + opt.value">{{ opt.label }}</label>
              </div>
            }
          </div>

          </div>
          </div>
        </div>

        <!-- Results -->
        <div class="col-md-9" style="overflow-anchor: none">
          @if (isLoading()) {
            <div class="text-center py-5">
              <div class="spinner-border text-secondary" role="status">
                <span class="visually-hidden">Loading…</span>
              </div>
            </div>
          } @else if (hits().length === 0 && hasSearched()) {
            <div class="text-center text-muted py-5">No news items found.</div>
          } @else {
            <table class="table">
              <tbody>
                @for (hit of hits(); track hit.objectID) {
                  <tr app-activity-card [rowData]="hitToRowData(hit)"></tr>
                }
              </tbody>
            </table>
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
    .filter-toggle-btn {
      background-color: transparent;
      border: 1px solid #dee2e6;
    }
    .filter-toggle-btn--open {
      background-color: rgba(var(--bs-primary-rgb), 0.08);
    }
    .filter-chevron {
      transition: transform 200ms ease;
    }
    .filter-chevron.open {
      transform: rotate(180deg);
    }
  `],
})
export class TypesenseActivitySearchComponent implements AfterViewInit, OnDestroy {
  @ViewChild('searchBoxEl')    searchBoxEl!: ElementRef;
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef;
  @ViewChild('statsEl')        statsEl!: ElementRef;

  hits          = signal<any[]>([]);
  isLoading     = signal(true);
  isLoadingMore = signal(false);
  hasSearched   = signal(false);
  filtersOpen   = signal(false);
  filtersLoaded = signal(false);
  activeSortValue = signal<string>(SEARCH_PARAMS.sort_by);

  typeItems: WritableSignal<DisplayItem[]> = signal([]);
  private typeMasterMap = new Map<string, DisplayItem>();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private refineFn: (v: string) => void = () => {};

  readonly sortOptions = SORT_OPTIONS;
  readonly hitToRowData = hitToRowData;

  private searchInstance: ReturnType<typeof instantsearch> | null = null;
  private observer: IntersectionObserver | null = null;
  private showMore: (() => void) | null = null;

  private typesense = inject(TypesenseService);
  private zone      = inject(NgZone);

  constructor() {
    const cached = this.typesense.getLastFacets(INDEX_NAME, 'type');
    if (cached.length > 0) {
      this.typeItems.set(mergeItems(this.typeMasterMap, cached));
      this.filtersLoaded.set(true);
    }
  }

  ngAfterViewInit(): void {
    this.initSearch(SEARCH_PARAMS.sort_by);
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  refineType(value: string): void {
    this.refineFn(value);
  }

  applySort(sortBy: string): void {
    if (sortBy === this.activeSortValue()) return;
    this.activeSortValue.set(sortBy);
    // sort_by is fixed at adapter construction time — must rebuild search instance
    // with a new adapter that has the updated sort_by in additionalSearchParameters.
    this.teardown();
    this.isLoading.set(true);
    this.hasSearched.set(false);
    this.initSearch(sortBy);
  }

  private teardown(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.searchInstance?.dispose();
    this.searchInstance = null;
    this.showMore = null;
  }

  private initSearch(sortBy: string): void {
    const searchParams = { ...SEARCH_PARAMS, sort_by: sortBy };

    this.searchInstance = instantsearch({
      searchClient: this.typesense.getSearchClient(searchParams),
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

    const customType = connectRefinementList((renderOptions: any) => {
      this.refineFn = renderOptions.refine;
      if (renderOptions.items.length === 0 && this.typeMasterMap.size > 0) return;
      this.zone.run(() => {
        this.typeItems.set(mergeItems(this.typeMasterMap, renderOptions.items));
        this.filtersLoaded.set(true);
        this.typesense.setLastFacets(INDEX_NAME, 'type', renderOptions.items);
      });
    });

    this.searchInstance.addWidgets([
      searchBox({
        container: this.searchBoxEl.nativeElement,
        placeholder: 'Search news by headline, content, project…',
        autofocus: false,
        showSubmit: false,
        showReset: true,
      }),
      customHits({}),
      stats({ container: this.statsEl.nativeElement }),
      customType({ attribute: 'type', operator: 'or', limit: 50 }),
      configure({ hitsPerPage: SEARCH_PARAMS.hitsPerPage }),
    ]);

    this.searchInstance.start();

    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.showMore) {
        this.isLoadingMore.set(true);
        this.showMore();
      }
    }, { rootMargin: '200px' });
    this.observer.observe(this.scrollSentinel.nativeElement);
  }
}
