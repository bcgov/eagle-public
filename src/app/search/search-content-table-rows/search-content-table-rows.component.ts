import { Component, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

/**
 * One content-search result: a DOCUMENT, with the passages that matched inside it.
 *
 * This is a result card rather than a table row. Chunk hits used to be listed one per row, which
 * meant a single long PDF filled the page — a measured page of 10 held 4 distinct documents. The
 * service now groups by document (`service/group.js` in eagle-search), and the card shows what a
 * reader actually needs to judge a hit: the document, where it sits, the text around the match, and
 * which pages to open.
 *
 * The snippets arrive as markup and are bound with `[innerHTML]`. That is safe because eagle-search
 * escapes the document text BEFORE turning its highlight sentinels into `<mark>`, and balances the
 * tags per fragment — see `service/snippet.js` there. Angular's sanitizer keeps `<mark>` and strips
 * anything else, so this is belt and braces rather than the only guard.
 */
@Component({
  selector: 'tr[app-content-table-rows]',
  templateUrl: './search-content-table-rows.component.html',
  styleUrls: ['./search-content-table-rows.component.css'],
  imports: [CommonModule, RouterLink],
  standalone: true
})
export class ContentSearchTableRowsComponent implements TableRowComponent {
  private utils = inject(Utils);

  // Required by TableRowComponent interface
  rowData: any;
  tableData!: TableObject;
  messageOut = new EventEmitter<ITableMessage>();
  messageIn = new EventEmitter<ITableMessage>();

  /**
   * eagle-api serves PDFs INLINE (`allowedInlineMimes` in its document controller), so `#page=N`
   * opens the browser's PDF viewer on that page. Without the inline disposition this would download
   * the file and ignore the fragment, which is why the deep link is worth having at all.
   *
   * Page numbers are already 1-based here — `group.js` converts them once, so the link, the list and
   * the "+N more" count cannot disagree.
   */
  pageUrl(page?: number): string {
    const name = this.utils.encodeString(this.rowData.documentName || 'document', true);
    const base = `/api/public/document/${this.rowData._id}/download/${name}`;
    return page ? `${base}#page=${page}` : base;
  }

  goToItem(item: any) {
    this.utils.openDocumentDownload({ _id: item._id, displayName: item.documentName });
  }

  /** "29 matches on 12 pages" reads better than either number alone. */
  get matchSummary(): string {
    const matches = this.rowData.matchCount || 0;
    const pages = (this.rowData.pages || []).length + (this.rowData.morePages || 0);
    const m = `${matches} match${matches === 1 ? '' : 'es'}`;
    return pages > 1 ? `${m} on ${pages} pages` : m;
  }
}
