import { Component, input, computed, effect, ChangeDetectionStrategy } from '@angular/core';

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
      return 'No results found';
    } else if (currentPageNum > pageCount) {
      // This check is necessary due to a rare edge-case where the user has manually incremented the page parameter in
      // the URL beyond what would normally be allowed. As a result when records are fetched, there aren't enough
      // to reach this page, and so the total records found is > 0, but the records displayed for this page
      // is 0, which may confuse users. Tell them to press clear button which will reset the pagination url parameter.
      return 'Unable to display results, please clear and re-try';
    } else {
      const high = Math.min(totalItems, currentPageNum * currentPageSize);
      return `Showing ${high} of ${totalItems} results`;
    }
  });
}
