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
  OnDestroy,
} from '@angular/core';
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
import { SearchParamObject } from '../../services/search.service';
import { IColumnObject, TableObject } from '../../shared/components/table-template/table-object';
import { DocumentTableRowsComponent } from './project-document-table-rows/project-document-table-rows.component';
import { DateFilterDefinition, FilterObject, FilterType, MultiSelectDefinition } from '../../shared/components/search-filter-template/filter-object';
import { TableTemplateComponent } from '../../shared/components/table-template/table-template.component';
import { SearchFilterTemplateComponent } from '../../shared/components/search-filter-template/search-filter-template.component';
import { ITableMessage } from '../../shared/components/table-template/table-row-component';
import { LoggingService } from '../../services/logging.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { TypesenseService } from '../../services/typesense.service';
import { ProjectDocumentTabBase } from '../shared/project-document-tab-base';
import { SearchDocumentCardComponent } from '../../search/cards/search-document-card.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import {
  COLLECTIONS,
  DisplayItem,
  LegislationGroup,
  mergeItems,
  groupByLegislation,
  isoToUnixTimestamp,
} from '../../search/search-collections';

@Component({
  selector: 'app-documents',
  templateUrl: './documents-tab.component.html',
  imports: [
    TableTemplateComponent,
    SearchFilterTemplateComponent,
    SearchDocumentCardComponent,
    DatePickerComponent,
    ReactiveFormsModule,
  ],
  styles: [`
    .filter-wrap {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .filter-wrap--open { grid-template-rows: 1fr; }
    .filter-inner { overflow: hidden; }
    .filter-inner-pad { padding-bottom: 0.5rem; }
    .ts-body-row {
      display: flex;
      flex-direction: column; /* mobile: sidebar stacks above results */
    }
    /* min-height and position:relative come from global .ts-results-col in instantsearch.css */
    @media (min-width: 768px) {
      .filter-wrap { grid-template-rows: 1fr; }
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        padding-top: 1rem;
      }
      .ts-body-row {
        flex-direction: row;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        flex-wrap: nowrap;
      }
      .ts-results-col {
        flex: 1;
        height: 100%;
        overflow-y: auto;
        min-width: 0;
        min-height: 300px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsTabComponent extends ProjectDocumentTabBase implements OnDestroy {
  private readonly logger = inject(LoggingService);
  private readonly analytics = inject(AnalyticsService);
  private readonly typesense = inject(TypesenseService);
  private readonly zone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();

  // ── MongoDB fallback state ─────────────────────────────────────────────────
  protected readonly tableId = 'documentsTab';
  protected readonly filtersList = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
  protected readonly dateFiltersList = ['datePostedStart', 'datePostedEnd'];
  protected override readonly showFeatured: boolean = true;

  private readonly milestoneArray: any[] = [];
  private readonly documentAuthorTypeArray: any[] = [];
  private readonly documentTypeArray: any[] = [];
  private readonly projectPhaseArray: any[] = [];
  private readonly legislationFilterGroup = { name: 'legislation', labelPrefix: '', labelPostfix: ' Act Terms' };

  public override readonly showAdvancedFilters = signal(false);
  public readonly filters = signal<FilterObject[]>([]);
  public readonly tableData = signal<TableObject>(new TableObject({
    component: DocumentTableRowsComponent,
    sortBy: '-datePosted'
  }));

  public readonly tableColumns: IColumnObject[] = [
    { name: '★',         value: 'isFeatured',   width: 'col-1' },
    { name: 'Name',      value: 'displayName',  width: 'col-3' },
    { name: 'Date',      value: 'datePosted',   width: 'col-2' },
    { name: 'Type',      value: 'type',         width: 'col-2' },
    { name: 'Milestone', value: 'milestone',    width: 'col-2' },
    { name: 'Phase',     value: 'projectPhase', width: 'col-2' },
  ];

  // ── Typesense path ─────────────────────────────────────────────────────────
  isTypesense = computed(() => !!this.configService.config().TYPESENSE_ENABLED);

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

  sidebarCollapsed = signal(localStorage.getItem('docTabSidebarCollapsed') !== 'false');

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem('docTabSidebarCollapsed', String(next));
  }

  activeFilterCount = computed(() => {
    const col = COLLECTIONS.documents;
    let count = 0;
    for (const f of col.facets) {
      count += (this.tsFacetItems[f.attribute]?.() ?? []).filter(i => i.isRefined).length;
    }
    if (this.tsFromCtrl.value || this.tsToCtrl.value) count++;
    return count;
  });

  tsFacetItems: Record<string, WritableSignal<DisplayItem[]>>         = {};
  private tsMasterMaps: Record<string, Map<string, DisplayItem>>      = {};
  tsRefineFns:  Record<string, (v: string) => void>                   = {};
  tsLawLookups: Record<string, WritableSignal<Map<string, number>>>   = {};

  tsGroupedSnapshot = computed((): Record<string, LegislationGroup[]> => {
    const col = COLLECTIONS.documents;
    const snap: Record<string, LegislationGroup[]> = {};
    for (const f of col.facets) {
      snap[f.attribute] = f.grouped
        ? groupByLegislation(this.tsFacetItems[f.attribute]?.() ?? [], this.tsLawLookups[f.attribute]?.() ?? new Map(), f.sorter)
        : [];
    }
    return snap;
  });

  private tsShowMore: (() => void) | null = null;
  private tsSearchBoxRefine: ((q: string) => void) | null = null;
  private tsIs: ReturnType<typeof instantsearch> | null = null;
  private tsConfigWidget: any = null;
  private tsSentinelObserver: IntersectionObserver | null = null;
  private tsResultsColEl: HTMLElement | null = null;
  private tsDateSubs: Subscription[] = [];
  private tsKeywordInput$ = new Subject<string>();
  private tsInitDone = false;

  readonly tsDocCol = COLLECTIONS.documents;
  readonly tsMinDate = new Date(1970, 0, 1);

  @ViewChild('tsSentinel')
  set tsSentinel(el: ElementRef | undefined) {
    if (el?.nativeElement) this.tsSetupObserver(el.nativeElement);
  }

  @ViewChild('tsResultsCol')
  set tsResultsCol(el: ElementRef | undefined) {
    this.tsResultsColEl = el?.nativeElement ?? null;
  }

  constructor() {
    super();
    this.projId = this.route.parent?.snapshot.params['projId'] || '';
    this.logger.debug(`Documents tab projId: ${this.projId}`, 'DocumentsTabComponent');
    this.tableService.clearTable(this.tableId);

    // Init facet signal maps
    const col = COLLECTIONS.documents;
    for (const f of col.facets) {
      this.tsFacetItems[f.attribute]  = signal<DisplayItem[]>([]);
      this.tsMasterMaps[f.attribute]  = new Map();
      this.tsRefineFns[f.attribute]   = (_: string) => { /* noop until IS initialised */ };
      this.tsLawLookups[f.attribute]  = signal(new Map<string, number>());
    }

    // Keyword debounce pipeline
    this.tsKeywordInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(kw => {
      this.tsSearchBoxRefine?.(kw || '');
    });

    this.setup();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.tsTeardown();
  }

  // Called by base-class setup() after lists are loaded AND query params fire
  protected initListData(list: any[]): void {
    list.forEach(item => {
      if (item.type === 'label') {
        this.milestoneArray.push({ ...item });
      } else if (item.type === 'author') {
        this.documentAuthorTypeArray.push({ ...item });
      } else if (item.type === 'doctype') {
        this.documentTypeArray.push({ ...item });
      } else if (item.type === 'projectPhase') {
        this.projectPhaseArray.push({ ...item });
      }
    });
    this.setMongoFilters();

    // Start Typesense once lists are loaded (legislation lookup needed)
    if (this.isTypesense() && !this.tsInitDone) {
      this.tsInitDone = true;
      this.tsInitCollection(list);
    }
  }

  protected fetchDataWithCurrentParams(): void {
    if (this.isTypesense()) return; // Typesense path handles its own data

    const updated = this.readCurrentParams();
    this.logger.debug(`Fetching documents with projId: ${this.projId}`, 'DocumentsTabComponent', {
      currentPage: updated.currentPage,
      pageSize: updated.pageSize,
      sortBy: updated.sortBy,
      filters: this.buildFilters()
    });
    this.tableService.fetchData(new SearchParamObject(
      this.tableId,
      this.queryParams['keywords'] || '',
      'Document',
      [],
      updated.currentPage,
      updated.pageSize,
      updated.sortBy,
      { project: this.projId },
      true,
      updated.sortBy.includes('displayName') ? '' : '+displayName',
      this.buildFilters()
    ));
  }

  // ── Typesense: init ────────────────────────────────────────────────────────

  private tsInitCollection(lists: any[]): void {
    const col = COLLECTIONS.documents;

    // Populate legislation lookup from lists metadata
    for (const f of col.facets) {
      if (!f.listType) continue;
      const m = new Map<string, number>();
      lists.filter(l => l.type === f.listType).forEach(l => m.set(l.name, l.legislation || 0));
      this.tsLawLookups[f.attribute].set(m);
    }

    this.tsIs = instantsearch({
      searchClient: this.typesense.getSearchClient({
        query_by:         col.queryBy,
        query_by_weights: col.queryByWeights,
        filter_by:        `projectId:${this.projId}`,
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
      if (rs.results == null) {
        // Don't show stale/cross-context cache — project filter makes stale hits wrong.
        return;
      }
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
        this.analytics.track('Document Search Performed', {
          query: normQ,
          project_id: this.projId,
          nb_hits: (rs.results?.nbHits as number) ?? 0,
        });
      });
    });

    const widgets: any[] = [customSearchBox({}), customStats({}), customHits({})];

    for (const f of col.facets) {
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

    this.tsConfigWidget = configure({ hitsPerPage: col.hitsPerPage });
    widgets.push(this.tsConfigWidget);

    this.tsIs.addWidgets(widgets);
    // Clear any stale hits (e.g. from unified search) before starting so they
    // never flash into this project-scoped view.
    this.typesense.setLastHits(col.indexName, []);
    this.tsIs.start();

    this.tsIs.on('error', () => {
      this.zone.run(() => { this.tsLoading.set(false); this.tsHasError.set(true); });
    });

    // Date range subscriptions
    const onDateChange = (filterType: 'from' | 'to') => (v: string | null) => {
      this.tsHasDateFilter.set(!!(this.tsFromCtrl.value || this.tsToCtrl.value));
      this.tsApplyDateFilter();
      if (v) this.analytics.track('Document Date Filter Applied', { filter_type: filterType, date_value: v, project_id: this.projId });
    };
    this.tsDateSubs.push(
      this.tsFromCtrl.valueChanges.subscribe(onDateChange('from')),
      this.tsToCtrl.valueChanges.subscribe(onDateChange('to')),
    );

    // Live legislation lookup updates
    this.tsDateSubs.push(
      this.configService.lists.subscribe(updatedLists => {
        for (const f of col.facets) {
          if (!f.listType) continue;
          const m = new Map<string, number>();
          updatedLists.filter((l: any) => l.type === f.listType).forEach((l: any) => m.set(l.name, l.legislation || 0));
          this.tsLawLookups[f.attribute].set(m);
        }
      })
    );
  }

  private tsApplyDateFilter(): void {
    if (!this.tsIs || !this.tsConfigWidget) return;
    const col = COLLECTIONS.documents;
    const df = col.dateFacet;
    if (!df) return;
    const from = this.tsFromCtrl.value, to = this.tsToCtrl.value;
    const nf: string[] = [];
    if (from) nf.push(`${df.field}>=${this.tsTimestamp(from)}`);
    if (to)   nf.push(`${df.field}<=${this.tsTimestamp(to, true)}`);
    this.tsIs.removeWidgets([this.tsConfigWidget]);
    this.tsConfigWidget = configure({ hitsPerPage: col.hitsPerPage, ...(nf.length ? { numericFilters: nf } : {}) });
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
    this.tsDateSubs.forEach(s => s.unsubscribe());
    this.tsDateSubs = [];
  }

  private tsTimestamp = isoToUnixTimestamp;

  // ── Typesense: public handlers ─────────────────────────────────────────────

  onTsInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.tsKeywords.set(value);
    this.tsKeywordInput$.next(value);
  }

  clearTsSearch(): void {
    this.tsKeywords.set('');
    this.tsKeywordInput$.next('');
  }

  onTsDownload(hit: any): void {
    this.analytics.track('Document Download Clicked', {
      document_id: hit['id'] ?? hit['objectID'],
      document_name: hit['displayName'] ?? hit['documentFileName'] ?? 'Unknown',
      project_id: this.projId,
    });
  }

  refineTsFacet(attribute: string, label: string): void {
    this.tsRefineFns[attribute]?.(label);
    this.analytics.track('Document Filter Applied', { facet_attribute: attribute, facet_value: label, project_id: this.projId });
  }

  clearTsDateFilter(): void {
    this.tsFromCtrl.setValue('');
    this.tsToCtrl.setValue('');
  }

  // ── MongoDB fallback handlers ──────────────────────────────────────────────

  private setMongoFilters(): void {
    this.filters.set([
      new FilterObject(
        'issuedDate', FilterType.DateRange, '',
        new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
        8
      ),
      new FilterObject(
        'milestone', FilterType.MultiSelect, 'Milestone',
        new MultiSelectDefinition(this.milestoneArray, [], this.legislationFilterGroup, null, true),
        4
      ),
      new FilterObject(
        'documentAuthorType', FilterType.MultiSelect, 'Document Author',
        new MultiSelectDefinition(this.documentAuthorTypeArray, [], this.legislationFilterGroup, null, true),
        4
      ),
      new FilterObject(
        'type', FilterType.MultiSelect, 'Document Type',
        new MultiSelectDefinition(this.documentTypeArray, [], this.legislationFilterGroup, null, true),
        4
      ),
      new FilterObject(
        'projectPhase', FilterType.MultiSelect, 'Project Phase',
        new MultiSelectDefinition(this.projectPhaseArray, [], this.legislationFilterGroup, null, true),
        4
      ),
    ]);
  }

  override executeSearch(searchPackage: any): void {
    const params: any = {};
    if (searchPackage.keywords) {
      params['keywords'] = searchPackage.keywords;
      if (searchPackage.keywordsChanged) {
        params['sortBy'] = '-score';
      }
    } else {
      params['keywords'] = null;
      params['sortBy'] = '-datePosted';
    }
    params['currentPage'] = 1;

    const queryFilters = this.tableTemplateUtils.getFiltersFromSearchPackage(
      searchPackage, this.filtersList, this.dateFiltersList
    );
    this.submit(params, queryFilters);
  }

  override onMessageOut(msg: ITableMessage): void {
    const params: any = {};
    const currentTableData = this.tableData();
    switch (msg.label) {
      case 'columnSort':
        params['sortBy'] = (currentTableData.sortBy.charAt(0) === '+' ? '-' : '+') + msg.data;
        break;
      case 'pageNum':
        params['currentPage'] = msg.data;
        break;
      case 'pageSize':
        params['pageSize'] = msg.data.value;
        params['currentPage'] = 1;
        break;
    }
    this.submit(params);
  }

  override onToggleFiltersPanel(event: { showPanel: boolean }): void {
    this.showAdvancedFilters!.set(event.showPanel);
  }

  onResetControls(): void {
    const currentTableData = this.tableData();
    if (currentTableData.sortBy.includes('score')) {
      currentTableData.sortBy = '-datePosted';
      this.tableData.set(currentTableData);
    }
  }
}
