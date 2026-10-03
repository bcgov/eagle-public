import { CAP_MESSAGE, toggleSelected, toSize } from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';

/** Adds a document to the table's selection, or says why it cannot. */
export function toggleRow(tableId: string, rowData: any): void {
  const added = toggleSelected(tableId, {
    id: rowData._id,
    displayName: rowData.displayName,
    size: toSize(rowData.internalSize),
  });
  if (!added) showToast(CAP_MESSAGE, { type: 'warning' });
}
