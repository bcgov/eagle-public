import { useRef } from 'react';
import { track } from 'app/analytics/analytics';
import { Constants } from 'app/utils/constants';
import {
  clearSelection,
  MAX_JOBS_IN_FLIGHT,
  startDownload,
  useDownloadInProgress,
  useSelection,
} from 'app/state/bulk-download';
import { toggleRow } from 'app/components/table/document-row';
import { PageCountDisplay } from 'app/components/table/page-count-display';
import { PageSizePicker } from 'app/components/table/page-size-picker';
import { Pagination } from 'app/components/table/pagination';
import { usePageSelection } from 'app/components/table/use-page-selection';
import {
  documentCountMessage,
  withAllPicker,
  type IPageSizePickerOption,
  type ITableMessage,
  type TableObject,
} from 'app/components/table/table-object';
// The paging controls keep their own look; only the frame around them is new.
import 'app/components/table/table.css';
import './data-table.css';

/** The checkbox column's cell. Rendered by the row components, which own their own `<tr>`. */
export function SelectCell({ rowData, tableId }: { rowData: any; tableId: string }) {
  const selected = useSelection(tableId).has(rowData._id);

  return (
    <td className="data-table__cell data-table__cell--select">
      <input
        type="checkbox"
        className="data-table__checkbox"
        aria-label={`Select ${rowData.displayName}`}
        checked={selected}
        onChange={() => toggleRow(tableId, rowData)}
      />
    </td>
  );
}

interface DataTableProps {
  /** Visually-hidden caption naming what the table lists. */
  caption: string;
  data: TableObject;
  loading?: boolean;
  emptyMessage?: string;
  onMessage: (msg: ITableMessage) => void;
}

/** The redesigned grid: action bar, scrolling table, paging footer. */
export function DataTable({
  caption,
  data,
  loading = false,
  emptyMessage = 'No results found',
  onMessage,
}: DataTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil((data.totalListItems || 0) / (data.pageSize || 10));
  const showPagination = !!data.options.showPagination && totalPages > 1;
  const tableType = data.component?.name || 'unknown';
  const showSkeleton = loading && data.items.length === 0;
  // Enough rows to read as a table; a full page of them would be a bigger jump than it saves.
  const skeletonRows = Math.min(data.pageSize || 5, 5);
  const pageSizeOptions = data.options.showAllPicker
    ? withAllPicker(data.pageSizeOptions, data.totalListItems)
    : data.pageSizeOptions;

  const { selectable, selectedCount, pageAllSelected, pageMixed, showSelectAll, toggleAllOnPage } =
    usePageSelection(data);
  const downloadInProgress = useDownloadInProgress();
  const selectionActive = selectedCount > 0;
  const noResults = !loading && data.items.length === 0 && data.totalListItems === 0;
  // No count is known while the request is in flight, and the live region must not read out
  // "No documents" over a page that is still loading.
  const countMessage = loading
    ? ''
    : documentCountMessage(data.totalListItems, data.currentPage, data.pageSize);

  function onSort(property: string): void {
    track('Table Column Sorted', {
      table_type: tableType,
      column: property,
      direction: data.sortBy === `+${property}` ? 'desc' : 'asc',
    });
    onMessage({ label: 'columnSort', data: property });
  }

  function onUpdatePageNumber(pageNum: number): void {
    track('Pagination Changed', {
      table_type: tableType,
      from_page: data.currentPage,
      to_page: pageNum,
      total_pages: totalPages,
    });
    // Paging from the bottom control otherwise leaves the reader at the foot of the new page.
    // Optional call: jsdom has no scrollIntoView.
    containerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    onMessage({ label: 'pageNum', data: pageNum });
  }

  function onUpdatePageSize(pageSize: IPageSizePickerOption): void {
    track('Page Size Changed', {
      table_type: tableType,
      from_size: data.pageSize,
      to_size: pageSize.value,
    });
    onMessage({ label: 'pageSize', data: pageSize });
  }

  if (noResults) {
    return (
      <div className="data-table" ref={containerRef}>
        <p className="data-table__empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="data-table" ref={containerRef}>
      {/* Fixed height in both states, so selecting a row never moves the rows under the pointer. */}
      <div className={`data-table__bar${selectionActive ? ' data-table__bar--selected' : ''}`}>
        <div className="data-table__bar-group">
          {/* The one live region: it is the only thing selecting changes for a screen reader. */}
          <p className="data-table__bar-count" role="status">
            {selectionActive ? `${selectedCount.toLocaleString()} selected` : countMessage}
          </p>
          {selectionActive && (
            <>
              <button
                type="button"
                className="data-table__bar-clear"
                onClick={() => clearSelection()}
              >
                <i className="material-icons" aria-hidden="true">
                  close
                </i>
                Clear
              </button>
              {showSelectAll && (
                <button
                  type="button"
                  className="data-table__bar-link"
                  aria-label={`Select all ${data.totalListItems.toLocaleString()} documents`}
                  onClick={() => onMessage({ label: 'selectAllMatching' })}
                >
                  Select all {data.totalListItems.toLocaleString()}
                </button>
              )}
            </>
          )}
        </div>
        {selectionActive && (
          <div className="data-table__bar-group">
            <button
              type="button"
              className="data-table__download"
              disabled={downloadInProgress}
              title={
                downloadInProgress
                  ? `${MAX_JOBS_IN_FLIGHT} downloads are already in progress. Wait for one to finish.`
                  : undefined
              }
              onClick={() => void startDownload()}
            >
              {/* The bundled Material Icons build has no `download`; this is the app's glyph. */}
              <i className="material-icons" aria-hidden="true">
                cloud_download
              </i>
              Download {selectedCount.toLocaleString()}
            </button>
          </div>
        )}
      </div>

      <div
        className={loading && data.items.length > 0 ? 'data-table__body--loading' : undefined}
        aria-busy={loading || undefined}
      >
        {showSkeleton && <span className="visually-hidden">Loading</span>}
        <div className="data-table__scroll">
          <table className="data-table__table">
            <caption className="visually-hidden">{caption}</caption>
            <thead>
              <tr>
                {selectable && (
                  <th scope="col" className="data-table__head-cell data-table__cell--select">
                    <input
                      type="checkbox"
                      className="data-table__checkbox"
                      aria-label="Select all on this page"
                      checked={pageAllSelected}
                      aria-checked={pageMixed ? 'mixed' : undefined}
                      ref={(input) => {
                        if (input) input.indeterminate = pageMixed;
                      }}
                      onChange={toggleAllOnPage}
                    />
                  </th>
                )}
                {data.columns.map((entry) => {
                  const sortable = entry.nosort !== true;
                  const ascending = data.sortBy === `+${entry.value}`;
                  const descending = data.sortBy === `-${entry.value}`;
                  return (
                    <th
                      key={entry.value}
                      scope="col"
                      className="data-table__head-cell"
                      aria-sort={ascending ? 'ascending' : descending ? 'descending' : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="data-table__sort"
                          onClick={() => onSort(entry.value!)}
                        >
                          {entry.name}
                          <i
                            className={`sort${ascending ? ' sort-asc' : ''}${
                              descending ? ' sort-desc' : ''
                            }`}
                            aria-hidden="true"
                          ></i>
                        </button>
                      ) : (
                        entry.name
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {showSkeleton &&
                Array.from({ length: skeletonRows }, (_, row) => (
                  <tr key={`skeleton-${row}`} className="placeholder-wave" aria-hidden="true">
                    {selectable && <td className="data-table__cell data-table__cell--select"></td>}
                    {data.columns.map((entry) => (
                      <td key={entry.value} className="data-table__cell">
                        <span className="placeholder w-100"></span>
                      </td>
                    ))}
                  </tr>
                ))}
              {data.items.map((item, index) => {
                const Row = item.component ?? data.component;
                if (!Row) return null;
                return (
                  <Row
                    key={item.rowData?._id || index}
                    rowData={item.rowData}
                    tableData={data}
                    columns={data.columns}
                    onMessage={onMessage}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="data-table__footer">
          <div className="data-table__footer-group">
            {data.options.showPageSizePicker &&
              data.totalListItems > Constants.tableDefaults.DEFAULT_PAGE_SIZE && (
                <>
                  <span className="data-table__footer-label">Per page</span>
                  <PageSizePicker
                    currentPageSize={data.pageSize}
                    sizeOptions={pageSizeOptions}
                    onPageSizeChosen={onUpdatePageSize}
                    id={`data-table-page-size-picker-${data.tableId}`}
                  />
                </>
              )}
            {data.options.showPageCountDisplay && (
              <PageCountDisplay
                currentPageNum={data.currentPage}
                currentPageSize={data.pageSize}
                totalItems={data.totalListItems}
                id={`data-table-page-count-display-${data.tableId}`}
              />
            )}
          </div>
          {showPagination && (
            <Pagination
              currentPage={data.currentPage}
              pageSize={data.pageSize}
              totalItems={data.totalListItems}
              ariaLabel="Document pages"
              onPageChange={onUpdatePageNumber}
            />
          )}
        </div>
      </div>
    </div>
  );
}
