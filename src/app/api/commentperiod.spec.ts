import { describe, it, expect, afterEach, vi } from 'vitest';
import { envelope, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { logger } from 'app/config/logging';
import { CommentPeriod } from 'app/models/commentperiod';
import {
  engagementPeriodsByProject,
  engagementStatesByProject,
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

describe('upcomingCommentPeriodsQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for one page of 100 upcoming comment periods', async () => {
    const requests = stubFetch(() => envelope([]));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('dataset=CommentPeriod');
    expect(requests[0]).toContain('and[status]=upcoming');
    expect(requests[0]).toContain('pageSize=100');
  });

  it('asks for the soonest to start first, so a full page drops the latest ones', async () => {
    const requests = stubFetch(() => envelope([]));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(requests[0]).toContain('&sortBy=+dateStarted&');
  });

  it('drops rows whose dates say they are not upcoming', async () => {
    stubFetch(() =>
      envelope([
        { _id: 'cp-upcoming', project: 'p1', ...UPCOMING_DATES },
        { _id: 'cp-open', project: 'p2', ...OPEN_DATES },
        { _id: 'cp-closed', project: 'p3', ...CLOSED_DATES },
        { _id: 'cp-undated', project: 'p4' },
      ]),
    );

    const periods = await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(periods.map((row) => row._id)).toEqual(['cp-upcoming']);
  });

  it('warns when the answer fills the page, since rows past it are lost', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const rows = Array.from({ length: 100 }, (_, index) => ({
      _id: `cp${index}`,
      project: `p${index}`,
      ...UPCOMING_DATES,
    }));
    stubFetch(() => envelope(rows));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(warn).toHaveBeenCalledWith(
      'upcoming comment periods filled one page of 100; the rest are not shown',
      'commentperiod',
    );
  });

  it('stays quiet one row under the page size', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const rows = Array.from({ length: 99 }, (_, index) => ({
      _id: `cp${index}`,
      project: `p${index}`,
      ...UPCOMING_DATES,
    }));
    stubFetch(() => envelope(rows));

    await upcomingCommentPeriodsQueryOptions().queryFn();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('openCommentPeriodsQueryOptions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the soonest to close first, so a full page drops the latest ones', async () => {
    const requests = stubFetch(() => envelope([]));

    await openCommentPeriodsQueryOptions().queryFn();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('and[status]=open');
    expect(requests[0]).toContain('&sortBy=+dateCompleted&');
  });
});
