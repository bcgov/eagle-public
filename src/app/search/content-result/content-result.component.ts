import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';

/**
 * One content-search result: a DOCUMENT, with the passages that matched inside it.
 *
 * The snippets arrive as markup and are bound with `[innerHTML]`. That is safe because eagle-search
 * escapes the document text BEFORE turning its highlight sentinels into `<mark>`, and balances the
 * tags per fragment — see `service/snippet.js` there. Angular's sanitizer keeps `<mark>` and strips
 * anything else, so this is belt and braces rather than the only guard.
 */
@Component({
  selector: 'app-content-result',
  templateUrl: './content-result.component.html',
  styleUrls: ['./content-result.component.css'],
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ContentResultComponent {
  private utils = inject(Utils);

  readonly result = input.required<any>();

  /**
   * eagle-api serves PDFs INLINE (`allowedInlineMimes` in its document controller), so `#page=N`
   * opens the browser's PDF viewer on that page. Without the inline disposition this would download
   * the file and ignore the fragment, which is why the deep link is worth having at all.
   *
   * Page numbers are already 1-based here — eagle-search's `group.js` converts them once, so the
   * link, the list and the "+N more" count cannot disagree.
   */
  pageUrl(page?: number): string {
    const r = this.result();
    const name = this.utils.encodeString(r.documentName || 'document', true);
    const base = `/api/public/document/${r._id}/download/${name}`;
    return page ? `${base}#page=${page}` : base;
  }

  /** "29 matches on 24 pages" reads better than either number alone. */
  readonly matchSummary = computed(() => {
    const r = this.result();
    const matches = r.matchCount || 0;
    const pages = (r.pages || []).length + (r.morePages || 0);
    const m = `${matches} match${matches === 1 ? '' : 'es'}`;
    return pages > 1 ? `${m} on ${pages} pages` : m;
  });

  download(): void {
    const r = this.result();
    this.utils.openDocumentDownload({ _id: r._id, displayName: r.documentName });
  }
}
