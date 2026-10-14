import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readDocuments, type DocumentQuery } from 'app/api/document';
import type { Document } from 'app/models/document';

export interface TableQueryConfig extends DocumentQuery {
  /** Holds the request back until the caller has everything it needs (filter lists, a route param). */
  enabled?: boolean;
}

interface TableResult {
  data: Document[];
  totalListItems: number;
  loading: boolean;
  /** First load with nothing to show yet; false for a refetch, a placeholder page, or a disabled query. */
  initialLoading: boolean;
}

/**
 * One document table's server state, keyed by table id so two tables on a page never share a cache
 * entry. TanStack Query dedupes concurrent identical requests and keeps the result between mounts.
 */
export function useTable(id: string, config: TableQueryConfig): TableResult {
  const { enabled = true, ...query } = config;

  const result = useQuery({
    queryKey: ['table', id, query],
    enabled,
    // The last page stays on screen while the next one loads, so typing a keyword does not blank
    // the table between keystrokes. `signal` drops the request the next keystroke supersedes.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => readDocuments(query, signal),
  });

  return {
    data: result.data?.rows ?? [],
    totalListItems: result.data?.total ?? 0,
    loading: result.isFetching,
    initialLoading: result.isLoading,
  };
}
