import { afterEach, describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { renderAt } from '../../../../test-utils';
import { CommentPeriodRow } from './comment-periods';

type Row = Record<string, unknown>;

const PERIOD: Row = {
  _id: 'cp-1',
  project: 'eagle-1',
  isMet: false,
  projectName: 'Kitimat Terminal',
  informationLabel: '',
  dateStarted: '2025-03-03T19:00:00.000Z',
  dateCompleted: '2025-04-02T19:00:00.000Z',
};

function renderRows(rows: Row[]) {
  return renderAt('/', [
    {
      path: '/',
      element: (
        <ul>
          {rows.map((row) => (
            <li key={String(row['_id'])}>
              <CommentPeriodRow row={row} />
            </li>
          ))}
        </ul>
      ),
    },
  ]);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('CommentPeriodRow', () => {
  it('reads a period closing at midnight today as open until the end of the day', () => {
    // Eagle stores a date-only closing day as midnight Pacific; the period stays open all that day.
    const midnight = DateTime.now().setZone('America/Vancouver').startOf('day');
    renderRows([
      {
        ...PERIOD,
        dateStarted: midnight.minus({ days: 20 }).toISO(),
        dateCompleted: midnight.toISO(),
      },
    ]);

    expect(screen.getByRole('listitem')).toHaveTextContent(/^Open/);
  });

  it('says whether each period is open, upcoming or closed, from its dates', () => {
    const now = DateTime.now();
    renderRows([
      {
        ...PERIOD,
        _id: 'open',
        dateStarted: now.minus({ days: 20 }).toISO(),
        dateCompleted: now.plus({ days: 10 }).toISO(),
      },
      {
        ...PERIOD,
        _id: 'upcoming',
        dateStarted: now.plus({ days: 7 }).toISO(),
        dateCompleted: now.plus({ days: 37 }).toISO(),
      },
      PERIOD,
    ]);

    const [open, upcoming, closed] = screen.getAllByRole('listitem');
    expect(open).toHaveTextContent(/^Open/);
    expect(upcoming).toHaveTextContent(/^Upcoming/);
    expect(closed).toHaveTextContent(/^Closed/);
  });

  it('dates the period as BC does, whatever zone the browser is in', () => {
    vi.stubEnv('TZ', 'UTC');
    // 03:00 UTC is the previous evening in Vancouver.
    renderRows([
      {
        ...PERIOD,
        dateStarted: '2025-03-03T03:00:00.000Z',
        dateCompleted: '2025-04-02T03:00:00.000Z',
      },
    ]);

    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Kitimat Terminal: Mar 2, 2025 – Apr 1, 2025',
    );
  });

  it('names only the opening day when the period has no closing date', () => {
    renderRows([{ ...PERIOD, dateCompleted: null }]);

    expect(screen.getByRole('link')).toHaveAccessibleName('Kitimat Terminal: Opens Mar 3, 2025');
  });

  it('leaves out the meta line when the period has no status to show', () => {
    renderRows([{ ...PERIOD, dateCompleted: null }]);

    expect(screen.getByRole('listitem').querySelector('.display-grid__row-meta')).toBeNull();
  });

  it('shows no status and no date span for a period with no dates', () => {
    renderRows([{ ...PERIOD, dateStarted: null, dateCompleted: null }]);

    const item = screen.getByRole('listitem');
    expect(screen.getByRole('link')).toHaveAccessibleName('Kitimat Terminal');
    expect(item).not.toHaveTextContent(/Open|Upcoming|Closed/);
    expect(item).not.toHaveTextContent('–');
  });

  it('gives two periods of one project different link names', () => {
    renderRows([
      PERIOD,
      {
        ...PERIOD,
        _id: 'cp-2',
        dateStarted: '2025-09-01T19:00:00.000Z',
        dateCompleted: '2025-10-01T19:00:00.000Z',
      },
    ]);

    const [first, second] = screen.getAllByRole('link');
    expect(first.textContent).not.toBe(second.textContent);
  });

  it("shows the period's own label where it differs from the project name", () => {
    renderRows([{ ...PERIOD, informationLabel: 'Application review' }]);

    expect(screen.getByText('Application review')).toBeInTheDocument();
  });

  it('does not repeat a label that is the project name', () => {
    renderRows([{ ...PERIOD, informationLabel: 'Kitimat Terminal' }]);

    expect(screen.getAllByText(/Kitimat Terminal/)).toHaveLength(1);
  });

  it('links an ENGAGE-hosted period to ENGAGE in a new tab, as the home rail does', () => {
    renderRows([{ ...PERIOD, isMet: true, metURL: 'https://engage.example/cedar-lng' }]);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://engage.example/cedar-lng');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName(/^Kitimat Terminal.*\(opens in new tab\)$/);
  });

  it('does not repeat a padded label that the row already uses as its name', () => {
    renderRows([{ ...PERIOD, projectName: '', informationLabel: ' Application review ' }]);

    expect(screen.getAllByText(/Application review/)).toHaveLength(1);
  });

  it('falls back to the details page, in the same tab, when the ENGAGE URL is unsafe', () => {
    renderRows([{ ...PERIOD, isMet: true, metURL: 'javascript:alert(1)' }]);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/p/eagle-1/cp/cp-1/details');
    expect(link).not.toHaveAttribute('target');
  });

  it('shows the name as plain text when the row names no project', () => {
    renderRows([{ ...PERIOD, project: null }]);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/^Kitimat Terminal:/)).toBeInTheDocument();
  });
});
