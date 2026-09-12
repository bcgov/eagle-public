import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { PageSizePicker } from 'app/components/table/page-size-picker';
import { Pagination } from 'app/components/table/pagination';
import type { IPageSizePickerOption } from 'app/components/table/table-object';
import { FilterRow } from './filter-row';
import { GridHeader } from './grid-header';
import { columnFiltersForPanel } from './grid-helpers';
import { SelectCell } from './select-cell';
import type {
  AdvancedField,
  FilterValue,
  FilterValues,
  GridColumn,
  GridTemplate,
  SortState,
} from './types';
// The paging controls keep the look they already have; only the frame around them is new.
import 'app/components/table/table.css';
import './display-grid.css';

const PAGE_SIZES: IPageSizePickerOption[] = [10, 25, 50, 100].map((value) => ({
  value,
  displayText: String(value),
}));

/** Enough rows to read as a table; a full page of them would be a bigger jump than it saves. */
const SKELETON_ROWS = 5;

function readCell(row: unknown, key: string): ReactNode {
  if (row && typeof row === 'object' && key in row) {
    const value = (row as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}

interface DisplayGridProps<Row> {
  /** Visually-hidden caption naming what the grid lists. */
  caption: string;
  columns: GridColumn<Row>[];
  rows: Row[];
  template?: GridTemplate;
  /** Renders one record in list mode, where there are no columns. */
  rowComponent?: ComponentType<{ row: Row }>;
  loading?: boolean;
  emptyMessage?: ReactNode;
  selectable?: boolean;
  sort?: SortState | null;
  filters?: FilterValues;
  onSort?: (key: string) => void;
  onFilterChange?: (id: string, value: FilterValue) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** No column headings and no filter row: their filters move to the panel. */
  headerless?: boolean;
  toolbar?: ReactNode;
  chips?: ReactNode;
  /** The advanced panel. As a function it receives the column filters this mode cannot show. */
  panel?: ReactNode | ((columnFilters: AdvancedField[]) => ReactNode);
  /** Stable row identity; selection and React keys both need it. */
  rowId?: (row: Row) => string;
  /** What the row's checkbox selects, read out as "Select <label>". */
  rowLabel?: (row: Row) => string;
  selectedIds?: string[];
  onToggleRow?: (row: Row) => void;
  onToggleAllOnPage?: (rows: Row[]) => void;
}

export function DisplayGrid<Row>({
  caption,
  columns,
  rows,
  template = 'grid',
  rowComponent: RowComponent,
  loading = false,
  emptyMessage = 'No results found',
  selectable = false,
  sort,
  filters = {},
  onSort,
  onFilterChange,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  headerless = false,
  toolbar,
  chips,
  panel,
  rowId,
  rowLabel,
  selectedIds = [],
  onToggleRow,
  onToggleAllOnPage,
}: DisplayGridProps<Row>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const [headHeight, setHeadHeight] = useState(0);

  const listMode = template === 'list';
  const showHead = !listMode && !headerless;
  const showFilterRow = showHead && columns.some((column) => !!column.filter);
  const showSkeleton = loading && rows.length === 0;
  const showEmpty = !loading && rows.length === 0;

  // The filter row sticks under the header, whose height changes when a label wraps.
  useEffect(() => {
    const row = headRowRef.current;
    if (!row || !showFilterRow) return;
    const measure = () => setHeadHeight(row.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [showFilterRow]);

  function changePage(next: number): void {
    onPageChange(next);
    // `body` is the scrolling box in this shell, so the grid scrolls itself into view.
    containerRef.current?.scrollIntoView({ block: 'start' });
  }

  const ids = rowId ? rows.map(rowId) : [];
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  const someSelected = !allSelected && ids.some((id) => selectedIds.includes(id));

  const panelContent = typeof panel === 'function' ? panel(columnFiltersForPanel(columns)) : panel;

  return (
    <div className="display-grid" ref={containerRef}>
      {toolbar}
      {chips}
      {panelContent}

      <div
        className={loading && rows.length > 0 ? 'display-grid__body--loading' : undefined}
        aria-busy={loading || undefined}
      >
        {showSkeleton && <span className="display-grid__visually-hidden">Loading</span>}

        {listMode ? (
          <ul className="display-grid__list">
            {rows.map((row, index) => (
              <li className="display-grid__list-item" key={rowId ? rowId(row) : index}>
                {RowComponent ? <RowComponent row={row} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="display-grid__scroll">
            <table className="display-grid__table">
              <caption className="display-grid__visually-hidden">{caption}</caption>
              {showHead && (
                <thead>
                  <GridHeader
                    ref={headRowRef}
                    columns={columns}
                    sort={sort}
                    onSort={onSort}
                    selectable={selectable}
                    allSelected={allSelected}
                    someSelected={someSelected}
                    onToggleAll={() => onToggleAllOnPage?.(rows)}
                  />
                  {showFilterRow && (
                    <FilterRow
                      columns={columns}
                      values={filters}
                      onChange={(id, value) => onFilterChange?.(id, value)}
                      selectable={selectable}
                      top={headHeight}
                    />
                  )}
                </thead>
              )}
              <tbody>
                {showSkeleton &&
                  Array.from({ length: SKELETON_ROWS }, (_, index) => (
                    <tr key={`skeleton-${index}`} aria-hidden="true">
                      {selectable && (
                        <td className="display-grid__cell display-grid__cell--select" />
                      )}
                      {columns.map((column) => (
                        <td key={column.key} className="display-grid__cell">
                          <span className="display-grid__skeleton-bar" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {rows.map((row, index) => {
                  const id = rowId ? rowId(row) : String(index);
                  const selected = selectedIds.includes(id);
                  return (
                    <tr
                      key={id}
                      className={`display-grid__row${selected ? ' display-grid__row--selected' : ''}`}
                    >
                      {selectable && (
                        <SelectCell
                          label={`Select ${rowLabel ? rowLabel(row) : id}`}
                          checked={selected}
                          onChange={() => onToggleRow?.(row)}
                        />
                      )}
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`display-grid__cell${
                            column.date ? ' display-grid__cell--date' : ''
                          }`}
                        >
                          {column.render ? column.render(row) : readCell(row, column.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showEmpty && <p className="display-grid__empty">{emptyMessage}</p>}

        <div className="display-grid__footer">
          <div className="display-grid__footer-group">
            <span className="display-grid__footer-label" id="display-grid-per-page">
              Per page
            </span>
            <PageSizePicker
              currentPageSize={pageSize}
              sizeOptions={PAGE_SIZES}
              onPageSizeChosen={(option) => onPageSizeChange(option.value)}
            />
          </div>
          <Pagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            ariaLabel="Result pages"
            onPageChange={changePage}
          />
        </div>
      </div>
    </div>
  );
}
