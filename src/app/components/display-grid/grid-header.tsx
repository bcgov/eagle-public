import type { Ref } from 'react';
import type { GridColumn, SortState } from './types';

interface GridHeaderProps<Row> {
  columns: GridColumn<Row>[];
  sort?: SortState | null;
  onSort?: (key: string) => void;
  selectable?: boolean;
  allSelected?: boolean;
  /** Some but not all rows on this page are selected: the box reads mixed. */
  someSelected?: boolean;
  onToggleAll?: () => void;
  /** The filter row's sticky offset is this row's measured height, so the row has to be reachable. */
  ref?: Ref<HTMLTableRowElement>;
}

export function GridHeader<Row>({
  columns,
  sort,
  onSort,
  selectable = false,
  allSelected = false,
  someSelected = false,
  onToggleAll,
  ref,
}: GridHeaderProps<Row>) {
  return (
    <tr ref={ref}>
      {selectable && (
        <th scope="col" className="display-grid__head-cell display-grid__head-cell--select">
          <input
            type="checkbox"
            className="display-grid__checkbox"
            aria-label="Select all on this page"
            checked={allSelected}
            aria-checked={someSelected ? 'mixed' : undefined}
            ref={(input) => {
              if (input) input.indeterminate = someSelected;
            }}
            onChange={() => onToggleAll?.()}
          />
        </th>
      )}
      {columns.map((column) => {
        const active = sort?.key === column.key;
        const ascending = active && sort?.dir === 'asc';
        const sortable = column.sortable !== false;
        return (
          <th
            key={column.key}
            scope="col"
            // `table-layout: fixed` reads widths off the first row, so they belong on this cell.
            style={column.width ? { width: column.width } : undefined}
            className={`display-grid__head-cell${active ? ' display-grid__head-cell--sorted' : ''}`}
            aria-sort={active ? (ascending ? 'ascending' : 'descending') : undefined}
          >
            {sortable ? (
              <button
                type="button"
                className="display-grid__sort"
                onClick={() => onSort?.(column.key)}
              >
                <span className="display-grid__sort-label">{column.label}</span>
                <span className="display-grid__sort-arrow" aria-hidden="true">
                  {active ? (ascending ? '▲' : '▼') : '⇅'}
                </span>
              </button>
            ) : (
              <span className="display-grid__head-label">{column.label}</span>
            )}
          </th>
        );
      })}
    </tr>
  );
}
