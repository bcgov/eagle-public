import * as api from './api';
import { logger } from 'app/config/logging';
import { CommentPeriod, projectIdOf } from 'app/models/commentperiod';

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

/** A project's comment-period state on the projects map. */
export type Engagement = 'open' | 'upcoming';

/** Mid-sentence wording of each state; capitalize the first letter to lead with it. */
export const ENGAGEMENT_LABEL: Record<Engagement, string> = {
  open: 'open for public comment',
  upcoming: 'public comment period coming soon',
};

interface PeriodSearchPage {
  searchResults?: unknown[];
  closedCount?: unknown;
}

/** demi-search 400s above 100 rows for an anonymous request, and public visitors are anonymous. */
const ANONYMOUS_PAGE_SIZE_CAP = 100;

/** If the cap is hit, the page keeps the periods that close or start soonest. */
const STATUS_SORT: Record<Engagement, string> = {
  open: '+dateCompleted',
  upcoming: '+dateStarted',
};

/** One page of every project's comment periods in the given state, as `and[status]` reads it. */
async function searchPeriodsByStatus(status: Engagement): Promise<PeriodSearchPage | undefined> {
  const envelope = (await api.searchKeywords(
    '',
    'CommentPeriod',
    [],
    1,
    ANONYMOUS_PAGE_SIZE_CAP,
    '',
    STATUS_SORT[status],
    { status },
  )) as unknown as PeriodSearchPage[];
  const page = envelope?.[0];
  if ((page?.searchResults?.length ?? 0) >= ANONYMOUS_PAGE_SIZE_CAP) {
    logger.warn(
      `${status} comment periods filled one page of ${ANONYMOUS_PAGE_SIZE_CAP}; the rest are not shown`,
      'commentperiod',
    );
  }
  return page;
}

/** Every comment period open now, across all projects, soonest to close first. */
export function openCommentPeriodsQueryOptions() {
  return {
    queryKey: ['openCommentPeriods'],
    // The rail shows its own error in place; retrying only holds the skeleton up.
    retry: false,
    queryFn: async (): Promise<OpenPeriods> => {
      const answer = await searchPeriodsByStatus('open');
      return {
        // Drops rows whose dates disagree with the server's status at fetch time.
        periods: (answer?.searchResults ?? []).map((row) => new CommentPeriod(row)).filter(isOpen),
        closedCount: typeof answer?.closedCount === 'number' ? answer.closedCount : null,
      };
    },
  };
}

/** Every comment period not started yet, across all projects. */
export function upcomingCommentPeriodsQueryOptions() {
  return {
    queryKey: ['upcomingCommentPeriods'],
    retry: false,
    queryFn: async (): Promise<CommentPeriod[]> =>
      // Checked at fetch time only; `engagementPeriodsByProject` re-reads the dates when it runs.
      ((await searchPeriodsByStatus('upcoming'))?.searchResults ?? [])
        .map((row) => new CommentPeriod(row))
        .filter(isNotStarted),
  };
}

/** A project's open or upcoming comment period, with the state it is in. */
export interface ProjectEngagement {
  state: Engagement;
  period: CommentPeriod;
}

const ENGAGEMENT_OF: Partial<Record<CommentPeriod['bannerState'], Engagement>> = {
  Open: 'open',
  Upcoming: 'upcoming',
};

/** Open beats upcoming; then the open period closing first, or the upcoming one starting first. */
function outranks(next: ProjectEngagement, held: ProjectEngagement): boolean {
  if (next.state !== held.state) return next.state === 'open';
  const date = next.state === 'open' ? 'dateCompleted' : 'dateStarted';
  const diff = next.period[date].getTime() - held.period[date].getTime();
  return diff < 0 || (diff === 0 && next.period._id < held.period._id);
}

/** Each open or upcoming period with its project id and state, read from its dates now. */
function* engagedPeriods(
  open: CommentPeriod[],
  upcoming: CommentPeriod[],
): Generator<ProjectEngagement & { id: string }> {
  for (const period of [...open, ...upcoming]) {
    const state = ENGAGEMENT_OF[period.bannerState];
    const id = projectIdOf(period);
    if (state && id) yield { id, state, period };
  }
}

/**
 * Project id to its engagement. The state comes from each period's dates as of this call, not the
 * list it was fetched in, so a cached period that has since opened or closed is read as it is now.
 */
export function engagementPeriodsByProject(
  open: CommentPeriod[],
  upcoming: CommentPeriod[],
): Map<string, ProjectEngagement> {
  const byId = new Map<string, ProjectEngagement>();
  for (const { id, state, period } of engagedPeriods(open, upcoming)) {
    const next = { state, period };
    const held = byId.get(id);
    if (!held || outranks(next, held)) byId.set(id, next);
  }
  return byId;
}

/** Project id to every state its periods are in, so a project open now can also be upcoming. */
export function engagementStatesByProject(
  open: CommentPeriod[],
  upcoming: CommentPeriod[],
): Map<string, Set<Engagement>> {
  const byId = new Map<string, Set<Engagement>>();
  for (const { id, state } of engagedPeriods(open, upcoming)) {
    const states = byId.get(id) ?? new Set<Engagement>();
    states.add(state);
    byId.set(id, states);
  }
  return byId;
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

/** The status a reader sees: Open, Upcoming or Closed, or blank for a period with no dates. */
export function statusLabel(commentPeriod: CommentPeriod): string {
  return getStatusCode(commentPeriod) === NOT_OPEN ? '' : commentPeriod.commentPeriodStatus;
}
