import { Component, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Utils } from 'app/shared/utils/utils';
import { TableRowComponent, ITableMessage } from 'app/shared/components/table-template/table-row-component';
import { TableObject } from 'app/shared/components/table-template/table-object';

/**
 * One row of a document-content search result: the parent document, its project, the page the
 * match was on, and the highlighted snippet.
 *
 * The snippet arrives as markup and is bound with `[innerHTML]`. That is safe because
 * eagle-search escapes the document text BEFORE turning its highlight sentinels into `<mark>`, and
 * balances the tags per fragment — see `service/snippet.js` there. Angular's sanitizer keeps
 * `<mark>` and would strip anything else, so this is belt and braces rather than the only guard.
 *
 * Download goes through the same `Utils.openDocumentDownload` the Documents tab uses, which builds
 * a relative `/api/public/document/{_id}/download/...`. That URL is served by eagle-api: the Azure
 * search service holds no files and never will.
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
   * A chunk's key is `${documentId}_p{page}_c{index}`, but the download needs the DOCUMENT id.
   * Passing `rowData` straight through would request a document that does not exist.
   */
  goToItem(item: any) {
    this.utils.openDocumentDownload({ _id: item.documentId, displayName: item.documentName });
  }
}
