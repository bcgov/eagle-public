import type { KeyboardEvent, MouseEvent } from 'react';
import { CAP_MESSAGE, toggleSelected, useSelection } from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import { openDocumentDownload } from 'app/utils/utils';
import type { IColumnObject, TableObject } from './table-object';

/** Adds a document to the table's selection, or says why it cannot. */
export function toggleRow(tableId: string, rowData: any): void {
  const added = toggleSelected(tableId, { id: rowData._id, displayName: rowData.displayName });
  if (!added) showToast(CAP_MESSAGE, { type: 'warning' });
}

/** Header definition for the column `DownloadCell` fills. */
export const DOWNLOAD_COLUMN: IColumnObject = {
  name: 'Download',
  value: 'download',
  width: 'download-col',
  nosort: true
};

/**
 * What a pointer and the keyboard do on a document row: the row body is a second, larger target
 * for the checkbox, Enter opens the document, Space selects it. Links and buttons inside the row
 * keep their own behaviour, so nothing but them ever downloads.
 */
export function useDocumentRow(rowData: any, tableData: TableObject) {
  const selectable = !!tableData.options?.selectable;
  const selected = useSelection(tableData.tableId).has(rowData._id);
  const toggle = () => toggleRow(tableData.tableId, rowData);

  const rowProps = {
    tabIndex: 0,
    className: [selectable ? 'selectable-row' : '', selected ? 'selected' : ''].join(' ').trim() || undefined,
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      // A click that lands on a link, a button or the checkbox belongs to that control.
      if (!selectable || (event.target as HTMLElement).closest('a, button, input')) return;
      // Letting go after dragging across the text is a text selection, not a row click.
      if (window.getSelection()?.isCollapsed === false) return;
      toggle();
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      // Only the row's own keys; the controls inside it handle theirs.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        openDocumentDownload(rowData);
      } else if (event.key === ' ' && selectable) {
        event.preventDefault();
        toggle();
      }
    }
  };

  return { selectable, rowProps };
}
