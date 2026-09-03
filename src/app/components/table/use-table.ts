import { useQuery } from '@tanstack/react-query';
import { fetchData, SearchParamObject } from 'app/api/search';

export interface TableQueryConfig {
  dataset: string;
  currentPage: number;
  pageSize: number;
  sortBy: string;
  keywords?: string;
  /** Extra `&name=value` query params, e.g. `[{ name: 'project', value: projId }]`. */
  fields?: { name: string; value: string }[];
  queryModifiers?: Record<string, string>;
  populate?: boolean;
  secondarySort?: string;
  filters?: Record<string, string>;
  projectLegislation?: string;
  fuzzy?: boolean;
  /** Holds the request back until the caller has everything it needs (filter lists, a route param). */
  enabled?: boolean;
}

interface TableResult {
  data: any[];
  totalListItems: number;
  loading: boolean;
}

/** The request a table config describes. Select-all reruns the same one at page 1, size 100. */
export function tableSearchParams(id: string, config: TableQueryConfig): SearchParamObject {
  return new SearchParamObject(
    id,
    config.keywords ?? '',
    config.dataset,
    config.fields ?? [],
    config.currentPage,
    config.pageSize,
    config.sortBy,
    config.queryModifiers ?? {},
    config.populate ?? false,
    config.secondarySort ?? '',
    config.filters ?? {},
    config.projectLegislation ?? '',
    config.fuzzy ?? false,
  );
}

/**
 * One table's server state, keyed by table id so two tables on a page never share a cache entry.
 * Replaces the Angular TableService signal map; TanStack Query dedupes concurrent identical
 * requests and keeps the result between mounts.
 */
export function useTable(id: string, config: TableQueryConfig): TableResult {
  const { enabled = true, ...params } = config;

  const query = useQuery({
    queryKey: ['table', id, params],
    enabled,
    queryFn: () => fetchData(tableSearchParams(id, params)),
  });

  // SearchResults defaults `data` to 0, not [], when the response carried no results.
  return {
    data: Array.isArray(query.data?.data) ? query.data.data : [],
    totalListItems: query.data?.totalSearchCount ?? 0,
    loading: query.isFetching,
  };
}
