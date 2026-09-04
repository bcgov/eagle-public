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
import { toggleRow } from './document-row';
import { PageCountDisplay } from './page-count-display';
import { PageSizePicker } from './page-size-picker';
import { Pagination } from './pagination';
import { usePageSelection } from './use-page-selection';
import {
  documentCountMessage,
  withAllPicker,
  type IPageSizePickerOption,
  type ITableMessage,
  type TableObject,
} from './table-object';
import './table.css';

/** The checkbox column's cell. Rendered by the row components, which own their own `<tr>`. */
export function SelectCell({ rowData, tableId }: { rowData: any; tableId: string }) {
  const selected = useSelection(tableId).has(rowData._id);

  return (
    <td data-label="Select" className="select-col">
      <input
        type="checkbox"
        className="form-check-input"
        aria-label={`Select ${rowData.displayName}`}
        checked={selected}
        onChange={() => toggleRow(tableId, rowData)}
      />
    </td>
  );
}

interface TableTemplateProps {
  data: TableObject;
  loading?: boolean;
  /** Row renderer. `IRowObject.component` overrides it per row; `data.component` is the fallback. */
  rowComponent?: TableObject['component'];
  emptyMessage?: string;
  onMessage: (msg: ITableMessage) => void;
}

export function TableTemplate({
  data,
  loading = false,
  rowComponent,
  emptyMessage = 'No results found',
  onMessage,
}: TableTemplateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil((data.totalListItems || 0) / (data.pageSize || 10));
  const showPagination = !!data.options.showPagination && totalPages > 1;
  const tableType = (rowComponent ?? data.component)?.name || 'unknown';
  const showSkeleton = loading && data.items.length === 0;
  // Enough rows to read as a table; a full page of them would be a bigger jump than it saves.
  const skeletonRows = Math.min(data.pageSize || 5, 5);
  const pageSizeOptions = data.options.showAllPicker
    ? withAllPicker(data.pageSizeOptions, data.totalListItems)
    : data.pageSizeOptions;

  const { selectable, selectedCount, pageAllSelected, pageMixed, showSelectAll, toggleAllOnPage } =
    usePageSelection(data);
  const downloadInProgress = useDownloadInProgress();

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

  const paginationControl = showPagination ? (
    <Pagination
      currentPage={data.currentPage}
      pageSize={data.pageSize}
      totalItems={data.totalListItems}
      ariaLabel="Table pagination"
      onPageChange={onUpdatePageNumber}
    />
  ) : null;

  const showPageCount = !!data.options.showTopControls && !!data.options.showPageCountDisplay;
  // Selectable tables trade this row for the header bar below; everything else keeps it.
  const showTopRow =
    !selectable && !!data.options.showTopControls && (showPageCount || showPagination);
  const noResults = !loading && data.items.length === 0 && data.totalListItems === 0;
  const selectionActive = selectedCount > 0;
  // No count is known while the request is in flight, and the live region must not read out
  // "No documents" over a page that is still loading.
  const countMessage = loading
    ? ''
    : documentCountMessage(data.totalListItems, data.currentPage, data.pageSize);

  return (
    <div className="table-template" ref={containerRef}>
      {showTopRow && (
        <div className="row mb-4 table-controls-top">
          <div className="col-12 col-md-6 mb-3 mb-md-0 table-controls-left">
            {showPageCount && (
              <PageCountDisplay
                isHidden={false}
                currentPageNum={data.currentPage}
                currentPageSize={data.pageSize}
                totalItems={data.totalListItems}
                id={`table-template-page-count-display-${data.tableId}`}
              />
            )}
          </div>
          <div className="col-12 col-md-6 text-center text-md-end">{paginationControl}</div>
        </div>
      )}

      {/* One bar, two states. It is part of the grid rather than a toolbar above it: fixed height,
          so selecting a row never moves the rows under the reader's pointer. */}
      {selectable && !noResults && (
        <div className={`table-header-bar${selectionActive ? ' table-header-bar--selected' : ''}`}>
          <div className="table-header-bar__main">
            {/* The one live region: it is the only thing selecting changes for a screen reader. */}
            <span className="table-header-bar__count" role="status">
              {selectionActive ? `${selectedCount.toLocaleString()} selected` : countMessage}
            </span>
            {selectionActive && (
              <>
                <button
                  type="button"
                  className="table-header-bar__icon-btn"
                  aria-label="Clear selection"
                  onClick={() => clearSelection()}
                >
                  <i className="material-icons md-18" aria-hidden="true">
                    close
                  </i>
                </button>
                {showSelectAll && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm table-header-bar__link"
                    aria-label={`Select all ${data.totalListItems.toLocaleString()} documents`}
                    onClick={() => onMessage({ label: 'selectAllMatching' })}
                  >
                    Select all {data.totalListItems.toLocaleString()}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="table-header-bar__actions">
            {selectionActive ? (
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                disabled={downloadInProgress}
                title={
                  downloadInProgress
                    ? `${MAX_JOBS_IN_FLIGHT} downloads are already in progress. Wait for one to finish.`
                    : undefined
                }
                onClick={() => void startDownload()}
              >
                {/* The bundled Material Icons build has no `download`; this is the app's glyph. */}
                <i className="material-icons md-18" aria-hidden="true">
                  cloud_download
                </i>
                Download
              </button>
            ) : (
              paginationControl
            )}
          </div>
        </div>
      )}

      <div
        className={loading && data.items.length > 0 ? 'table-loading' : undefined}
        aria-busy={loading || undefined}
      >
        {showSkeleton && <span className="visually-hidden">Loading</span>}
        {noResults ? (
          <div className="text-center my-5">
            <p className="text-muted">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <table className="table" aria-label="table-template">
              {data.options.showHeader && (
                <thead>
                  <tr>
                    {selectable && (
                      <th className="select-col">
                        <input
                          type="checkbox"
                          className="form-check-input"
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
                          aria-sort={
                            ascending ? 'ascending' : descending ? 'descending' : undefined
                          }
                          className={`project-table__name-col ${entry.width ?? ''} ${sortable ? 'sortable' : ''}`}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              className="table-sort-btn"
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
              )}

              <tbody className={!data.options.disableRowHighlight ? 'highlight' : undefined}>
                {showSkeleton &&
                  Array.from({ length: skeletonRows }, (_, row) => (
                    <tr key={`skeleton-${row}`} className="placeholder-wave" aria-hidden="true">
                      {selectable && <td className="select-col"></td>}
                      {data.columns.map((entry) => (
                        <td key={entry.value} className={entry.width}>
                          <span className="placeholder w-100"></span>
                        </td>
                      ))}
                    </tr>
                  ))}
                {data.items.map((item, index) => {
                  const Row = item.component ?? rowComponent ?? data.component;
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

            {(data.items.length > 0 || !loading) && (
              <div className="table-controls-bottom mt-4">
                <div className="row">
                  <div className="col-12 col-md-6 text-center text-md-start mb-3 mb-md-0">
                    {data.options.showPageSizePicker &&
                      data.totalListItems > Constants.tableDefaults.DEFAULT_PAGE_SIZE && (
                        <PageSizePicker
                          isHidden={false}
                          currentPageSize={data.pageSize}
                          sizeOptions={pageSizeOptions}
                          onPageSizeChosen={onUpdatePageSize}
                          id={`table-template-page-size-picker-${data.tableId}`}
                        />
                      )}
                  </div>
                  <div className="col-12 col-md-6 text-center text-md-end">{paginationControl}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
