import { useMemo } from 'react';
import {
  CAP_MESSAGE,
  clearSelection,
  SELECT_ALL_MAX,
  selectionSize,
  setSelected,
  toSize,
  useSelection,
  type SelectedDocument,
} from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import type { TableObject } from './table-object';

const SELECT_ALL_CAP_TITLE = `Downloads are limited to ${SELECT_ALL_MAX} documents at a time`;

/** Page-level selection state shared by the table frames: the header checkbox and select-all. */
export function usePageSelection(data: TableObject) {
  const selectable = !!data.options.selectable;
  const selection = useSelection(data.tableId);
  // Download posts every table's selection as one job, so the toolbar counts them all.
  const mergedSelection = useSelection();
  const selectedCount = mergedSelection.size;
  // Sum of the sizes known across every table's selection; used for the download bar's estimate.
  const selectedSize = selectionSize(mergedSelection);
  // Every row subscribes to the selection store, so a new array here re-renders the whole page.
  const pageDocs: SelectedDocument[] = useMemo(
    () =>
      data.items
        .filter((item) => item.rowData?._id)
        .map((item) => ({
          id: item.rowData._id,
          displayName: item.rowData.displayName,
          size: toSize(item.rowData.internalSize),
        })),
    [data.items],
  );
  const selectedOnPage = useMemo(
    () => pageDocs.filter((doc) => selection.has(doc.id)).length,
    [pageDocs, selection],
  );
  const pageAllSelected = pageDocs.length > 0 && selectedOnPage === pageDocs.length;
  const pageMixed = selectedOnPage > 0 && !pageAllSelected;
  // Offered whenever a selection is active and more documents match than are already selected.
  const showSelectAll = selectable && selectedCount > 0 && data.totalListItems > selectedCount;
  // Past the cap there is nothing more to select than the cap itself; the link says so instead
  // of a count the click could never actually select.
  const selectAllOverCap = data.totalListItems > SELECT_ALL_MAX;
  const selectAllText = selectAllOverCap
    ? `Select ${SELECT_ALL_MAX} (download limit)`
    : `Select all ${data.totalListItems.toLocaleString()}`;
  const selectAllLabel = selectAllOverCap ? selectAllText : `${selectAllText} documents`;
  const selectAllTitle = selectAllOverCap ? SELECT_ALL_CAP_TITLE : undefined;

  // ponytail: unchecking drops the whole table's selection, other pages included; deselect
  // page-by-page if anyone paging around complains.
  function toggleAllOnPage(): void {
    if (pageAllSelected) clearSelection(data.tableId);
    else if (!setSelected(data.tableId, pageDocs)) showToast(CAP_MESSAGE, { type: 'warning' });
  }

  return {
    selectable,
    selectedCount,
    selectedSize,
    pageAllSelected,
    pageMixed,
    showSelectAll,
    selectAllText,
    selectAllLabel,
    selectAllTitle,
    toggleAllOnPage,
  };
}
