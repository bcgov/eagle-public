import { queryOptions, skipToken } from '@tanstack/react-query';
import { typeaheadKeywords } from 'app/components/filters/typeahead';
import { getDemiApiPath } from 'app/config/config';
import { getJson } from './api';
import type { SearchKind } from './unified-search';

/** The fields that can name each kind's suggestion; DEMI drops rows holding none of them. */
const LABEL_FIELDS = {
  projects: ['name'],
  documents: ['displayName'],
  updates: ['headline'],
  notifications: ['name'],
  'comment-periods': ['informationLabel', 'projectName'],
} as const satisfies Record<SearchKind, readonly string[]>;

/** Most rows one suggestion list shows; DEMI refuses a larger `limit`. */
export const SUGGEST_LIMIT = 8;

const STALE_MS = 60 * 1000;

// The fields DEMI's `/suggest` keeps per kind; every other field of the record is dropped.
export interface ProjectSuggestion {
  id: string;
  eagleId?: string;
  name?: string;
}
export interface DocumentSuggestion {
  id: string;
  displayName?: string;
  projectId?: string;
  projectEagleId?: string;
  projectName?: string;
}
export interface UpdateSuggestion {
  id: string;
  headline?: string;
  projectId?: string;
  projectEagleId?: string;
  projectName?: string;
  notificationName?: string;
}
export interface NotificationSuggestion {
  id: string;
  name?: string;
  associatedProjectId?: string;
}
export interface CommentPeriodSuggestion {
  id: string;
  informationLabel?: string;
  projectId?: string;
  projectEagleId?: string;
  projectName?: string;
}

interface SuggestionsByKind {
  projects: ProjectSuggestion;
  documents: DocumentSuggestion;
  updates: UpdateSuggestion;
  notifications: NotificationSuggestion;
  'comment-periods': CommentPeriodSuggestion;
}

export type SuggestItem<K extends SearchKind = SearchKind> = SuggestionsByKind[K];

/** The few rows whose names start like `q`, slimmed by DEMI to what a suggestion shows. */
export async function getSuggestions<K extends SearchKind>(
  kind: K,
  q: string,
  signal?: AbortSignal,
): Promise<SuggestItem<K>[]> {
  const query = new URLSearchParams({ kind, q, limit: String(SUGGEST_LIMIT) });
  const body = await getJson<{ items?: unknown }>(`${getDemiApiPath()}/suggest?${query}`, {
    signal,
  });
  if (!Array.isArray(body?.items)) return [];
  const fields: readonly string[] = LABEL_FIELDS[kind];
  return (body.items as unknown[]).filter((item): item is SuggestItem<K> =>
    fields.some((field) => typeof (item as Record<string, unknown> | null)?.[field] === 'string'),
  );
}

/** The `useQuery` options for one kind and keyword. Too short a keyword asks nothing. */
export function suggestQueryOptions(kind: SearchKind, q: string) {
  // DEMI matches case-blind (Cosmos CONTAINS ignoreCase, en.microsoft analyzer), so "Cedar" and
  // "cedar" share one cache entry and one request.
  const keywords = typeaheadKeywords(q).trim().toLowerCase();
  return queryOptions({
    queryKey: ['suggest', kind, keywords] as const,
    queryFn:
      keywords !== ''
        ? ({ signal }): Promise<SuggestItem[]> => getSuggestions(kind, keywords, signal)
        : skipToken,
    // A failed suggestion shows the full-search row at once rather than after ~7 s of retries.
    retry: false,
    // Keeps the last rows up while the next keyword loads, but never another kind's rows.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === kind ? previous : undefined,
    staleTime: STALE_MS,
  });
}
