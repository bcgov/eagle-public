import { useQuery } from '@tanstack/react-query';
import { ApiError, getJson } from './api';
import { getAllFull } from './project';
import { getApiPath, getDemiProjectsPath, getSearchApiPath } from 'app/config/config';

/**
 * One Track work phase, as DEMI mirrors it onto the project document's `phases`. The rail uses
 * only the name and the two dates; the document carries more (`numberOfDays`, `legislated`, …).
 */
export interface Phase {
  name: string;
  startDate: string | null;
  endDate: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * The `phases` of a DEMI project document, defensively. The payload is public JSON from another
 * service, so a missing array, a non-object row or a non-string date drops out rather than
 * reaching the rail. Rows keep the order DEMI sends, which is `sortOrder`.
 */
export function phasesOf(payload: unknown): Phase[] {
  const rows = (payload as { phases?: unknown } | null | undefined)?.phases;
  if (!Array.isArray(rows)) return [];

  const phases: Phase[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const { name, startDate, endDate } = row as Record<string, unknown>;
    const named = text(name);
    if (named) phases.push({ name: named, startDate: text(startDate), endDate: text(endDate) });
  }
  return phases;
}

/** The DEMI project document fields the public app reads, beyond `phases` (see {@link Phase}). */
export interface DemiProject {
  phases?: unknown[];
  shortUrl?: string;
  /** EA certificate number, e.g. `E23-01`. No source has the conditions count it carries. */
  eaCertificate?: string;
}

/**
 * Query options for the single-project DEMI fetch, shared by every consumer that needs a field
 * off that document (phase dates, the short link, …) so they collapse onto one request via the
 * shared query key. Disabled when DEMI_PROJECTS_PATH is unset — that empty path is the feature's
 * off switch and asks for nothing.
 */
function demiProjectQuery(projId: string) {
  const base = getDemiProjectsPath();
  return {
    queryKey: ['demi-project', projId],
    enabled: !!base && !!projId,
    retry: false,
    queryFn: async (): Promise<DemiProject | null> => {
      try {
        return await getJson<DemiProject>(`${base}/${encodeURIComponent(projId)}`, {
          quiet404: true,
        });
      } catch (err) {
        // 404 means DEMI has no record for this project — an answer, not a failure.
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}

/** The raw DEMI project document. `data` is `undefined` while in flight or when DEMI is off. */
export function useDemiProject(projId: string) {
  return useQuery(demiProjectQuery(projId));
}

/**
 * A project's EA certificate number, from the DEMI project document when it carries one and from
 * the project search hit otherwise. `undefined` while loading, when neither source has it, or when
 * eagle-api answers search — that backend has no such field.
 *
 * Only demi-search's keywordless list carries `eaCertificate`; an id-filtered search is answered by
 * the index, which has no such column. So the fallback reads the whole list under the map's own
 * query key and picks the project out of it, sharing that one cached response.
 */
export function useProjectEaCertificate(projId: string): string | undefined {
  const demi = useDemiProject(projId);
  const fromDemi = demi.data?.eaCertificate?.trim();
  const { data: hit } = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getAllFull(1, 1000000),
    // `isFetching`, not `isPending`: a disabled DEMI query stays pending forever.
    enabled: !fromDemi && !demi.isFetching && !!projId && getSearchApiPath() !== getApiPath(),
    select: (projects) => projects.find((project) => project._id === projId),
  });
  return fromDemi || hit?.eaCertificate?.trim() || undefined;
}

/** A project's Track work phases from DEMI, `null` while loading, when DEMI is off, or absent. */
export function useProjectPhases(projId: string): Phase[] | null {
  const { data } = useQuery({ ...demiProjectQuery(projId), select: phasesOf });
  return data ?? null;
}
