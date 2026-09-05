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
  // Offered once the page is fully selected, there is more behind it than one page, and the whole
  // result set fits the anonymous cap. Over the cap there is nothing to offer, so the bar says
  // nothing: the cap is explained by the toast on the attempt that actually hits it.
  const showSelectAll =
    selectable &&
    pageAllSelected &&
    data.totalListItems > data.pageSize &&
    data.totalListItems <= SELECT_ALL_MAX;

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
    toggleAllOnPage,
  };
}
