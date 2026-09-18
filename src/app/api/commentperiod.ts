import * as api from './api';
import { CommentPeriod } from 'app/models/commentperiod';

// statuses / query param options
const NOT_STARTED = 'NS';
const NOT_OPEN = 'NO';
const CLOSED = 'CL';
const OPEN = 'OP';

// get all comment periods for the specified application id
export async function getAllByProjectId(
  projId: string,
): Promise<{ totalCount: number; data: CommentPeriod[] } | CommentPeriod[] | object> {
  const res = await api.getPeriodsByProjId(projId);
  if (!res) {
    return {};
  }
  if (res.length === 0) {
    return [] as CommentPeriod[];
  }
  return { totalCount: res.length, data: res.map((cp: any) => new CommentPeriod(cp)) };
}

/** eagle-api answers a bare array or a `{ totalCount, data }` envelope; both become a list. */
export function periodsOf(res: unknown): CommentPeriod[] {
  if (Array.isArray(res)) return res as CommentPeriod[];
  return (res as { data?: CommentPeriod[] })?.data ?? [];
}

/**
 * Every read of a project's comment periods shares this key, so a project view that draws both the
 * banner and the engagement list issues one request. Rows are cached raw; the list's normalizing is
 * a `select` on top.
 */
export function commentPeriodsQueryOptions(projId: string) {
  return {
    queryKey: ['commentPeriods', projId],
    enabled: !!projId,
    queryFn: async (): Promise<CommentPeriod[]> => periodsOf(await getAllByProjectId(projId)),
  };
}

export interface OpenPeriods {
  periods: CommentPeriod[];
  /** Periods closed in the last 30 days. Null when the backend did not count them. */
  closedCount: number | null;
}

/** Every comment period open now, across all projects, soonest to close first. */
export function openCommentPeriodsQueryOptions() {
  return {
    queryKey: ['openCommentPeriods'],
    // The rail shows its own error in place; retrying only holds the skeleton up.
    retry: false,
    queryFn: async (): Promise<OpenPeriods> => {
      const envelope = (await api.searchKeywords('', 'CommentPeriod', [], null, null, '', null, {
        status: 'open',
      })) as unknown as { searchResults?: unknown[]; closedCount?: unknown }[];
      const answer = envelope?.[0];
      return {
        // The dates decide "open" here too, so a cached answer never shows a period that has closed.
        periods: (answer?.searchResults ?? []).map((row) => new CommentPeriod(row)).filter(isOpen),
        closedCount: typeof answer?.closedCount === 'number' ? answer.closedCount : null,
      };
    },
  };
}

// get a specific comment period by its id
export async function getById(periodId: string): Promise<CommentPeriod> {
  const res = await api.getPeriod(periodId);
  // return the first (only) comment period
  const period = res && res.length > 0 ? new CommentPeriod(res[0]) : null;
  return (period ?? null) as unknown as CommentPeriod;
}

/** Given a comment period, returns status abbreviation. */
export function getStatusCode(commentPeriod: CommentPeriod): string {
  if (!commentPeriod || !commentPeriod.dateStarted || !commentPeriod.dateCompleted) {
    return NOT_OPEN;
  }
  switch (commentPeriod.commentPeriodStatus) {
    case 'Open':
      return OPEN;
    case 'Upcoming':
      return NOT_STARTED;
    case 'Closed':
      return CLOSED;
    default:
      return NOT_OPEN;
  }
}

export function isClosed(commentPeriod: CommentPeriod): boolean {
  return getStatusCode(commentPeriod) === CLOSED;
}

export function isNotStarted(commentPeriod: CommentPeriod): boolean {
  return getStatusCode(commentPeriod) === NOT_STARTED;
}

export function isOpen(commentPeriod: CommentPeriod): boolean {
  return getStatusCode(commentPeriod) === OPEN;
}
