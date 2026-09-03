import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommentPeriod } from './commentperiod';

// Noon Pacific on a summer (PDT, UTC-7) day, so every expectation below is offset-explicit.
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
});
