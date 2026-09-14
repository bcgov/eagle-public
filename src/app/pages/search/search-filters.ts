import type { FilterValues, ValueOption } from 'app/components/display-grid/types';

/**
 * Filters as the API takes them: raw ids, because `searchKeywords` is what wraps them as `and[]`.
 *
 * A date column filters by a whole year, which the index has no field for: the year becomes the
 * range it stands for, `<id>Start` and `<id>End`. The advanced panel writes those same two ids, so
 * a bound it has already set is left alone rather than widened back out to the year.
 *
 * A typed column - a name - is one value rather than a list, so it is trimmed and percent-encoded
 * here: the API layer splits a filter on commas into one `and[]` each and otherwise passes the
 * text through raw, which would tear a typed name in two and let a `#` end the query string.
 */
export function toWireFilters(
  filters: FilterValues,
  yearIds: string[] = [],
  textIds: string[] = [],
): Record<string, string> {
  const wire: Record<string, string> = {};
  const years: Record<string, string> = {};
  for (const [id, value] of Object.entries(filters)) {
    const joined = Array.isArray(value) ? value.join(',') : value;
    if (textIds.includes(id)) {
      // Blank is not a filter: `and[nameContains]=` narrows to nothing rather than to everything.
      const typed = joined.trim();
      if (typed !== '') wire[id] = encodeURIComponent(typed);
      continue;
    }
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
