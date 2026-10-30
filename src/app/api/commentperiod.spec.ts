import { describe, it, expect, afterEach, vi } from 'vitest';
import { json, native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { queryClient } from './query-client';
import { logger } from 'app/config/logging';
import { CommentPeriod } from 'app/models/commentperiod';
import {
  commentPeriodsQueryOptions,
  engagementPeriodsByProject,
  getById,
  nextEngagement,
  engagementStatesByProject,
  closedLastMonthQueryOptions,
  openCommentPeriodsQueryOptions,
  upcomingCommentPeriodsQueryOptions,
} from './commentperiod';

// Dates far enough either side of today that the live clock never moves a row between states.
const OPEN_DATES = { dateStarted: '2020-01-01T12:00:00Z', dateCompleted: '2099-06-01T12:00:00Z' };
const UPCOMING_DATES = {
  dateStarted: '2098-01-01T12:00:00Z',
  dateCompleted: '2098-03-01T12:00:00Z',
};
const CLOSED_DATES = { dateStarted: '2020-01-01T12:00:00Z', dateCompleted: '2020-02-01T12:00:00Z' };

function period(row: Record<string, unknown>): CommentPeriod {
  return new CommentPeriod({ project: 'p1', ...row });
}

describe('nextEngagement', () => {
  it('picks the open period over an upcoming one', () => {
    const upcoming = period({ _id: 'cp-up', ...UPCOMING_DATES });
    const open = period({ _id: 'cp-open', ...OPEN_DATES });

    const next = nextEngagement([upcoming, open]);

    expect(next?.state).toBe('open');
    expect(next?.period._id).toBe('cp-open');
  });

  it('picks the upcoming period that starts soonest', () => {
    const later = period({
      _id: 'cp-later',
      dateStarted: '2098-06-01T12:00:00Z',
      dateCompleted: '2098-07-01T12:00:00Z',
    });
    const sooner = period({ _id: 'cp-sooner', ...UPCOMING_DATES });

    const next = nextEngagement([later, sooner]);

    expect(next?.state).toBe('upcoming');
    expect(next?.period._id).toBe('cp-sooner');
  });

  it('is null when every period has closed', () => {
    expect(nextEngagement([period({ _id: 'cp-closed', ...CLOSED_DATES })])).toBeNull();
  });
});

describe('engagementStatesByProject', () => {
  it('keeps every state a project has, not only the one that outranks', () => {
    const open = period({ _id: 'cp-open', ...OPEN_DATES });
    const upcoming = period({ _id: 'cp-next', ...UPCOMING_DATES });
    const closed = period({ _id: 'cp-done', project: 'p2', ...CLOSED_DATES });

    const states = engagementStatesByProject([open, closed], [upcoming]);

    expect([...(states.get('p1') ?? [])].sort()).toEqual(['open', 'upcoming']);
    expect(states.has('p2')).toBe(false);
  });
});

describe('engagementPeriodsByProject', () => {
  it('picks the open period over an upcoming one for the same project', () => {
    const open = period({ _id: 'cp-open', ...OPEN_DATES });
    const upcoming = period({ _id: 'cp-next', ...UPCOMING_DATES });

    const entry = engagementPeriodsByProject([open], [upcoming]).get('p1');

    expect(entry?.state).toBe('open');
    expect(entry?.period._id).toBe('cp-open');
  });

  it('reads the state from the dates, not from the list the period came in', () => {
    // Fetched as upcoming, open by now: it must outrank the period fetched as upcoming.
    const nowOpen = period({ _id: 'cp-now-open', ...OPEN_DATES });
    const stillUpcoming = period({ _id: 'cp-next', ...UPCOMING_DATES });

    const entry = engagementPeriodsByProject([], [stillUpcoming, nowOpen]).get('p1');

    expect(entry?.state).toBe('open');
    expect(entry?.period._id).toBe('cp-now-open');
  });

  it('leaves out a project whose only period has closed since it was fetched', () => {
    const closed = period({ _id: 'cp-closed', ...CLOSED_DATES });

    expect(engagementPeriodsByProject([closed], []).has('p1')).toBe(false);
  });

  it('keeps the open period that closes first', () => {
    const later = period({
      _id: 'cp-later',
      dateStarted: '2020-01-01T12:00:00Z',
      dateCompleted: '2099-09-01T12:00:00Z',
    });
    const sooner = period({
      _id: 'cp-sooner',
      dateStarted: '2021-01-01T12:00:00Z',
      dateCompleted: '2099-03-01T12:00:00Z',
    });

    expect(engagementPeriodsByProject([later, sooner], []).get('p1')?.period._id).toBe('cp-sooner');
  });

  it('keeps the upcoming period that starts first', () => {
    const later = period({
      _id: 'cp-later',
      dateStarted: '2098-05-01T12:00:00Z',
      dateCompleted: '2098-06-01T12:00:00Z',
    });
    const sooner = period({
      _id: 'cp-sooner',
      dateStarted: '2098-02-01T12:00:00Z',
      dateCompleted: '2098-09-01T12:00:00Z',
    });

    expect(engagementPeriodsByProject([], [later, sooner]).get('p1')?.period._id).toBe('cp-sooner');
  });

  it('breaks a date tie on the lower period id, whatever the order', () => {
    const b = period({ _id: 'cp-b', ...OPEN_DATES });
    const a = period({ _id: 'cp-a', ...OPEN_DATES });

    expect(engagementPeriodsByProject([b, a], []).get('p1')?.period._id).toBe('cp-a');
    expect(engagementPeriodsByProject([a, b], []).get('p1')?.period._id).toBe('cp-a');
  });

  it('keys a period by the id inside a populated project', () => {
    const populated = period({
      _id: 'cp1',
      project: { _id: 'p7', name: 'Cedar Quarry' },
      ...OPEN_DATES,
    });

    expect(engagementPeriodsByProject([populated], []).get('p7')?.period._id).toBe('cp1');
  });

  it('skips a period that names no project', () => {
    const orphan = period({ _id: 'cp1', project: null, ...OPEN_DATES });

    expect(engagementPeriodsByProject([orphan], []).size).toBe(0);
  });

  it('keeps each project to its own period', () => {
    const first = period({ _id: 'cp1', project: 'p1', ...OPEN_DATES });
    const second = period({ _id: 'cp2', project: 'p2', ...UPCOMING_DATES });

    const byId = engagementPeriodsByProject([first], [second]);

    expect(byId.get('p1')?.period._id).toBe('cp1');
    expect(byId.get('p2')?.state).toBe('upcoming');
  });
});

/** A DEMI native row of a period whose project the visitor may read. */
function nativeRow(id: string, dates: Record<string, string> = {}): Record<string, unknown> {
  return { id, projectId: '26', projectEagleId: `eagle-${id}`, ...dates };
}

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

describe('upcomingCommentPeriodsQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks DEMI for one page of 100 upcoming periods, soonest to start first', async () => {
    const requests = stubFetch(() => native([]));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(requests).toEqual([
      '/demi/api/comment-periods?pageSize=100&sort=dateStarted&status=upcoming',
    ]);
  });

  it('drops rows whose dates say they are not upcoming', async () => {
    stubFetch(() =>
      native([
        nativeRow('cp-upcoming', UPCOMING_DATES),
        nativeRow('cp-open', OPEN_DATES),
        nativeRow('cp-closed', CLOSED_DATES),
        nativeRow('cp-undated'),
      ]),
    );

    const periods = await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(periods.map((row) => row._id)).toEqual(['cp-upcoming']);
  });

  it('keys each period on the Eagle project id the map and links use', async () => {
    stubFetch(() => native([nativeRow('cp1', UPCOMING_DATES)]));

    const [period] = await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(period.project).toBe('eagle-cp1');
  });

  it('warns when the answer fills the page, since rows past it are lost', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const rows = Array.from({ length: 100 }, (_, index) => nativeRow(`cp${index}`, UPCOMING_DATES));
    stubFetch(() => native(rows));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(warn).toHaveBeenCalledWith(
      'upcoming comment periods filled one page of 100; the rest are not shown',
      'commentperiod',
    );
  });

  it('stays quiet one row under the page size', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const rows = Array.from({ length: 99 }, (_, index) => nativeRow(`cp${index}`, UPCOMING_DATES));
    stubFetch(() => native(rows));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('openCommentPeriodsQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks only for the open periods, soonest to close first', async () => {
    const requests = stubFetch(() => native([]));

    await openCommentPeriodsQueryOptions().queryFn();

    expect(requests).toEqual([
      '/demi/api/comment-periods?pageSize=100&sort=dateCompleted&status=open',
    ]);
  });
});

describe('closedLastMonthQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for the last closed periods', async () => {
    const requests = stubFetch(() => native([]));

    await closedLastMonthQueryOptions().queryFn();

    expect(requests).toEqual([
      '/demi/api/comment-periods?pageSize=100&sort=-dateCompleted&status=closed',
    ]);
  });

  it('counts the periods closed in the last 30 days', async () => {
    stubFetch((url) =>
      url.includes('status=closed')
        ? native([
            nativeRow('cp-recent', { dateStarted: daysAgo(40), dateCompleted: daysAgo(5) }),
            nativeRow('cp-old', { dateStarted: daysAgo(90), dateCompleted: daysAgo(60) }),
          ])
        : native([]),
    );

    expect(await closedLastMonthQueryOptions().queryFn()).toBe(1);
  });

  it('leaves the closed count out when its read fails', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    stubFetch(() => json(null, 500));

    expect(await closedLastMonthQueryOptions().queryFn()).toBeNull();
  });
});

describe('the closed count', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stays quiet when the closed periods fill the page, since the count needs only the newest', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const closed = Array.from({ length: 100 }, (_, index) => nativeRow(`cp${index}`, CLOSED_DATES));
    stubFetch(() => native(closed));

    await closedLastMonthQueryOptions().queryFn();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('commentPeriodsQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it("asks for a project's periods under its DEMI id, newest first", async () => {
    const requests = stubFetch((url) =>
      url.startsWith('/demi-projects/') ? json({ id: '26', eagleId: 'eagle-1' }) : undefined,
    );

    await commentPeriodsQueryOptions('eagle-1').queryFn();

    expect(requests).toContain(
      '/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=26',
    );
  });

  it("asks for a notification's periods under the notification's own id", async () => {
    const requests = stubFetch((url) =>
      url.startsWith('/demi-projects/') ? json(null, 404) : undefined,
    );

    await commentPeriodsQueryOptions('notification-1').queryFn();

    expect(requests).toContain(
      '/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=notification-1',
    );
  });

  it('asks no project lookup for an id the page already reads as a notification', async () => {
    queryClient.setQueryData(['notification', 'notification-1'], { _id: 'notification-1' });
    const requests = stubFetch(() => undefined);

    await commentPeriodsQueryOptions('notification-1').queryFn();

    expect(requests).toEqual([
      '/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=notification-1',
    ]);
  });

  it('leaves out the blurb the cards would show in place of the instructions', async () => {
    stubFetch((url) =>
      url.startsWith('/demi/api/')
        ? native([{ ...nativeRow('cp1', OPEN_DATES), additionalText: 'Staff blurb' }])
        : json({ id: '26' }),
    );

    const [period] = await commentPeriodsQueryOptions('eagle-1').queryFn();

    expect(period._id).toBe('cp1');
    expect(period.additionalText).toBeUndefined();
  });
});

describe('getById', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the period by the id in the route', async () => {
    const requests = stubFetch(() => json(nativeRow('cp1', OPEN_DATES)));

    const period = await getById('cp1');

    expect(requests).toEqual(['/demi/api/comment-periods/cp1']);
    expect(period?.project).toBe('eagle-cp1');
  });

  it('answers null for a period DEMI does not have', async () => {
    stubFetch(() => json(null, 404));

    expect(await getById('missing')).toBeNull();
  });
});
