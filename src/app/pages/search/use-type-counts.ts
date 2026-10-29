import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { kindTotal, projectAndDocumentCounts } from 'app/api/unified-search';
import type { RecordType } from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { useSettled } from './use-settled';

/** A count per record type. `null` is "unknown", which the tab renders without a badge. */
export type TypeCounts = Record<RecordType, number | null>;

export interface TypeCountsResult {
  /** Absent until a keyword long enough to search has settled. */
  counts?: TypeCounts;
}

/**
 * Every tab's total for one keyword. `/counts` measures projects and documents in one request;
 * the other kinds are counted one list read each.
 */
async function readCounts(q: string, signal?: AbortSignal): Promise<TypeCounts> {
  const [both, activities, notifications, commentPeriods] = await Promise.all([
    projectAndDocumentCounts(q, signal),
    kindTotal('updates', { q }, signal),
    kindTotal('notifications', { q }, signal),
    kindTotal('comment-periods', { q }, signal),
  ]);
  return { ...both, activities, notifications, commentPeriods };
}

/**
 * The totals the record-type tabs badge, on the same beat as the results: one request per typing
 * pause and the last answer left on screen while the next one loads. An empty keyword counts
 * everything, which is what the tabs show when the page opens. A keyword change drops the request
 * in flight through the query's abort signal.
 */
export function useTypeCounts(keywords: string): TypeCountsResult {
  const term = useSettled(typeaheadKeywords(keywords).trim(), TYPEAHEAD_DEBOUNCE_MS);

  const { data } = useQuery({
    queryKey: ['search-counts', term],
    queryFn: ({ signal }) => readCounts(term, signal),
    placeholderData: keepPreviousData,
  });

  return { counts: data };
}
