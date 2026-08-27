import { Constants } from 'app/utils/constants';
import type { TableObject } from './table-object';

export type Params = Record<string, any>;

/**
 * `URLSearchParams` form-decodes `+` to a space, so an Angular-era deep link such as
 * `?sortBy=+name` arrives here as `" name"`. Restore the sign rather than issuing a request the
 * API cannot sort by.
 */
export function normalizeSortBy(value: string): string {
  return value.startsWith(' ') ? `+${value.slice(1)}` : value;
}

/** Reads the standard table params off the URL. `suffix` scopes them to one table on a page. */
export function updateTableObjectWithUrlParams(routeParams: Params, table: TableObject, suffix = ''): TableObject {
  const updated = { ...table };

  for (const [key, value] of Object.entries(routeParams)) {
    if (value == null || value === '') {
      continue;
    }

    if (key === `currentPage${suffix}` || key === `pageSize${suffix}`) {
      (updated as Params)[key.replace(suffix, '')] = +value;
    } else if (key === `sortBy${suffix}`) {
      updated.sortBy = normalizeSortBy(String(value));
    }
  }

  updated.pageSize ??= Constants.tableDefaults.DEFAULT_PAGE_SIZE;
  updated.currentPage ??= Constants.tableDefaults.DEFAULT_CURRENT_PAGE;
  updated.sortBy ??= Constants.tableDefaults.DEFAULT_SORT_BY;

  return updated;
}

/** Picks the named filters out of the URL params and comma-joins any array values, for the API. */
export function getFiltersFromParams(params: Params, filterLabels: string[]): Record<string, string> {
  const filterForAPI: Record<string, string> = {};

  for (const filterLabel of filterLabels) {
    const value = params[filterLabel];
    if (value != null) {
      filterForAPI[filterLabel] = Array.isArray(value) ? value.join() : value;
    }
  }

  return filterForAPI;
}

/**
 * Filters from a search package, as URL params. Filters the package omits come back as `null` so
 * the merge drops them from the URL instead of leaving a stale value behind.
 */
export function getFiltersFromSearchPackage(
  searchPackage: { filters: Params },
  filtersList: string[] = [],
  dateFiltersList: string[] = []
): Params {
  const allFilters = [...filtersList, ...dateFiltersList];
  const extracted = getFiltersFromParams(searchPackage.filters, allFilters);

  const params: Params = {};
  for (const filterName of allFilters) {
    params[filterName] = extracted[filterName] ?? null;
  }

  return params;
}

/** Query params as a plain object, so callers can merge before writing back. */
export function paramsToObject(search: URLSearchParams): Params {
  return Object.fromEntries(search.entries());
}

/** Drops null/undefined/empty entries, matching how the Angular router omitted them. */
export function toSearchParams(params: Params): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') {
      continue;
    }
    next.set(key, String(value));
  }
  return next;
}

/**
 * Flips the sort direction when the same column is clicked again, otherwise starts at `fallback`.
 * Matches the whole field name: `+displayName` and a click on `name` are different columns.
 */
export function toggleSortDirection(currentSort: string | undefined, field: string, fallback: '+' | '-' = '+'): string {
  if (currentSort && currentSort.replace(/^[+-]/, '') === field) {
    return (currentSort[0] === '+' ? '-' : '+') + field;
  }
  return fallback + field;
}
