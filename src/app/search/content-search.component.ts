import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, Params, RouterLink, RouterLinkActive } from '@angular/router';
import { takeWhile, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { TableService } from 'app/services/table.service';
import { SearchParamObject } from 'app/services/search.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { SearchFilterTemplateComponent } from 'app/shared/components/search-filter-template/search-filter-template.component';
import { PaginationComponent } from 'app/shared/components/pagination/pagination.component';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';
import { ContentResultComponent } from './content-result/content-result.component';
import { SEARCH_TABS } from './search.config';

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
  private tableService = inject(TableService);
  private injector = inject(Injector);
  readonly loadingState = inject(LoadingStateService);

  readonly TABLE_ID = 'search-content';
  readonly tabs = SEARCH_TABS;

  readonly results = signal<any[]>([]);
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

    // NO FILTER CONTROLS on this tab. Milestone, Document Type and the date range were rendered
    // here and dropped by the API on every search it makes: a chunk filter has to resolve to a
    // document id set first, and a corpus-wide value exceeds DOCUMENT_SCOPE_CAP at any cap one
    // request can fill, so the key came back in `meta.dropped` and the passages came back
    // unfiltered. The Documents tab keeps all five — they work there.
    this.fetch(this.route.snapshot.queryParams);

    this.route.queryParams
      .pipe(
        takeWhile(() => this.alive),
        skip(1),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      )
      .subscribe(params => this.fetch(params));
  }

  private fetch(params: Params): void {
    this.currentPage.set(+(params['currentPage'] || 1));
    this.pageSize.set(+(params['pageSize'] || 10));

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
      {}
    ));
  }

  executeSearch(searchPackage: any): void {
    this.submit({ currentPage: 1, keywords: searchPackage.keywords?.trim() || null });
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
