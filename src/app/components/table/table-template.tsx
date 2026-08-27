import { track } from 'app/analytics/analytics';
import { PageCountDisplay } from './page-count-display';
import { PageSizePicker } from './page-size-picker';
import { Pagination } from './pagination';
import { withAllPicker, type IPageSizePickerOption, type ITableMessage, type TableObject } from './table-object';
import './table.css';

interface TableTemplateProps {
  data: TableObject;
  loading?: boolean;
  /** Row renderer. `IRowObject.component` overrides it per row; `data.component` is the fallback. */
  rowComponent?: TableObject['component'];
  onMessage: (msg: ITableMessage) => void;
}

export function TableTemplate({ data, loading = false, rowComponent, onMessage }: TableTemplateProps) {
  const totalPages = Math.ceil((data.totalListItems || 0) / (data.pageSize || 10));
  const showPagination = !!data.options.showPagination && totalPages > 1;
  const tableType = (rowComponent ?? data.component)?.name || 'unknown';
  const showSkeleton = loading && data.items.length === 0;
  // Enough rows to read as a table; a full page of them would be a bigger jump than it saves.
  const skeletonRows = Math.min(data.pageSize || 5, 5);
  const pageSizeOptions = data.options.showAllPicker
    ? withAllPicker(data.pageSizeOptions, data.totalListItems)
    : data.pageSizeOptions;

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
    <div className="table-template">
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
                    {data.options.showPageSizePicker && data.totalListItems > 10 && (
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
