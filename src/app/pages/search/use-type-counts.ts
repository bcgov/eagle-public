import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError, getJson, isAbortError, searchPath } from 'app/api/api';
import { fetchData, SearchParamObject } from 'app/api/search';
import { RECORD_TYPES, type RecordType } from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS, typeaheadKeywords } from 'app/components/filters/typeahead';
import { RECORD_DATASETS } from './types';

/** A count per record type. `null` is "unknown", which the tab renders without a badge. */
export type TypeCounts = Record<RecordType, number | null>;

export interface TypeCountsResult {
  /** Absent until a keyword long enough to search has settled. */
  counts?: TypeCounts;
  isFetching: boolean;
}

interface CountsEnvelope {
  counts?: Record<string, number | null>;
  meta?: { unavailable?: string[]; degraded?: string[]; cached?: boolean }[];
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

/**
 * What the tabs showed before `search/counts` existed: one one-row search per type, read for its
 * total. Four requests instead of one, which is why it is the fallback and not the path.
 */
async function countsFromSearches(keywords: string, signal?: AbortSignal): Promise<TypeCounts> {
  const totals = await Promise.all(
    RECORD_TYPES.map((id) =>
      fetchData(
        new SearchParamObject(`search-counts-${id}`, keywords, RECORD_DATASETS[id], [], 1, 1, ''),
        signal,
      ),
    ),
  );
  const out = unknownCounts();
  RECORD_TYPES.forEach((id, index) => {
    out[id] = totals[index]?.totalSearchCount ?? null;
  });
  return out;
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

/** Holds `value` back until it has stopped changing for `delay`. The first value passes straight. */
function useSettled(value: string, delay: number): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, settled, delay]);

  return settled;
}

/**
 * The totals the record-type tabs badge, on the same beat as the results: one request per typing
 * pause, nothing below the keyword floor, and the last answer left on screen while the next one
 * loads. A keyword change drops the request in flight through the query's abort signal.
 */
export function useTypeCounts(keywords: string): TypeCountsResult {
  const term = useSettled(typeaheadKeywords(keywords).trim(), TYPEAHEAD_DEBOUNCE_MS);

  const { data, isFetching } = useQuery({
    queryKey: ['search-counts', term],
    queryFn: ({ signal }) => readCounts(term, signal),
    enabled: term !== '',
    placeholderData: keepPreviousData,
  });

  return { counts: data, isFetching };
}
