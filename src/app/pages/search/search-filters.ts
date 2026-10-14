import type { FilterValues, ValueOption } from 'app/components/display-grid/types';

/**
 * Filters as DEMI's native list takes them, under the name `wire` gives each URL id. A filter the
 * list does not take is left out. A list value goes out as a repeated parameter, which DEMI reads
 * as "any of these".
 *
 * A date column filters by a whole year, which no list has a field for: the year becomes the
 * range it stands for, `<id>Start` and `<id>End`. The advanced panel writes those same two ids, so
 * a bound it has already set is left alone rather than widened back out to the year.
 */
export function toNativeFilters(
  filters: FilterValues,
  yearIds: string[],
  wire: Record<string, string>,
): Record<string, string | string[]> {
  const byId: Record<string, string | string[]> = {};
  for (const [id, value] of Object.entries(filters)) {
    if (value === '' || (Array.isArray(value) && value.length === 0)) continue;
    if (yearIds.includes(id)) {
      const year = Array.isArray(value) ? (value[0] ?? '') : value;
      byId[`${id}Start`] ??= `${year}-01-01`;
      byId[`${id}End`] ??= `${year}-12-31`;
      continue;
    }
    byId[id] = value;
  }
  const native: Record<string, string | string[]> = {};
  for (const [id, value] of Object.entries(byId)) {
    const name = wire[id];
    if (name) native[name] = value;
  }
  return native;
}

/** Whether a list takes the URL filter `id`, directly or as the range a year column stands for. */
export function takesFilter(wire: Record<string, string>, id: string): boolean {
  return id in wire || `${id}Start` in wire;
}

/** The first Environmental Assessment Act, and so the earliest year the record holds anything. */
const FIRST_ACT_YEAR = 1995;

/**
 * The years a date column offers: this year back to the first Act, newest first.
 *
 * The index has no year facet to ask, and a list read off the page's own rows could only offer the
 * year the sort in force lands on - on the default newest-first view, exactly one. A year chosen
 * outside the range is kept, so the choice never drops out of its own menu.
 */
export function yearOptions(chosen: string): ValueOption[] {
  const years: number[] = [];
  for (let year = new Date().getFullYear(); year >= FIRST_ACT_YEAR; year -= 1) years.push(year);
  if (/^\d{4}$/.test(chosen) && !years.includes(Number(chosen))) {
    years.push(Number(chosen));
    years.sort((a, b) => b - a);
  }
  return years.map((year) => ({ value: String(year), label: String(year) }));
}
