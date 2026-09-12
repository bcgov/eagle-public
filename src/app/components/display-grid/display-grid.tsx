import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useMediaQuery } from 'app/state/responsive';
import { FilterRow } from './filter-row';
import { GridPageSizes, GridPager } from './grid-footer';
import { GridHeader } from './grid-header';
import { columnFiltersForPanel } from './grid-helpers';
import { ListRow, type ListRowField } from './list-row';
import { RecordLink } from './record-link';
import { SelectCell } from './select-cell';
import { PAGE_SIZES } from './use-grid-url-state';
import type {
  AdvancedField,
  FilterValue,
  FilterValues,
  GridColumn,
  GridTemplate,
  SortState,
} from './types';
import './display-grid.css';

/** Enough rows to read as a table; a full page of them would be a bigger jump than it saves. */
const SKELETON_ROWS = 5;

/**
 * Below this the table becomes one card per record: seven columns cannot be read on a phone, and
 * a sideways scroll hides whichever of them the reader has not thought to look for.
 */
const NARROW_QUERY = '(max-width: 719.98px)';

function readCell(row: unknown, key: string): ReactNode {
  if (row && typeof row === 'object' && key in row) {
    const value = (row as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}

interface SortOption {
  /** `-datePosted` as the URL spells it, so the select's value is the sort itself. */
  value: string;
  label: string;
}

/**
 * What the narrow layout offers instead of sortable headings: the record's date both ways and its
 * name both ways, which is every order a card can be read in.
 */
function sortOptionsFor<Row>(columns: GridColumn<Row>[]): SortOption[] {
  const date =
    columns.find((column) => column.primaryDate) ?? columns.find((column) => column.date);
  const name = columns.find((column) => column.link) ?? columns.find((column) => column.sortable);
  const options: SortOption[] = [];
  if (date?.sortable) {
    options.push(
      { value: `-${date.key}`, label: 'Newest first' },
      { value: `+${date.key}`, label: 'Oldest first' },
    );
  }
  if (name?.sortable) {
    options.push(
      { value: `+${name.key}`, label: 'Name A–Z' },
      { value: `-${name.key}`, label: 'Name Z–A' },
    );
  }
  return options;
}

/** The card's label/value pairs: every column that is neither the headline nor the date. */
function cardFields<Row>(columns: GridColumn<Row>[], row: Row): ListRowField[] {
  return columns
    .filter((column) => !column.link && !column.date)
    .map((column) => ({
      label: column.label,
      value: column.render ? column.render(row) : readCell(row, column.key),
    }));
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
  /** A header click leaves the direction to the caller; the narrow sort select names one. */
  onSort?: (key: string, dir?: '+' | '-') => void;
  /**
   * Record attributes no column carries, shown on the narrow card where there is room for them.
   * They are the fields only the advanced panel can filter by, so the page owns their values.
   */
  narrowExtras?: (row: Row) => ListRowField[];
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
  narrowExtras,
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
  const captionRef = useRef<HTMLElement | null>(null);
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const [headHeight, setHeadHeight] = useState(0);

  const narrow = useMediaQuery(NARROW_QUERY);
  const listMode = template === 'list';
  const showSkeleton = loading && rows.length === 0;
  const showEmpty = !loading && rows.length === 0;
  /* One record per card below the breakpoint. The reader's hidden columns still apply: a column
     switched off is off in both layouts. */
  const cardMode = narrow && !listMode && !showEmpty;
  /* Nothing to head: an empty result has no columns to sort and no values to filter, so the
     message follows the chips rather than a row of controls over nothing. */
  const showHead = !listMode && !headerless && !showEmpty && !cardMode;
  const showFilterRow = showHead && columns.some((column) => !!column.filter);
  const showSortBar = cardMode && sortOptionsFor(columns).length > 0;

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
    /* Focus would otherwise stay on the pager that just scrolled away, so the next Tab starts
       from off screen. The scroll above already put the caption where it belongs. */
    captionRef.current?.focus({ preventScroll: true });
  }

  const ids = rowId ? rows.map(rowId) : [];
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  const someSelected = !allSelected && ids.some((id) => selectedIds.includes(id));

  /* A column filter has one home. While the filter row is on screen it lives there; when the
     layout drops that row - a phone, a list, an empty result - the panel is the only place left
     for it, so it moves rather than going missing. */
  const panelContent =
    typeof panel === 'function'
      ? panel(showFilterRow ? [] : columnFiltersForPanel(columns))
      : panel;

  // The card's headline and its meta line, which are the link column and the record's own date.
  const headline = columns.find((column) => column.link) ?? columns[0];
  const dateColumn =
    columns.find((column) => column.primaryDate) ?? columns.find((column) => column.date);

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

        {showSortBar && (
          <div className="display-grid__sort-bar">
            <label className="display-grid__sort-bar-label">
              Sort
              <select
                className="display-grid__sort-select"
                value={sort ? `${sort.dir === 'desc' ? '-' : '+'}${sort.key}` : ''}
                onChange={(event) => {
                  const next = event.target.value;
                  onSort?.(next.slice(1), next.startsWith('-') ? '-' : '+');
                }}
              >
                {sortOptionsFor(columns).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {cardMode ? (
          <>
            <p
              className="display-grid__visually-hidden"
              tabIndex={-1}
              ref={(node) => {
                captionRef.current = node;
              }}
            >
              {caption}
            </p>
            <ol className="display-grid__cards">
              {rows.map((row, index) => {
                const id = rowId ? rowId(row) : String(index);
                const selected = selectedIds.includes(id);
                const title = headline
                  ? String(
                      (headline.render ? headline.render(row) : readCell(row, headline.key)) ?? '',
                    )
                  : id;
                const date = dateColumn
                  ? dateColumn.render
                    ? dateColumn.render(row)
                    : readCell(row, dateColumn.key)
                  : null;
                return (
                  <li
                    className={`display-grid__card${
                      selected ? ' display-grid__card--selected' : ''
                    }`}
                    key={id}
                  >
                    {selectable && (
                      <input
                        type="checkbox"
                        className="display-grid__checkbox display-grid__card-check"
                        aria-label={`Select ${rowLabel ? rowLabel(row) : title}`}
                        checked={selected}
                        onChange={() => onToggleRow?.(row)}
                      />
                    )}
                    <ListRow
                      meta={date ? [date] : []}
                      title={title}
                      href={headline?.href?.(row)}
                      external={headline?.hrefExternal}
                      fields={[
                        ...cardFields(columns, row),
                        ...(narrowExtras ? narrowExtras(row) : []),
                      ]}
                    />
                  </li>
                );
              })}
            </ol>
          </>
        ) : listMode ? (
          <>
            <p
              className="display-grid__visually-hidden"
              tabIndex={-1}
              ref={(node) => {
                captionRef.current = node;
              }}
            >
              {caption}
            </p>
            <ul className="display-grid__list">
              {rows.map((row, index) => (
                <li className="display-grid__list-item" key={rowId ? rowId(row) : index}>
                  {RowComponent ? <RowComponent row={row} /> : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="display-grid__scroll">
            <table className="display-grid__table">
              <caption
                className="display-grid__visually-hidden"
                tabIndex={-1}
                ref={(node) => {
                  captionRef.current = node;
                }}
              >
                {caption}
              </caption>
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
                      {columns.map((column) => {
                        const content = column.render
                          ? column.render(row)
                          : readCell(row, column.key);
                        const title = typeof content === 'string' ? content : undefined;
                        return (
                          <td
                            key={column.key}
                            className={`display-grid__cell${
                              column.date ? ' display-grid__cell--date' : ''
                            }`}
                          >
                            {/* One line per cell, so a row is a row. The full value is still
                                readable: it is the cell's own tooltip. */}
                            <span className="display-grid__cell-text" title={title}>
                              {column.link ? (
                                <RecordLink
                                  href={column.href?.(row)}
                                  external={column.hrefExternal}
                                  className="display-grid__cell-link"
                                >
                                  {content}
                                </RecordLink>
                              ) : (
                                content
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showEmpty && <p className="display-grid__empty">{emptyMessage}</p>}

        <div className="display-grid__footer">
          <GridPageSizes sizes={PAGE_SIZES} current={pageSize} onChoose={onPageSizeChange} />
          <GridPager
            page={page}
            pageSize={pageSize}
            total={total}
            ariaLabel="Result pages"
            onPageChange={changePage}
          />
        </div>
      </div>
    </div>
  );
}
