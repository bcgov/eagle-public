import * as api from './api';
import { CommentPeriod } from 'app/models/commentperiod';
import { startLoading, stopLoading } from 'app/state/loading-state';

// statuses / query param options
export const NOT_STARTED = 'NS';
export const NOT_OPEN = 'NO';
export const CLOSED = 'CL';
export const OPEN = 'OP';

// user-friendly strings for display
const commentPeriodStatuses: Record<string, string> = {
  [NOT_STARTED]: 'Commenting Not Started',
  [NOT_OPEN]: 'Not Open For Commenting',
  [CLOSED]: 'Commenting Closed',
  [OPEN]: 'Commenting Open',
};

// get all comment periods for the specified application id
export async function getAllByProjectId(
  projId: string,
): Promise<{ totalCount: number; data: CommentPeriod[] } | CommentPeriod[] | object> {
  const loadingId = `commentperiods-${projId}`;
  startLoading(loadingId, 'Loading comment periods');
  try {
    const res = await api.getPeriodsByProjId(projId);
    if (!res) {
      return {};
    }
    if (res.length === 0) {
      return [] as CommentPeriod[];
    }
    return { totalCount: res.length, data: res.map((cp: any) => new CommentPeriod(cp)) };
  } finally {
    stopLoading(loadingId);
  }
}

// get a specific comment period by its id
export async function getById(periodId: string): Promise<CommentPeriod> {
  const loadingId = `commentperiod-${periodId}`;
  startLoading(loadingId, 'Loading comment period');
  try {
    const res = await api.getPeriod(periodId);
    // return the first (only) comment period
    const period = res && res.length > 0 ? new CommentPeriod(res[0]) : null;
    return (period ?? null) as unknown as CommentPeriod;
  } finally {
    stopLoading(loadingId);
  }
}

// returns first period - multiple comment periods are currently not supported
export function getCurrent(periods: CommentPeriod[]): CommentPeriod | null {
  return periods.length > 0 ? periods[0] : null;
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

/** Given a status code, returns user-friendly status string. */
export function getStatusString(statusCode: string): string | null {
  return commentPeriodStatuses[statusCode] ?? null;
}

export function isNotOpen(commentPeriod: CommentPeriod): boolean {
  return getStatusCode(commentPeriod) === NOT_OPEN;
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
