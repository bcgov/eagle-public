import * as api from './api';
import { notificationQueryOptions } from './notification';
import { queryClient } from './query-client';
import { logger } from 'app/config/logging';
import {
  CommentPeriod,
  fromNativePeriod,
  projectIdOf,
  type NativePeriod,
} from 'app/models/commentperiod';

// statuses / query param options
const NOT_STARTED = 'NS';
const NOT_OPEN = 'NO';
const CLOSED = 'CL';
const OPEN = 'OP';

/** DEMI 400s above 100 rows for an anonymous request, and public visitors are anonymous. */
const ANONYMOUS_PAGE_SIZE_CAP = 100;

/**
 * The id DEMI files a parent's periods under. Pages hold the Eagle project id, and DEMI the Track
 * one; an id DEMI has no project for is a notification's, which DEMI files its periods under as is.
 */
async function periodParentId(projId: string): Promise<string> {
  // The notification page reads its record first, so a known notification skips a lookup that 404s.
  if (queryClient.getQueryState(notificationQueryOptions(projId).queryKey)) return projId;
  const id = (await api.getDemiProject(projId))?.['id'];
  return typeof id === 'string' || typeof id === 'number' ? String(id) : projId;
}

/**
 * Every comment period of one project or notification, newest first. A project has single-digit
 * comment periods, hence the one page.
 */
async function periodsByParent(projId: string): Promise<CommentPeriod[]> {
  const { rows } = await api.listNative<NativePeriod>('comment-periods', {
    filters: { project: await periodParentId(projId) },
    sort: '-dateStarted',
    pageSize: ANONYMOUS_PAGE_SIZE_CAP,
  });
  // The cards derive their description from `instructions` and show `additionalText` in its place,
  // so the list leaves it out, as the old route's projection did.
  return rows.map(({ additionalText: _blurb, ...row }) => fromNativePeriod(row as NativePeriod));
}

// get all comment periods for the specified application id
export async function getAllByProjectId(
  projId: string,
): Promise<{ totalCount: number; data: CommentPeriod[] } | CommentPeriod[] | object> {
  const periods = await periodsByParent(projId);
  return periods.length === 0 ? [] : { totalCount: periods.length, data: periods };
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
  /** Periods closed in the last 30 days. Null when that read failed. */
  closedCount: number | null;
}

/** A project's comment-period state on the projects map. */
export type Engagement = 'open' | 'upcoming';

/** Mid-sentence wording of each state; capitalize the first letter to lead with it. */
export const ENGAGEMENT_LABEL: Record<Engagement, string> = {
  open: 'open for public comment',
  upcoming: 'public comment period coming soon',
};

type PeriodStatus = Engagement | 'closed';

/** If the cap is hit, the page keeps the periods that close or start soonest, or closed last. */
const STATUS_SORT: Record<PeriodStatus, string> = {
  open: 'dateCompleted',
  upcoming: 'dateStarted',
  closed: '-dateCompleted',
};

/** One page of every project's comment periods in the given state, compared with the clock by DEMI. */
async function periodsByStatus(status: PeriodStatus): Promise<CommentPeriod[]> {
  const { rows } = await api.listNative<NativePeriod>('comment-periods', {
    filters: { status },
    sort: STATUS_SORT[status],
    pageSize: ANONYMOUS_PAGE_SIZE_CAP,
  });
  if (rows.length >= ANONYMOUS_PAGE_SIZE_CAP) {
    logger.warn(
      `${status} comment periods filled one page of ${ANONYMOUS_PAGE_SIZE_CAP}; the rest are not shown`,
      'commentperiod',
    );
  }
  return rows.map(fromNativePeriod);
}

const CLOSED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Periods closed in the last 30 days, or null when the read fails: the rail still has its answer. */
async function closedLastMonth(): Promise<number | null> {
  try {
    const since = Date.now() - CLOSED_WINDOW_MS;
    const closed = await periodsByStatus('closed');
    return closed.filter((period) => period.dateCompleted?.getTime() >= since).length;
  } catch (error) {
    logger.warn('Closed comment period read failed, leaving the count out', 'commentperiod', error);
    return null;
  }
}

/** Every comment period open now, across all projects, soonest to close first. */
export function openCommentPeriodsQueryOptions() {
  return {
    queryKey: ['openCommentPeriods'],
    // The rail shows its own error in place; retrying only holds the skeleton up.
    retry: false,
    queryFn: async (): Promise<OpenPeriods> => {
      // Both reads every time: one that waited on the open answer would add a round trip and make
      // the request set depend on the data.
      const [open, closedCount] = await Promise.all([periodsByStatus('open'), closedLastMonth()]);
      // Drops rows whose dates disagree with the server's status at fetch time.
      return { periods: open.filter(isOpen), closedCount };
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
      (await periodsByStatus('upcoming')).filter(isNotStarted),
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

/** One comment period by DEMI or Eagle id; null when there is none the visitor may read. */
export async function getById(periodId: string): Promise<CommentPeriod | null> {
  try {
    return fromNativePeriod(await api.getNative<NativePeriod>('comment-periods', periodId));
  } catch (error) {
    if (error instanceof api.ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
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
