import type { GridColumn, ValueOption } from 'app/components/display-grid/types';

type Row = Record<string, unknown>;

/** A Mongo id, which is a database key and never a word the reader asked to see. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/**
 * A stored value as the cell's words: the option's label, or the value itself when it is plain
 * text the index stored directly. An id the List collection has no row for reads as nothing,
 * because a bare `6a61123ff0c29b9e36505fd7` in an Author cell tells the reader less than a blank.
 */
function cellLabel(options: ValueOption[], value: string): string {
  const label = options.find((option) => option.value === value)?.label;
  if (label !== undefined) return label;
  return OBJECT_ID.test(value) ? '' : value;
}

/** One stored pick as its name. Populated rows carry the whole record, bare ones carry the id. */
function pickText(options: ValueOption[], pick: unknown): string {
  if (pick && typeof pick === 'object') {
    const held = pick as Row;
    return String(held['name'] ?? cellLabel(options, String(held['_id'] ?? '')));
  }
  return cellLabel(options, String(pick ?? ''));
}

/** A cell's stored value as the reader's words. A multi-value cell reads as a list. */
export function optionText(options: ValueOption[], value: unknown): string {
  const picks = Array.isArray(value) ? value : [value];
  return picks
    .map((pick) => pickText(options, pick))
    .filter(Boolean)
    .join(', ');
}

/**
 * A date in the grid is YYYY-MM-DD, so the digits line up column to column and a row reads as a
 * row. Read in UTC: the stored date is the day the record carries, not a local instant.
 */
function gridDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/** A coded value reads as its name, a date as a date; anything else is the stored text. */
function cellRenderer(
  column: GridColumn<Row>,
  picks: ValueOption[] | undefined,
): ((row: Row) => string) | undefined {
  // A date is read, never looked up: the year options a date column offers are not its cell values.
  if (column.date) return (row) => gridDate(row[column.key]);
  if (picks) return (row) => optionText(picks, row[column.key]);
  return undefined;
}

/**
 * A record type's columns with their dropdown values filled in from the lookups, and a cell
 * renderer for each column that does not draw its own: a values column stores ids, and without
 * the lookup its cell would show a raw ObjectId.
 */
export function withCells(
  columns: GridColumn<Row>[],
  options: Record<string, ValueOption[]>,
): GridColumn<Row>[] {
  return columns.map((column) => {
    const picks = options[column.filterId ?? column.key] ?? column.options;
    return { ...column, options: picks, render: column.render ?? cellRenderer(column, picks) };
  });
}
