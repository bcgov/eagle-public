import type { MouseEvent } from 'react';
import { CAP_MESSAGE, toggleSelected, useSelection } from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import type { TableObject } from './table-object';

/** Adds a document to the table's selection, or says why it cannot. */
export function toggleRow(tableId: string, rowData: any): void {
  const added = toggleSelected(tableId, { id: rowData._id, displayName: rowData.displayName });
  if (!added) showToast(CAP_MESSAGE, { type: 'warning' });
}

/**
 * What a pointer does on a document row: the row body is a second, larger target for the
 * checkbox. The keyboard goes through the controls themselves — the checkbox selects, the Name
 * link opens — so the row is not a tab stop of its own.
 */
export function useDocumentRow(rowData: any, tableData: TableObject) {
  const selectable = !!tableData.options?.selectable;
  const selected = useSelection(tableData.tableId).has(rowData._id);

  const rowProps = {
    className:
      [selectable ? 'selectable-row' : '', selected ? 'selected' : ''].join(' ').trim() ||
      undefined,
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      // A click that lands on a link, a button or the checkbox belongs to that control.
      if (!selectable || (event.target as HTMLElement).closest('a, button, input')) return;
      // Letting go after dragging across the text is a text selection, not a row click.
      if (window.getSelection()?.isCollapsed === false) return;
      toggleRow(tableData.tableId, rowData);
    },
  };

  return { selectable, selected, rowProps };
}
