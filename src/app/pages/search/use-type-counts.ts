import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { documentCount, kindTotal } from 'app/api/unified-search';
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
 * Every tab's total for one keyword. `/counts` measures documents; the other kinds are counted one
 * list read each, projects with the notifications their tab lists beside them.
 */
async function readCounts(q: string, signal?: AbortSignal): Promise<TypeCounts> {
  const [projects, documents, activities, commentPeriods] = await Promise.all([
    kindTotal('project-records', { q }, signal),
    documentCount(q, signal),
    kindTotal('updates', { q }, signal),
    kindTotal('comment-periods', { q }, signal),
  ]);
  return { projects, documents, activities, commentPeriods };
}

/**
 * The totals the record-type tabs badge: one request per typing pause, the last answer kept on
 * screen while the next loads. An empty keyword counts everything, as the tabs show on open.
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
