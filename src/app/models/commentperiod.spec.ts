import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Settings } from 'luxon';
import {
  CommentPeriod,
  fromNativePeriod,
  hostedOnEngage,
  pacificDay,
  periodDetailsHref,
} from './commentperiod';

// Noon Pacific on a summer (PDT, seven hours behind UTC) day, so every expectation below is
// offset-explicit.
const NOW = new Date('2026-06-15T12:00:00-07:00');

describe('CommentPeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('commentPeriodStatus', () => {
    it('is Open while now sits between the start and end dates', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-06-01T09:00:00-07:00',
        dateCompleted: '2026-06-20T23:59:59-07:00',
      });

      expect(period.commentPeriodStatus).toBe('Open');
      expect(period.daysRemaining).toBe('5 Days Remaining');
    });

    it('is Upcoming before the start date', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-07-01T09:00:00-07:00',
        dateCompleted: '2026-07-20T23:59:59-07:00',
      });

      expect(period.commentPeriodStatus).toBe('Upcoming');
      expect(period.daysRemaining).toBe('Upcoming');
    });

    it('is Closed after the end date', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-05-01T09:00:00-07:00',
        dateCompleted: '2026-06-01T23:59:59-07:00',
      });

      expect(period.commentPeriodStatus).toBe('Closed');
      expect(period.daysRemaining).toBe('Completed');
    });

    it('treats a midnight end date as closing at 11:59 PM Pacific that day', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-06-01T09:00:00-07:00',
        dateCompleted: '2026-06-15T00:00:00-07:00',
      });

      expect(period.commentPeriodStatus).toBe('Open');
      expect(period.daysRemaining).toBe('Final Day');
    });
  });

  describe('bannerState', () => {
    it('reads Open for a period whose midnight end date is today', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-06-01T09:00:00-07:00',
        dateCompleted: '2026-06-15T00:00:00-07:00',
      });

      expect(period.bannerState).toBe('Open');
    });
  });

  /** Only ENGAGE takes comments, so only an open ENGAGE period invites them. */
  describe('bannerCTA', () => {
    const OPEN = {
      dateStarted: '2026-06-01T09:00:00-07:00',
      dateCompleted: '2026-06-20T23:59:59-07:00',
    };
    const CLOSED = {
      dateStarted: '2026-05-01T09:00:00-07:00',
      dateCompleted: '2026-06-01T23:59:59-07:00',
    };
    const ENGAGE = { isMet: true, metURL: 'https://engage.eao.gov.bc.ca/cedar' };

    it('invites comment on an open period ENGAGE runs', () => {
      const period = new CommentPeriod({ ...OPEN, ...ENGAGE });

      expect(hostedOnEngage(period)).toBe(true);
      expect(period.bannerCTA).toBe('Share your thoughts');
    });

    it('only offers a look at an open period hosted here', () => {
      const period = new CommentPeriod(OPEN);

      expect(hostedOnEngage(period)).toBe(false);
      expect(period.bannerCTA).toBe('View engagement');
    });

    it('does not count an ENGAGE link with an unsafe scheme as ENGAGE', () => {
      // Built from parts so no linter rewrites the literal the test is about.
      const period = new CommentPeriod({
        ...OPEN,
        isMet: true,
        metURL: `${'java'}script:alert(1)`,
      });

      expect(hostedOnEngage(period)).toBe(false);
      expect(period.bannerCTA).toBe('View engagement');
    });

    it('does not count a metURL without isMet as ENGAGE', () => {
      const period = new CommentPeriod({ ...OPEN, isMet: false, metURL: ENGAGE.metURL });

      expect(hostedOnEngage(period)).toBe(false);
      expect(period.bannerCTA).toBe('View engagement');
    });

    it('only offers a look at a closed ENGAGE period', () => {
      const period = new CommentPeriod({ ...CLOSED, ...ENGAGE });

      expect(hostedOnEngage(period)).toBe(true);
      expect(period.bannerCTA).toBe('View engagement');
    });
  });

  describe('bannerTimerPillText', () => {
    // A UTC browser, where the day a Date prints on can differ from the Pacific one.
    beforeEach(() => {
      vi.stubEnv('TZ', 'UTC');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('dates an upcoming start by its Pacific day', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-06-20T03:00:00Z',
        dateCompleted: '2026-07-20T12:00:00-07:00',
      });

      expect(period.bannerTimerPillText).toBe('Starts Jun 19, 2026');
    });

    it('dates a close at Pacific midnight by that day, not the next', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-05-01T09:00:00-07:00',
        dateCompleted: '2026-06-10T00:00:00-07:00',
      });

      expect(period.bannerTimerPillText).toBe('Closed Jun 10, 2026');
    });

    it('dates a close late in the Pacific evening by its Pacific day', () => {
      const period = new CommentPeriod({
        dateStarted: '2026-05-01T09:00:00-07:00',
        dateCompleted: '2026-06-10T23:59:00-07:00',
      });

      expect(period.bannerTimerPillText).toBe('Closed Jun 10, 2026');
    });
  });

  describe('endDateDisplay', () => {
    it('shows the date alone when the period ends at midnight', () => {
      const period = new CommentPeriod({ dateCompleted: '2026-06-15T00:00:00-07:00' });

      expect(period.endDateDisplay).toBe('June 15, 2026');
    });

    it('shows the date alone when the period ends at 11:59 PM', () => {
      const period = new CommentPeriod({ dateCompleted: '2026-06-15T23:59:00-07:00' });

      expect(period.endDateDisplay).toBe('June 15, 2026');
    });

    it('shows the Pacific time when the period ends at any other hour', () => {
      const period = new CommentPeriod({ dateCompleted: '2026-06-30T17:00:00-07:00' });

      expect(period.endDateDisplay).toBe('June 30 @ 5:00 PM PDT');
    });
  });

  describe('constructor', () => {
    it('keeps falsy API values instead of coercing them to null', () => {
      const period = new CommentPeriod({
        isPublished: false,
        isMet: false,
        publishedPercent: 0,
        instructions: '',
      });

      expect(period.isPublished).toBe(false);
      expect(period.isMet).toBe(false);
      expect(period.publishedPercent).toBe(0);
      expect(period.instructions).toBe('');
    });
  });

  describe('closedWithin', () => {
    const START = '2025-10-01T09:00:00-07:00';
    // BC left daylight time on Nov 2 2025, so a 14-day window from either close is 337 hours long.
    // Newer tz data keeps BC on -07:00 from Nov 2026, so dates after that would not cross a change.
    const DATE_ONLY_CLOSE = '2025-10-22T00:00:00-07:00';
    const TIMED_CLOSE = '2025-10-22T15:00:00-07:00';

    function periodEnding(dateCompleted: string): CommentPeriod {
      return new CommentPeriod({ dateStarted: START, dateCompleted });
    }

    it('holds a date-only close through the last minute of day 14, across the DST change', () => {
      vi.setSystemTime(new Date('2025-11-05T23:59:00-08:00'));

      expect(periodEnding(DATE_ONLY_CLOSE).closedWithin(14)).toBe(true);
    });

    it('ends a date-only close at the midnight after day 14', () => {
      vi.setSystemTime(new Date('2025-11-06T00:00:00-08:00'));

      expect(periodEnding(DATE_ONLY_CLOSE).closedWithin(14)).toBe(false);
    });

    it('holds a timed close until a minute before the same clock time on day 14', () => {
      vi.setSystemTime(new Date('2025-11-05T14:59:00-08:00'));

      expect(periodEnding(TIMED_CLOSE).closedWithin(14)).toBe(true);
    });

    it('ends a timed close a minute after the same clock time on day 14', () => {
      vi.setSystemTime(new Date('2025-11-05T15:01:00-08:00'));

      expect(periodEnding(TIMED_CLOSE).closedWithin(14)).toBe(false);
    });

    it('counts the first moment after a date-only close', () => {
      vi.setSystemTime(new Date('2025-10-23T00:00:00-07:00'));

      expect(periodEnding(DATE_ONLY_CLOSE).closedWithin(14)).toBe(true);
    });

    it('is false for a period still open', () => {
      vi.setSystemTime(new Date('2025-10-22T12:00:00-07:00'));

      expect(periodEnding(DATE_ONLY_CLOSE).closedWithin(14)).toBe(false);
    });

    it('is false for a period not started yet', () => {
      vi.setSystemTime(new Date('2025-09-20T12:00:00-07:00'));

      expect(periodEnding(DATE_ONLY_CLOSE).closedWithin(14)).toBe(false);
    });

    it('is false when the period has no end date', () => {
      vi.setSystemTime(new Date('2025-10-23T12:00:00-07:00'));

      expect(new CommentPeriod({ dateStarted: START }).closedWithin(14)).toBe(false);
    });

    it('is false when the end date cannot be read', () => {
      vi.setSystemTime(new Date('2025-10-23T12:00:00-07:00'));

      expect(periodEnding('not a date').closedWithin(14)).toBe(false);
    });
  });

  describe('isBannerVisible', () => {
    const closedOct22 = {
      dateStarted: '2026-10-01T09:00:00-07:00',
      dateCompleted: '2026-10-22T00:00:00-07:00',
    };

    it('stays up through day 7 after a date-only close', () => {
      vi.setSystemTime(new Date('2026-10-29T23:59:00-07:00'));

      expect(new CommentPeriod(closedOct22).isBannerVisible).toBe(true);
    });

    it('comes down at the midnight after day 7', () => {
      vi.setSystemTime(new Date('2026-10-30T00:00:00-07:00'));

      expect(new CommentPeriod(closedOct22).isBannerVisible).toBe(false);
    });
  });
});

describe('pacificDay', () => {
  const systemLocale = Settings.defaultLocale;
  afterEach(() => {
    Settings.defaultLocale = systemLocale;
  });

  it('dates in English when the browser runs in another language', () => {
    Settings.defaultLocale = 'fr-CA';

    expect(pacificDay(new Date('2025-04-02T19:00:00.000Z'))).toBe('Apr 2, 2025');
  });

  it('gives an empty string for a date that does not parse', () => {
    expect(pacificDay(new Date('not a date'))).toBe('');
  });
});

describe('fromNativePeriod', () => {
  it('links a period under a project to its page by the Eagle project id', () => {
    const period = fromNativePeriod({ id: 'cp1', projectId: '26', projectEagleId: 'eagle-1' });

    expect(periodDetailsHref(period)).toBe('/p/eagle-1/cp/cp1/details');
  });

  it('links a period under a project notification through /pn/', () => {
    // DEMI joins no project to such a row, and files it under the notification's own id.
    const period = fromNativePeriod({ id: 'cp1', projectId: 'notification-1' });

    expect(periodDetailsHref(period)).toBe('/pn/notification-1/cp/cp1/details');
  });

  it('gives a row that names no parent no page to link to', () => {
    expect(periodDetailsHref(fromNativePeriod({ id: 'cp1' }))).toBeNull();
  });
});
