import type { FilterValues, ValueOption } from 'app/components/display-grid/types';

/** A search result as the page reads one: whatever the index returned, keyed by field name. */
type Row = Record<string, unknown>;

/**
 * Filters as the API takes them: raw ids, because `searchKeywords` is what wraps them as `and[]`.
 *
 * A date column filters by a whole year, which the index has no field for: the year becomes the
 * range it stands for, `<id>Start` and `<id>End`. The advanced panel writes those same two ids, so
 * a bound it has already set is left alone rather than widened back out to the year.
 */
export function toWireFilters(
  filters: FilterValues,
  yearIds: string[] = [],
): Record<string, string> {
  const wire: Record<string, string> = {};
  const years: Record<string, string> = {};
  for (const [id, value] of Object.entries(filters)) {
    const joined = Array.isArray(value) ? value.join(',') : value;
    if (!joined) continue;
    if (yearIds.includes(id)) years[id] = joined;
    else wire[id] = joined;
  }
  for (const [id, year] of Object.entries(years)) {
    if (wire[`${id}Start`] === undefined) wire[`${id}Start`] = `${year}-01-01`;
    if (wire[`${id}End`] === undefined) wire[`${id}End`] = `${year}-12-31`;
  }
  return wire;
}

/**
 * The years a date column offers: the ones its results carry, newest first.
 *
 * The index has no year facet to ask, so the rows on the page are the list. The year in force is
 * kept in it whether or not the rows still show it, so the choice never drops out of its own menu.
 */
export function yearOptions(rows: Row[], key: string, chosen: string): ValueOption[] {
  const years = new Set<string>();
  for (const row of rows) {
    const year = String(row[key] ?? '').slice(0, 4);
    if (/^\d{4}$/.test(year)) years.add(year);
  }
  if (/^\d{4}$/.test(chosen)) years.add(chosen);
  return [...years]
    .sort()
    .reverse()
    .map((year) => ({ value: year, label: year }));
}
