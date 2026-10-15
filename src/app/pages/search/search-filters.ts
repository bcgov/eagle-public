import { gridCollator } from 'app/components/display-grid/grid-helpers';
import type { FilterValues, ValueOption } from 'app/components/display-grid/types';

/**
 * Filters as DEMI's native list takes them, under the name `wire` gives each URL id. A filter the
 * list does not take is left out. A list value goes out as a repeated parameter, which DEMI reads
 * as "any of these".
 *
 * A date column filters by a whole year, which no list has a field for: the year becomes the
 * range it stands for, `<id>Start` and `<id>End`. The advanced panel writes those same two ids, so
 * a bound it has already set is left alone rather than widened back out to the year.
 *
 * `labels` names the filters whose native parameter takes a name: the URL holds the option's id,
 * since a name can carry the comma the URL splits picks on, and the label goes on the wire.
 */
export function toNativeFilters(
  filters: FilterValues,
  yearIds: string[],
  wire: Record<string, string>,
  labels: Record<string, ValueOption[]> = {},
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
    const named = labels[id];
    byId[id] = named ? labelsOf(named, value) : value;
  }
  const native: Record<string, string | string[]> = {};
  for (const [id, value] of Object.entries(byId)) {
    const name = wire[id];
    if (name) native[name] = value;
  }
  return native;
}

/** The labels picks stand for, once each; a pick with no option goes as it is. */
function labelsOf(options: ValueOption[], value: string | string[]): string | string[] {
  const picks = Array.isArray(value) ? value : [value];
  const named = [
    ...new Set(picks.map((pick) => options.find((option) => option.value === pick)?.label ?? pick)),
  ];
  return named.length === 1 ? (named[0] as string) : named;
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

/**
 * The distinct values one field holds across the rows on the page, A to Z, for a filter no lookup
 * lists. Stored text often carries a stray trailing space, so values are trimmed and merged.
 */
export function rowValueOptions(rows: Record<string, unknown>[], key: string): ValueOption[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') values.add(value.trim());
  }
  return [...values].sort(gridCollator.compare).map((value) => ({ value, label: value }));
}

/**
 * Options read off the page's rows, plus every pick in force the page no longer shows, so a choice
 * never drops out of its own menu (the rows a filter leaves hold only the values it picked).
 */
export function withChosen(
  options: ValueOption[],
  chosen: FilterValues[string] | undefined,
): ValueOption[] {
  const picks = chosen == null ? [] : Array.isArray(chosen) ? chosen : [chosen];
  const missing = picks.filter(
    (pick) => pick !== '' && !options.some((option) => option.value === pick),
  );
  if (missing.length === 0) return options;
  return [...options, ...missing.map((pick) => ({ value: pick, label: pick }))].sort((a, b) =>
    gridCollator.compare(a.label, b.label),
  );
}

/**
 * Lookup options with any read off the rows laid over them. A record type that reads none gets the
 * lookup object back as is, so what is built from it is not rebuilt each time rows land.
 */
export function withRowOptions(
  listed: Record<string, ValueOption[]>,
  fromRows: ((rows: Record<string, unknown>[]) => Record<string, ValueOption[]>) | undefined,
  rows: Record<string, unknown>[],
  filters: FilterValues,
): Record<string, ValueOption[]> {
  if (!fromRows) return listed;
  const all = { ...listed };
  for (const [id, found] of Object.entries(fromRows(rows))) {
    all[id] = withChosen(found, filters[id]);
  }
  return all;
}
