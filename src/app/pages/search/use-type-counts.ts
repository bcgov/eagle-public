import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError, getJson, isAbortError, searchPath } from 'app/api/api';
import { getSearchResults } from 'app/api/search';
import { RECORD_TYPES, type RecordType } from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { logger } from 'app/config/logging';
import { RECORD_DATASETS } from './types';
import { useSettled } from './use-settled';

/** A count per record type. `null` is "unknown", which the tab renders without a badge. */
export type TypeCounts = Record<RecordType, number | null>;

export interface TypeCountsResult {
  /** Absent until a keyword long enough to search has settled. */
  counts?: TypeCounts;
}

interface CountsEnvelope {
  counts?: Record<string, number | null>;
}

/**
 * Set by the one 404 this session is allowed to take. An endpoint that is not deployed will not
 * appear halfway through a visit, so the page probes `search/counts` once and then stops asking.
 */
let countsUnsupported = false;

/** A total per record type, none of them known. */
function unknownCounts(): TypeCounts {
  return Object.fromEntries(RECORD_TYPES.map((id) => [id, null])) as TypeCounts;
}

/** The endpoint answers per dataset name, and omits or nulls a type it could not measure. */
function fromEnvelope(envelope: CountsEnvelope[]): TypeCounts {
  const counts = envelope?.[0]?.counts ?? {};
  const out = unknownCounts();
  for (const id of RECORD_TYPES) {
    const value = counts[RECORD_DATASETS[id]];
    out[id] = typeof value === 'number' ? value : null;
  }
  return out;
}

/** One type's total from a one-row search; null when the search failed or sent no total. */
async function searchTotal(
  id: RecordType,
  keywords: string,
  signal?: AbortSignal,
): Promise<number | null> {
  // Not `fetchData`: it answers a failed search as an empty one, which would badge the tab 0.
  const res = await getSearchResults(
    keywords,
    RECORD_DATASETS[id],
    [],
    1,
    1,
    '',
    {},
    false,
    null,
    {},
    '',
    false,
    signal,
  );
  if (!res) {
    logger.warn('Count search failed; the tab shows no badge', 'search-counts', id);
    return null;
  }
  const meta = res[0]?.data?.meta;
  // eagle-api answers zero hits with an empty `meta`.
  if (Array.isArray(meta) && meta.length === 0) return 0;
  const total = meta?.[0]?.searchResultsTotal;
  return typeof total === 'number' ? total : null;
}

/**
 * What the tabs showed before `search/counts` existed: one one-row search per type, read for its
 * total. One request per type instead of one in all, which is why it is the fallback and not the path.
 */
async function countsFromSearches(keywords: string, signal?: AbortSignal): Promise<TypeCounts> {
  const totals = await Promise.all(RECORD_TYPES.map((id) => searchTotal(id, keywords, signal)));
  return Object.fromEntries(RECORD_TYPES.map((id, index) => [id, totals[index]])) as TypeCounts;
}

async function readCounts(keywords: string, signal?: AbortSignal): Promise<TypeCounts> {
  if (!countsUnsupported) {
    try {
      return fromEnvelope(
        await getJson<CountsEnvelope[]>(
          `${searchPath()}/search/counts?keywords=${encodeURIComponent(keywords)}`,
          { signal, quiet404: true },
        ),
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      countsUnsupported = true;
    }
  }
  return countsFromSearches(keywords, signal);
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
