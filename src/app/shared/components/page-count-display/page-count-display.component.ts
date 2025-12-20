import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'lib-page-count-display',
  templateUrl: './page-count-display.component.html',
  styleUrl: './page-count-display.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class PageCountDisplayComponent {
  isHidden = input(false);
  currentPageNum = input(1);
  currentPageSize = input(25);
  totalItems = input(0);

  message = computed(() => {
    const totalItems = this.totalItems();
    const currentPageNum = this.currentPageNum();
    const currentPageSize = this.currentPageSize();
    const pageCount = Math.max(1, Math.ceil(totalItems / currentPageSize));

    if (totalItems <= 0) {
      return '';
    }
    
    if (currentPageNum > pageCount) {
      // Rare edge-case: user manually incremented page param beyond valid range
      return 'Unable to display results, please clear and re-try';
    }
    
    const high = Math.min(totalItems, currentPageNum * currentPageSize);
    return `Showing ${high} of ${totalItems} results`;
  });
}
