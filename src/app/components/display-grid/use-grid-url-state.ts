import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  normalizeSortBy,
  paramsToObject,
  toSearchParams,
  toggleSortDirection,
  type Params,
} from 'app/components/table/table-params';
import type { FilterValue, FilterValues } from './types';

export type RecordType = 'projects' | 'documents' | 'activities' | 'notifications';
export type SearchScope = 'names' | 'inside';

export const RECORD_TYPES: RecordType[] = ['projects', 'documents', 'activities', 'notifications'];
export const PAGE_SIZES = [10, 25, 50, 100];

/* Documents: what a bare /search has always listed, from the Angular page through to the design. */
export const DEFAULT_RECORD: RecordType = 'documents';
export const DEFAULT_PAGE_SIZE = 25;
/** Names & details sorts by posted date; inside-document search sorts by match count. */
export const DEFAULT_SORT = '-datePosted';
export const INSIDE_SORT = '-matches';

/** URL keys the grid owns. Anything else on the query string is a filter id. */
const RESERVED = ['keywords', 'record', 'scope', 'sortBy', 'currentPage', 'pageSize', 'cols'];

/**
 * What `cols` carries once the reader has switched on every column of a record type that starts
 * with one off. An absent `cols` means "the record type's own default", so an empty list needs a
 * value of its own to say the reader chose it. No column key can be `none`.
 */
const NO_HIDDEN_COLUMNS = 'none';

/** One identity, so a caller that names no default columns does not re-parse the URL each render. */
const NO_COLUMNS: string[] = [];

function readHiddenColumns(raw: unknown, byDefault: string[]): string[] {
  if (raw == null || raw === '') return byDefault;
  if (raw === NO_HIDDEN_COLUMNS) return [];
  return String(raw).split(',').filter(Boolean);
}

function writeHiddenColumns(hidden: string[], byDefault: string[]): string | null {
  if (hidden.length > 0) return hidden.join(',');
  return byDefault.length > 0 ? NO_HIDDEN_COLUMNS : null;
}

export interface GridUrlState {
  keywords: string;
  record: RecordType;
  scope: SearchScope;
  sortBy: string;
  /** 1-based, as the API counts pages. */
  currentPage: number;
  pageSize: number;
  /** Columns the reader has switched off. */
  hiddenColumns: string[];
  /** Filter id to value. A multi-value filter carries an array. */
  filters: FilterValues;
}

export interface GridDefaults {
  /** Sort applied when the URL names none, and restored when the scope returns to names. */
  defaultSort?: string;
  defaultRecord?: RecordType;
  defaultPageSize?: number;
  /** Columns a record type starts with switched off, until the URL says otherwise. */
  defaultHiddenColumns?: string[];
}

function readFilterValue(raw: string): FilterValue {
  // A comma is how a multi-select column writes several picks; a single pick stays a string so
  // callers do not have to unwrap one-element arrays everywhere.
  return raw.includes(',') ? raw.split(',').filter((part) => part !== '') : raw;
}

/** Reads the grid's URL schema off a query string. Pure, so the legacy redirect can reuse it. */
export function parseGridParams(
  search: URLSearchParams,
  defaults: GridDefaults = {},
): GridUrlState {
  const params = paramsToObject(search);
  const record = RECORD_TYPES.includes(params['record'] as RecordType)
    ? (params['record'] as RecordType)
    : (defaults.defaultRecord ?? DEFAULT_RECORD);
  const scope: SearchScope = params['scope'] === 'inside' ? 'inside' : 'names';

  const page = Number.parseInt(String(params['currentPage'] ?? ''), 10);
  const size = Number.parseInt(String(params['pageSize'] ?? ''), 10);

  const filters: FilterValues = {};
  for (const [key, value] of Object.entries(params)) {
    if (RESERVED.includes(key) || value == null || value === '') continue;
    filters[key] = readFilterValue(String(value));
  }

  return {
    keywords: String(params['keywords'] ?? ''),
    record,
    scope,
    sortBy: params['sortBy']
      ? normalizeSortBy(String(params['sortBy']))
      : scope === 'inside'
        ? INSIDE_SORT
        : (defaults.defaultSort ?? DEFAULT_SORT),
    currentPage: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZES.includes(size) ? size : (defaults.defaultPageSize ?? DEFAULT_PAGE_SIZE),
    hiddenColumns: readHiddenColumns(params['cols'], defaults.defaultHiddenColumns ?? []),
    filters,
  };
}

/** The inverse: state back to a query string, with defaults and empty values left out. */
export function serializeGridParams(
  state: GridUrlState,
  defaults: GridDefaults = {},
): URLSearchParams {
  const out: Params = {
    keywords: state.keywords || null,
    record: state.record === (defaults.defaultRecord ?? DEFAULT_RECORD) ? null : state.record,
    scope: state.scope === 'names' ? null : state.scope,
    sortBy: state.sortBy || null,
    currentPage: state.currentPage > 1 ? state.currentPage : null,
    pageSize:
      state.pageSize === (defaults.defaultPageSize ?? DEFAULT_PAGE_SIZE) ? null : state.pageSize,
    cols: writeHiddenColumns(state.hiddenColumns, defaults.defaultHiddenColumns ?? []),
  };

  for (const [id, value] of Object.entries(state.filters)) {
    const joined = Array.isArray(value) ? value.join(',') : value;
    out[id] = joined || null;
  }

  return toSearchParams(out);
}

/** Filters in the shape the API takes them: `and[<id>]=a,b`. */
export function toApiFilters(filters: FilterValues): Record<string, string> {
  const wire: Record<string, string> = {};
  for (const [id, value] of Object.entries(filters)) {
    const joined = Array.isArray(value) ? value.join(',') : value;
    if (joined) wire[`and[${id}]`] = joined;
  }
  return wire;
}

export interface GridUrlApi {
  state: GridUrlState;
  setKeyword: (keywords: string) => void;
  setRecord: (record: RecordType) => void;
  setScope: (scope: SearchScope) => void;
  setFilter: (id: string, value: FilterValue | null) => void;
  /** Same key twice flips the direction; a new key starts at `fallback`. */
  setSort: (key: string, fallback?: '+' | '-') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setHiddenColumns: (keys: string[]) => void;
  clearFilters: () => void;
  clearAll: () => void;
}

/**
 * The grid's whole reader-visible state, held in the address bar so a view can be linked and
 * shared. Writes replace the history entry: typing a keyword must not fill the back button with
 * one entry per character.
 */
export function useGridUrlState(defaults: GridDefaults = {}): GridUrlApi {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    defaultSort = DEFAULT_SORT,
    defaultRecord = DEFAULT_RECORD,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultHiddenColumns = NO_COLUMNS,
  } = defaults;

  // Depend on the values, not the options object: a caller passing an object literal would
  // otherwise re-parse the URL on every render.
  const state = useMemo(
    () =>
      parseGridParams(searchParams, {
        defaultSort,
        defaultRecord,
        defaultPageSize,
        defaultHiddenColumns,
      }),
    [searchParams, defaultSort, defaultRecord, defaultPageSize, defaultHiddenColumns],
  );

  const write = useCallback(
    (next: Params) => {
      setSearchParams(toSearchParams(next), { replace: true });
    },
    [setSearchParams],
  );

  const current = useCallback(() => paramsToObject(searchParams), [searchParams]);

  const setKeyword = useCallback(
    (keywords: string) => {
      // A new term can push the reader past the end of the result set, so paging restarts.
      write({ ...current(), keywords: keywords.trim() || null, currentPage: null });
    },
    [current, write],
  );

  const setRecord = useCallback(
    (record: RecordType) => {
      // The keyword carries across record types; filters, sort and scope belong to one type.
      write({
        keywords: state.keywords || null,
        record: record === defaultRecord ? null : record,
      });
    },
    [state.keywords, defaultRecord, write],
  );

  const setScope = useCallback(
    (scope: SearchScope) => {
      write({
        ...current(),
        scope: scope === 'names' ? null : scope,
        // Inside documents ranks by how many passages matched; names & details by date.
        sortBy: scope === 'inside' ? INSIDE_SORT : defaultSort,
        currentPage: null,
      });
    },
    [current, defaultSort, write],
  );

  const setFilter = useCallback(
    (id: string, value: FilterValue | null) => {
      const joined = Array.isArray(value) ? value.join(',') : value;
      write({ ...current(), [id]: joined || null, currentPage: null });
    },
    [current, write],
  );

  const setSort = useCallback(
    (key: string, fallback: '+' | '-' = '+') => {
      write({
        ...current(),
        sortBy: toggleSortDirection(state.sortBy, key, fallback),
        currentPage: null,
      });
    },
    [current, state.sortBy, write],
  );

  const setPage = useCallback(
    (page: number) => {
      write({ ...current(), currentPage: page > 1 ? page : null });
    },
    [current, write],
  );

  const setPageSize = useCallback(
    (size: number) => {
      write({ ...current(), pageSize: size, currentPage: null });
    },
    [current, write],
  );

  const setHiddenColumns = useCallback(
    (keys: string[]) => {
      write({ ...current(), cols: writeHiddenColumns(keys, defaultHiddenColumns) });
    },
    [current, defaultHiddenColumns, write],
  );

  const clearFilters = useCallback(() => {
    const params = current();
    const kept: Params = {};
    for (const key of RESERVED) {
      if (params[key] != null) kept[key] = params[key];
    }
    kept['currentPage'] = null;
    write(kept);
  }, [current, write]);

  const clearAll = useCallback(() => {
    // What the chip row's "Clear all" undoes: the keyword and every filter. How the reader has
    // arranged the grid — record type, sort, columns, page size — is not a narrowing.
    const params = current();
    write({
      record: params['record'] ?? null,
      scope: params['scope'] ?? null,
      sortBy: params['sortBy'] ?? null,
      pageSize: params['pageSize'] ?? null,
      cols: params['cols'] ?? null,
    });
  }, [current, write]);

  return {
    state,
    setKeyword,
    setRecord,
    setScope,
    setFilter,
    setSort,
    setPage,
    setPageSize,
    setHiddenColumns,
    clearFilters,
    clearAll,
  };
}
