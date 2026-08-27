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

export interface TableResult {
  data: any[];
  totalListItems: number;
  loading: boolean;
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
    queryFn: () =>
      fetchData(
        new SearchParamObject(
          id,
          params.keywords ?? '',
          params.dataset,
          params.fields ?? [],
          params.currentPage,
          params.pageSize,
          params.sortBy,
          params.queryModifiers ?? {},
          params.populate ?? false,
          params.secondarySort ?? '',
          params.filters ?? {},
          params.projectLegislation ?? '',
          params.fuzzy ?? false
        )
      )
  });

  // SearchResults defaults `data` to 0, not [], when the response carried no results.
  return {
    data: Array.isArray(query.data?.data) ? query.data.data : [],
    totalListItems: query.data?.totalSearchCount ?? 0,
    loading: query.isFetching
  };
}
