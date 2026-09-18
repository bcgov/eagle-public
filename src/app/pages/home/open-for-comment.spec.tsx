import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { makeQueryClient, renderAt } from '../../../test-utils';
import { longDate } from 'app/utils/utils';
import { envelope, json, PENDING, stubFetch } from './home-fetch.spec-helper';
import { OpenForComment } from './open-for-comment';

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const ENGAGE_PERIOD = {
  _id: 'cp-1',
  project: 'eagle-1',
  isMet: true,
  metURL: 'https://engage.eao.gov.bc.ca/cedar-lng',
  projectName: 'Cedar LNG',
  informationLabel: 'Cedar LNG - Early Engagement',
  dateStarted: at(-5),
  dateCompleted: at(10.5),
};

const LEGACY_PERIOD = {
  _id: 'cp-2',
  project: 'eagle-2',
  isMet: false,
  projectName: 'Kitimat Terminal',
  informationLabel: 'Kitimat Terminal comment period',
  dateStarted: at(-20),
  dateCompleted: at(3.5),
};

// The dates say closed, whatever the answer claimed.
const CLOSED_PERIOD = { ...LEGACY_PERIOD, _id: 'cp-3', dateCompleted: at(-1) };

function renderRail(
  periods: Response | typeof PENDING = envelope([ENGAGE_PERIOD, LEGACY_PERIOD, CLOSED_PERIOD], {
    closedCount: 4,
  }),
  { retries = false }: { retries?: boolean } = {},
) {
  const requests = stubFetch((url) => {
    if (url.includes('dataset=CommentPeriod')) return periods;
    // A project read would answer a name the rows do not carry, so any use of it shows.
    if (url.startsWith('/demi-projects/')) return json({ name: 'Name from a project read' });
    return undefined;
  });
  renderAt(
    '/',
    [{ path: '/', Component: OpenForComment }],
    retries ? { queryClient: makeQueryClient({ retry: 3 }) } : {},
  );
  return requests;
}

const section = () => screen.getByRole('heading', { name: 'Open for comment' }).closest('section')!;

describe('home open for comment', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the periods open now across every project', async () => {
    const requests = renderRail();

    await screen.findByRole('link', { name: /Cedar LNG/ });
    const read = requests.find((url) => url.includes('dataset=CommentPeriod'))!;
    expect(read).toContain('and[status]=open');
    expect(read).not.toContain('and[project]');
  });

  it('draws each open period with days left, project and dates, and sends ENGAGE ones out', async () => {
    renderRail();

    const link = await screen.findByRole('link', { name: 'Cedar LNG (opens in new tab)' });
    expect(link).toHaveAttribute('href', 'https://engage.eao.gov.bc.ca/cedar-lng');
    expect(link).toHaveAttribute('target', '_blank');
    const card = link.closest('li')!;
    expect(within(card).getByText('10 Days Remaining')).toBeInTheDocument();
    expect(card).toHaveTextContent(
      `${longDate(ENGAGE_PERIOD.dateStarted)} – ${longDate(ENGAGE_PERIOD.dateCompleted)}`,
    );
  });

  it('keeps a period Eagle hosts on its own details page', async () => {
    renderRail();

    expect(await screen.findByRole('link', { name: 'Kitimat Terminal' })).toHaveAttribute(
      'href',
      '/p/eagle-2/cp/cp-2/details',
    );
  });

  it('names each card from its row, without reading the project', async () => {
    const requests = renderRail();

    await screen.findByRole('link', { name: 'Kitimat Terminal' });
    expect(requests.filter((url) => url.startsWith('/demi-projects/'))).toEqual([]);
  });

  it('falls back to the period label, then a plain title, when the row has no project name', async () => {
    const { projectName: _hidden, ...unnamed } = LEGACY_PERIOD;
    const { informationLabel: _none, ...bare } = { ...unnamed, _id: 'cp-4', project: 'eagle-4' };
    renderRail(envelope([unnamed, bare]));

    expect(
      await screen.findByRole('link', { name: 'Kitimat Terminal comment period' }),
    ).toHaveAttribute('href', '/p/eagle-2/cp/cp-2/details');
    expect(screen.getByRole('link', { name: 'Comment period' })).toHaveAttribute(
      'href',
      '/p/eagle-4/cp/cp-4/details',
    );
  });

  it('leaves out a period whose dates have passed', async () => {
    renderRail();

    await screen.findByRole('link', { name: 'Kitimat Terminal' });
    expect(within(section()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('points at upcoming and recently closed periods', () => {
    renderRail();

    expect(
      screen.getByRole('link', { name: 'Upcoming and recently closed periods' }),
    ).toHaveAttribute('href', '/search?record=notifications&pcp=pending');
  });

  it('holds a busy skeleton while the periods load', () => {
    renderRail(PENDING);

    expect(within(section()).getByText('Loading').closest('ul')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('collapses to one line with the real closed count when none are open', async () => {
    renderRail(envelope([], { closedCount: 4 }));

    expect(
      await screen.findByText(
        'No comment periods are open right now. 4 closed in the last 30 days.',
      ),
    ).toBeInTheDocument();
  });

  it('drops the closed sentence when the count is missing', async () => {
    renderRail(envelope([]));

    const line = await screen.findByText(/^No comment periods are open right now\./);
    expect(line).toHaveTextContent(/^No comment periods are open right now\.$/);
  });

  it('says the periods are unavailable, in place, after one request', async () => {
    const requests = renderRail(json(null, 500), { retries: true });

    expect(
      await screen.findByText('Comment periods are unavailable right now.'),
    ).toBeInTheDocument();
    expect(requests.filter((url) => url.includes('dataset=CommentPeriod'))).toHaveLength(1);
  });
});
