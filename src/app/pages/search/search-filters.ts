import { gridCollator } from 'app/components/display-grid/grid-helpers';
import type { FilterValue, FilterValues, ValueOption } from 'app/components/display-grid/types';

/**
 * Filters as DEMI's native list takes them, under the name `wire` gives each URL id. A filter the
 * list does not take is left out. A list value goes out as a repeated parameter, which DEMI reads
 * as "any of these".
 *
 * `labels` names the filters whose native parameter takes a name: the URL holds the option's id,
 * since a name can carry the comma the URL splits picks on, and the label goes on the wire.
 *
 * `textIds` names the typed filters. The URL splits a typed name on its commas too, so it is joined
 * back and trimmed: DEMI answers 400 for a repeated text parameter.
 */
export function toNativeFilters(
  filters: FilterValues,
  wire: Record<string, string>,
  labels: Record<string, ValueOption[]> = {},
  textIds: string[] = [],
): Record<string, string | string[]> {
  const native: Record<string, string | string[]> = {};
  for (const [id, value] of Object.entries(filters)) {
    const name = wire[id];
    if (!name) continue;
    if (textIds.includes(id)) {
      const typed = typedText(value);
      if (typed !== '') native[name] = typed;
      continue;
    }
    if (value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const named = labels[id];
    native[name] = named ? labelsOf(named, value) : value;
  }
  return native;
}

/** A typed filter as one string, however many commas the URL split it on. */
export function typedText(value: FilterValue): string {
  return (Array.isArray(value) ? value.join(',') : value).trim();
}

/** The labels picks stand for, once each; a pick with no option goes as it is. */
function labelsOf(options: ValueOption[], value: string | string[]): string | string[] {
  const picks = Array.isArray(value) ? value : [value];
  const named = [
    ...new Set(picks.map((pick) => options.find((option) => option.value === pick)?.label ?? pick)),
  ];
  return named.length === 1 ? (named[0] as string) : named;
}

/** Whether a list takes the URL filter `id`, directly or as the `<id>Start`/`End` range of a date column. */
export function takesFilter(wire: Record<string, string>, id: string): boolean {
  return id in wire || `${id}Start` in wire;
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
