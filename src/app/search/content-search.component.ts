import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, Params, RouterLink, RouterLinkActive } from '@angular/router';
import { takeWhile, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { ConfigService } from 'app/services/config.service';
import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { FilterObject } from 'app/shared/components/search-filter-template/filter-object';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';
import { PaginationComponent } from 'app/shared/components/pagination/pagination.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { ContentResultComponent } from './content-result/content-result.component';
import { SEARCH_TABS, buildSearchFilters, SEARCH_DATE_FILTER_LIST } from './search.config';

/**
 * Document content search.
 *
 * NOT built on `table-list`. That was the first attempt and it was wrong: `lib-table-template`
 * lays its rows out as table cells, so a result card's title, metadata, each snippet and the page
 * links each became a narrow column — the text ended up in vertical ribbons. A result list is a
 * list, and forcing it through a table to reuse the pagination was a false economy.
 *
 * What IS reused, because these are real components rather than a layout: the hero banner, the
 * search/filter template, `lib-pagination`, and `TableService` for fetching and caching.
 */
@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
  styleUrls: ['./content-search.component.css'],
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    SearchFilterTemplateComponent,
    PaginationComponent,
    HeroBannerComponent,
    ContentResultComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ContentSearchComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private configService = inject(ConfigService);
  private tableService = inject(TableService);
  private tableUtils = inject(TableTemplate);
  private injector = inject(Injector);
  readonly loadingState = inject(LoadingStateService);

  readonly TABLE_ID = 'search-content';
  readonly tabs = SEARCH_TABS;

  readonly results = signal<any[]>([]);
  readonly filters = signal<FilterObject[]>([]);
  readonly showAdvancedFilters = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  /**
   * Passages, not documents. Used ONLY to decide whether another page exists — never shown. Azure
   * cannot count distinct documents, and "1,128,702 results" told a reader nothing except that the
   * number was large.
   */
  readonly passageTotal = signal(0);

  readonly loading = () => this.loadingState.getOperationState(`table-${this.TABLE_ID}`)();

  private alive = true;

  /** The chunk index carries `documentTypeId` and `milestoneId`; author and phase are not on a chunk. */
  private readonly FILTER_IDS = ['milestone', 'type', 'issuedDate'];
  private readonly FILTER_LIST = ['milestone', 'type'];

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      toObservable(this.tableService.getTableSignal(this.TABLE_ID))
        .pipe(takeWhile(() => this.alive), skip(1))
        .subscribe((res: any) => {
          if (!res || res.data === undefined || res.data === 0) return;
          this.results.set(Array.isArray(res.data) ? res.data : []);
          this.passageTotal.set(res.totalSearchCount || 0);
        });
    });

    this.configService.lists
      .pipe(takeWhile(() => this.alive))
      .subscribe((lists: any[]) => {
        if (!lists?.length || this.filters().length) return;
        this.filters.set(buildSearchFilters(lists).filter(f => this.FILTER_IDS.includes(f.id)));
        this.fetch(this.route.snapshot.queryParams);
      });

    this.route.queryParams
      .pipe(
        takeWhile(() => this.alive),
        skip(1),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      )
      .subscribe(params => { if (this.filters().length) this.fetch(params); });
  }

  private fetch(params: Params): void {
    this.currentPage.set(+(params['currentPage'] || 1));
    this.pageSize.set(+(params['pageSize'] || 10));
    if (this.hasFilterParams(params)) this.showAdvancedFilters.set(true);

    const filters = this.tableUtils.getFiltersFromParams(params, [...this.FILTER_LIST, ...SEARCH_DATE_FILTER_LIST]);

    this.tableService.fetchData(new SearchParamObject(
      this.TABLE_ID,
      params['keywords'] || '',
      'DocumentChunk',
      [],
      this.currentPage(),
      this.pageSize(),
      // Relevance always. There is no meaningful field sort over passages, and `-score` is what
      // eagle-search reads as "issue no $orderby", leaving BM25's ranking in place.
      '-score',
      {},
      true,
      '',
      filters
    ));
  }

  private hasFilterParams(params: Params): boolean {
    return this.FILTER_LIST.some(f => params[f]);
  }

  executeSearch(searchPackage: any): void {
    const filters = this.tableUtils.getFiltersFromSearchPackage(searchPackage, this.FILTER_LIST, SEARCH_DATE_FILTER_LIST);
    this.submit({ currentPage: 1, keywords: searchPackage.keywords?.trim() || null, ...filters });
  }

  onPageChange(page: number): void {
    this.submit({ ...this.route.snapshot.queryParams, currentPage: page });
  }

  /** There is no document total, so "more pages" is whether the passage window can advance. */
  get hasResults(): boolean {
    return this.results().length > 0;
  }

  private submit(params: Params): void {
    this.router.navigate([], { queryParams: params, relativeTo: this.route });
  }

  ngOnDestroy(): void {
    this.alive = false;
  }
}
