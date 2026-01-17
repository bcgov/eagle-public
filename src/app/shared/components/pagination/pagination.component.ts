import { Component, Output, EventEmitter, computed, input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'lib-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  standalone: true
})
export class PaginationComponent {
  // Input signals - automatically reactive
  currentPage = input<number>(1);
  pageSize = input<number>(10);
  totalItems = input<number>(0);
  ariaLabel = input<string>('Pagination navigation');

  @Output() pageChange = new EventEmitter<number>();

  /**
   * Computed signal for total number of pages
   */
  protected totalPages = computed(() => {
    const total = this.totalItems();
    const size = this.pageSize();
    return Math.ceil(total / size);
  });

  /**
   * Computed signal for page numbers with ellipsis logic
   */
  protected pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    
    const pages: (number | 'ellipsis')[] = [1];
    
    let startPage = Math.max(2, current - 2);
    let endPage = Math.min(total - 1, current + 2);
    
    if (current <= 4) {
      endPage = Math.min(5, total - 1);
    }
    
    if (current >= total - 3) {
      startPage = Math.max(2, total - 4);
    }
    
    if (startPage > 2) {
      pages.push('ellipsis');
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    if (endPage < total - 1) {
      pages.push('ellipsis');
    }
    
    if (total > 1) {
      pages.push(total);
    }
    
    return pages;
  });

  /**
   * Computed signal to check if Previous button should be disabled
   */
  protected isPreviousDisabled = computed(() => {
    return this.currentPage() === 1;
  });

  /**
   * Computed signal to check if Next button should be disabled
   */
  protected isNextDisabled = computed(() => {
    return this.currentPage() >= this.totalPages();
  });

  /**
   * Handle page change with validation
   */
  public onPageChange(pageNum: number): void {
    if (pageNum === this.currentPage() || pageNum < 1 || pageNum > this.totalPages()) {
      return;
    }
    this.pageChange.emit(pageNum);
  }

  /**
   * Type guard to check if pagination item is ellipsis
   */
  public isEllipsis(item: number | 'ellipsis'): boolean {
    return item === 'ellipsis';
  }

  /**
   * Convert page item to number (for type safety in template)
   */
  public asPageNumber(item: number | 'ellipsis'): number {
    return item as number;
  }
}
