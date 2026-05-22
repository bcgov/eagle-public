import {
  Component,
  ChangeDetectionStrategy,
  ContentChild,
  TemplateRef,
  input,
  output,
  computed,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PaginationComponent } from '../pagination/pagination.component';
import { PageSizePickerComponent, IPageSizePickerOption } from '../page-size-picker/page-size-picker.component';
import { PageCountDisplayComponent } from '../page-count-display/page-count-display.component';

/**
 * Generic card-list with pagination.
 *
 * Usage:
 *   <app-search-card-list [items]="items()" [totalItems]="total()" ...
 *     (pageChange)="onPage($event)" (pageSizeChange)="onPageSize($event)">
 *     <ng-template let-hit>
 *       <app-search-activity-card [hit]="hit" />
 *     </ng-template>
 *   </app-search-card-list>
 */
@Component({
  selector: 'app-search-card-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, PaginationComponent, PageSizePickerComponent, PageCountDisplayComponent],
  template: `
    <!-- Top controls (page count + pagination) -->
    @if (totalItems() > 0 || !loading()) {
      <div class="row mb-4">
        <div class="col-12 col-md-6 text-center text-md-start mb-3 mb-md-0">
          <lib-page-count-display
            [isHidden]="false"
            [currentPageNum]="currentPage()"
            [currentPageSize]="pageSize()"
            [totalItems]="totalItems()" />
        </div>
        @if (shouldShowPagination()) {
          <div class="col-12 col-md-6 text-center text-md-end">
            <lib-pagination
              [currentPage]="currentPage()"
              [pageSize]="pageSize()"
              [totalItems]="totalItems()"
              ariaLabel="Card list pagination"
              (pageChange)="pageChange.emit($event)" />
          </div>
        }
      </div>
    }

    <!-- Skeleton loading state -->
    @if (loading() && items().length === 0) {
      <div aria-busy="true" aria-label="Loading">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="skeleton-row">
            <div class="skeleton-cell" style="flex: 3"></div>
            <div class="skeleton-cell" style="flex: 2"></div>
            <div class="skeleton-cell" style="flex: 2"></div>
            <div class="skeleton-cell" style="flex: 1"></div>
          </div>
        }
      </div>

    <!-- Empty state -->
    } @else if (!loading() && items().length === 0) {
      <div class="text-center my-5">
        <p class="text-muted">No results found</p>
      </div>

    <!-- Card list -->
    } @else {
      <div class="search-card-list" [class.search-card-list--loading]="loading()">
        @for (item of items(); track $index) {
          <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: item }" />
        }
      </div>
    }

    <!-- Bottom controls -->
    @if (items().length > 0 || !loading()) {
      <div class="row mt-4">
        <div class="col-12 col-md-6 text-center text-md-start mb-3 mb-md-0">
          @if (totalItems() > 10) {
            <lib-page-size-picker
              [isHidden]="false"
              [currentPageSize]="pageSize()"
              [sizeOptions]="pageSizeOptions"
              (pageSizeChosen)="pageSizeChange.emit($event.value)" />
          }
        </div>
        @if (shouldShowPagination()) {
          <div class="col-12 col-md-6 text-center text-md-end">
            <lib-pagination
              [currentPage]="currentPage()"
              [pageSize]="pageSize()"
              [totalItems]="totalItems()"
              ariaLabel="Card list pagination"
              (pageChange)="pageChange.emit($event)" />
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .search-card-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .search-card-list--loading {
      opacity: 0.6;
      pointer-events: none;
      transition: opacity 0.2s ease-in-out;
    }
  `],
})
export class SearchCardListComponent {
  items = input<any[]>([]);
  loading = input(false);
  totalItems = input(0);
  currentPage = input(1);
  pageSize = input(10);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  @ContentChild(TemplateRef) cardTemplate!: TemplateRef<{ $implicit: any }>;

  readonly pageSizeOptions: IPageSizePickerOption[] = [
    { displayText: '10', value: 10 },
    { displayText: '25', value: 25 },
    { displayText: '50', value: 50 },
  ];

  shouldShowPagination = computed(() => {
    const totalPages = Math.ceil(this.totalItems() / this.pageSize());
    return totalPages > 1;
  });
}
