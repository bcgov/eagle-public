import { useRef } from 'react';
import { track } from 'app/analytics/analytics';
import { Constants } from 'app/utils/constants';
import {
  CAP_MESSAGE,
  clearSelection,
  SELECT_ALL_MAX,
  setSelected,
  startDownload,
  useDownloadInProgress,
  useSelection,
  type SelectedDocument
} from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import { openDocumentDownload } from 'app/utils/utils';
import { toggleRow } from './document-row';
import { PageCountDisplay } from './page-count-display';
import { PageSizePicker } from './page-size-picker';
import { Pagination } from './pagination';
import { withAllPicker, type IPageSizePickerOption, type ITableMessage, type TableObject } from './table-object';
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

/** The per-row download button. Downloading is always a link or a button, never the row. */
export function DownloadCell({ rowData }: { rowData: any }) {
  return (
    <td data-label="Download" className="download-col">
      <button
        type="button"
        className="btn btn-link download-button"
        aria-label={`Download ${rowData.displayName}`}
        onClick={() => openDocumentDownload(rowData)}
      >
        <i className="material-icons" aria-hidden="true">
          cloud_download
        </i>
        <span className="download-button__label">Download</span>
      </button>
    </td>
  );
}

interface TableTemplateProps {
  data: TableObject;
  loading?: boolean;
  /** Row renderer. `IRowObject.component` overrides it per row; `data.component` is the fallback. */
  rowComponent?: TableObject['component'];
  onMessage: (msg: ITableMessage) => void;
}

export function TableTemplate({ data, loading = false, rowComponent, onMessage }: TableTemplateProps) {
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

  const selectable = !!data.options.selectable;
  const selection = useSelection(data.tableId);
  // Download posts every table's selection as one job, so the toolbar counts them all.
  const selectedCount = useSelection().size;
  const downloadInProgress = useDownloadInProgress();
  const pageDocs: SelectedDocument[] = data.items
    .filter(item => item.rowData?._id)
    .map(item => ({ id: item.rowData._id, displayName: item.rowData.displayName }));
  const selectedOnPage = pageDocs.filter(doc => selection.has(doc.id)).length;
  const pageAllSelected = pageDocs.length > 0 && selectedOnPage === pageDocs.length;
  // Offered once the page is fully selected and there is more behind it than one page.
  const showSelectAllBanner = selectable && pageAllSelected && data.totalListItems > data.pageSize;
  const showSelectionToolbar = selectable && selection.size > 0;
  const documentNoun = data.tableId === 'application' ? 'Application documents' : 'matching documents';

  function onSort(property: string): void {
    track('Table Column Sorted', {
      table_type: tableType,
      column: property,
      direction: data.sortBy === `+${property}` ? 'desc' : 'asc'
    });
    onMessage({ label: 'columnSort', data: property });
  }

  function onUpdatePageNumber(pageNum: number): void {
    track('Pagination Changed', {
      table_type: tableType,
      from_page: data.currentPage,
      to_page: pageNum,
      total_pages: totalPages
    });
    // Paging from the bottom control otherwise leaves the reader at the foot of the new page.
    // Optional call: jsdom has no scrollIntoView.
    containerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    onMessage({ label: 'pageNum', data: pageNum });
  }

  function onUpdatePageSize(pageSize: IPageSizePickerOption): void {
    track('Page Size Changed', { table_type: tableType, from_size: data.pageSize, to_size: pageSize.value });
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

  return (
    <div className="table-template" ref={containerRef}>
      {data.options.showTopControls && (data.options.showPageCountDisplay || showPagination) && (
        <div className="row mb-4 table-controls-top">
          <div className="col-12 col-md-6 text-center text-md-start mb-3 mb-md-0">
            {data.options.showPageCountDisplay && (
              <PageCountDisplay
                isHidden={false}
                currentPageNum={data.currentPage}
                currentPageSize={data.pageSize}
                totalItems={data.totalListItems}
                id="table-template-page-count-display"
              />
            )}
          </div>
          <div className="col-12 col-md-6 text-center text-md-end">{paginationControl}</div>
        </div>
      )}

      {showSelectionToolbar && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="fw-semibold">{selectedCount} selected</span>
          <button
            type="button"
            className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
            disabled={downloadInProgress}
            title={downloadInProgress ? 'Wait for the download in progress to finish.' : undefined}
            onClick={() => void startDownload()}
          >
            {/* The bundled Material Icons build has no `download`; this is the app's download glyph. */}
            <i className="material-icons md-18" aria-hidden="true">
              cloud_download
            </i>
            Download
          </button>
          <button type="button" className="btn btn-link btn-sm" onClick={() => clearSelection()}>
            Clear
          </button>
        </div>
      )}

      {showSelectAllBanner && (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2" role="status">
          {data.totalListItems <= SELECT_ALL_MAX ? (
            <>
              <span>All {pageDocs.length} on this page are selected.</span>
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => onMessage({ label: 'selectAllMatching' })}
              >
                Select all {data.totalListItems} {documentNoun}
              </button>
            </>
          ) : (
            <span>Narrow your filters to {SELECT_ALL_MAX} or fewer documents to select them all.</span>
          )}
        </div>
      )}

      <div className={loading && data.items.length > 0 ? 'table-loading' : undefined} aria-busy={loading || undefined}>
        {showSkeleton && <span className="visually-hidden">Loading</span>}
        {!loading && data.items.length === 0 && data.totalListItems === 0 ? (
          <div className="text-center my-5">
            <p className="text-muted">No results found</p>
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
                          ref={input => {
                            if (input) input.indeterminate = selectedOnPage > 0 && !pageAllSelected;
                          }}
                          // ponytail: unchecking drops the whole table's selection, other pages
                          // included; deselect page-by-page if anyone paging around complains.
                          onChange={() => {
                            if (pageAllSelected) clearSelection(data.tableId);
                            else if (!setSelected(data.tableId, pageDocs)) showToast(CAP_MESSAGE, { type: 'warning' });
                          }}
                        />
                      </th>
                    )}
                    {data.columns.map(entry => (
                      <th
                        key={entry.value}
                        tabIndex={0}
                        aria-label={`Column header ${entry.name}${!entry.nosort ? ' sortable' : ''}`}
                        id="table-template-header"
                        className={`project-table__name-col ${entry.width ?? ''} ${!entry.nosort ? 'sortable' : ''}`}
                        onKeyUp={event => {
                          if (event.key === 'Enter' && !entry.nosort) onSort(entry.value!);
                        }}
                        onClick={() => !entry.nosort && onSort(entry.value!)}
                      >
                        {entry.name}
                        {entry.nosort !== true && (
                          <i
                            className={`sort${data.sortBy === `+${entry.value}` ? ' sort-asc' : ''}${
                              data.sortBy === `-${entry.value}` ? ' sort-desc' : ''
                            }`}
                            aria-hidden="true"
                          ></i>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}

              <tbody className={!data.options.disableRowHighlight ? 'highlight' : undefined}>
                {showSkeleton &&
                  Array.from({ length: skeletonRows }, (_, row) => (
                    <tr key={`skeleton-${row}`} className="placeholder-wave" aria-hidden="true">
                      {selectable && <td className="select-col"></td>}
                      {data.columns.map(entry => (
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
                    {data.options.showPageSizePicker && data.totalListItems > Constants.tableDefaults.DEFAULT_PAGE_SIZE && (
                      <PageSizePicker
                        isHidden={false}
                        currentPageSize={data.pageSize}
                        sizeOptions={pageSizeOptions}
                        onPageSizeChosen={onUpdatePageSize}
                        id="table-template-page-size-picker"
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
