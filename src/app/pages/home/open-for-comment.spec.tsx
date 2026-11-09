import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { makeQueryClient, renderAt } from '../../../test-utils';
import { pacificLongDay } from 'app/models/commentperiod';
import { json, native, PENDING, stubFetch } from './home-fetch.spec-helper';
import { OpenForComment } from './open-for-comment';

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

// DEMI native rows: the Eagle project id rides in `projectEagleId`, beside DEMI's own `projectId`.
const ENGAGE_PERIOD = {
  id: 'cp-1',
  projectId: '26',
  projectEagleId: 'eagle-1',
  isMet: true,
  metURL: 'https://engage.eao.gov.bc.ca/cedar-lng',
  projectName: 'Cedar LNG',
  informationLabel: 'Cedar LNG - Early Engagement',
  dateStarted: at(-5),
  dateCompleted: at(10.5),
};

const LEGACY_PERIOD = {
  id: 'cp-2',
  projectId: '27',
  projectEagleId: 'eagle-2',
  isMet: false,
  projectName: 'Kitimat Terminal',
  informationLabel: 'Kitimat Terminal comment period',
  dateStarted: at(-20),
  dateCompleted: at(3.5),
};

// The dates say closed, whatever the answer claimed.
const CLOSED_PERIOD = { ...LEGACY_PERIOD, id: 'cp-3', dateCompleted: at(-1) };

function closedRow(id: string, projectName: string, closedDaysAgo: number) {
  return {
    ...LEGACY_PERIOD,
    id,
    projectEagleId: `eagle-${id}`,
    projectName,
    dateStarted: at(-closedDaysAgo - 30),
    dateCompleted: at(-closedDaysAgo),
  };
}

const OPEN_READ = '/demi/api/comment-periods?pageSize=100&sort=dateCompleted&status=open';
const CLOSED_READ = '/demi/api/comment-periods?pageSize=100&sort=-dateCompleted&status=closed';

function renderRail(
  periods: Response | typeof PENDING = native([ENGAGE_PERIOD, LEGACY_PERIOD, CLOSED_PERIOD]),
  {
    retries = false,
    closed = native([]),
    queryClient = makeQueryClient(retries ? { retry: 3 } : undefined),
  }: {
    retries?: boolean;
    closed?: Response | typeof PENDING;
    queryClient?: QueryClient;
  } = {},
) {
  const requests = stubFetch((url) => {
    if (url === OPEN_READ) return periods;
    if (url === CLOSED_READ) return closed;
    // A project read would answer a name the rows do not carry, so any use of it shows.
    if (url.startsWith('/demi-projects/')) return json({ name: 'Name from a project read' });
    return undefined;
  });
  renderAt('/', [{ path: '/', Component: OpenForComment }], { queryClient });
  return requests;
}

const section = () => screen.getByRole('heading', { name: 'Open for comment' }).closest('section')!;

describe('home open for comment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the open and the closed periods across every project, once each', async () => {
    const requests = renderRail();

    // The file's first render pays jsdom and React warm-up; no lazy import or timer to wait on.
    await screen.findByRole('link', { name: /Cedar LNG/ }, { timeout: 4000 });
    expect([...requests].sort()).toEqual([CLOSED_READ, OPEN_READ]);
  });

  it('draws each open period with days left, project and dates, and sends ENGAGE ones out', async () => {
    renderRail();

    const link = await screen.findByRole('link', { name: 'Cedar LNG (opens in new tab)' });
    expect(link).toHaveAttribute('href', 'https://engage.eao.gov.bc.ca/cedar-lng');
    expect(link).toHaveAttribute('target', '_blank');
    const card = link.closest('li')!;
    expect(within(card).getByText('10 Days Remaining')).toBeInTheDocument();
    expect(card).toHaveTextContent(
      `${pacificLongDay(new Date(ENGAGE_PERIOD.dateStarted))} – ${pacificLongDay(
        new Date(ENGAGE_PERIOD.dateCompleted),
      )}`,
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
    const { informationLabel: _none, ...bare } = {
      ...unnamed,
      id: 'cp-4',
      projectEagleId: 'eagle-4',
    };
    renderRail(native([unnamed, bare]));

    expect(
      await screen.findByRole('link', { name: 'Kitimat Terminal comment period' }),
    ).toHaveAttribute('href', '/p/eagle-2/cp/cp-2/details');
    expect(screen.getByRole('link', { name: 'Comment period' })).toHaveAttribute(
      'href',
      '/p/eagle-4/cp/cp-4/details',
    );
  });

  it('reads the name off the period label when the project name is blank', async () => {
    renderRail(native([{ ...LEGACY_PERIOD, projectName: '' }]));

    expect(
      await screen.findByRole('link', { name: 'Kitimat Terminal comment period' }),
    ).toHaveAttribute('href', '/p/eagle-2/cp/cp-2/details');
  });

  it('dates the card as BC does, whatever zone the browser is in', async () => {
    vi.stubEnv('TZ', 'UTC');
    // 03:00 UTC is the previous evening in Vancouver.
    renderRail(
      native([
        {
          ...LEGACY_PERIOD,
          dateStarted: '2025-03-03T03:00:00.000Z',
          dateCompleted: '2099-04-02T03:00:00.000Z',
        },
      ]),
    );

    const card = (await screen.findByRole('link', { name: 'Kitimat Terminal' })).closest('li')!;
    expect(card).toHaveTextContent('March 2, 2025 – April 1, 2099');
  });

  it('leaves out a period whose dates have passed', async () => {
    renderRail();

    await screen.findByRole('link', { name: 'Kitimat Terminal' });
    expect(within(section()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('points at upcoming and recently closed periods on the comment periods tab', () => {
    renderRail();

    expect(
      screen.getByRole('link', { name: 'Upcoming and recently closed periods' }),
    ).toHaveAttribute('href', '/search?record=commentPeriods');
  });

  it('holds a busy skeleton while the periods load', () => {
    renderRail(PENDING);

    expect(within(section()).getByText('Loading').closest('ul')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('collapses to one line with the real closed count when none are open', async () => {
    // Two inside the last 30 days, one before them; all past the 14 days a row stays listed.
    const closed = native([
      closedRow('cp-5', 'Red Mountain', 20),
      closedRow('cp-6', 'Blue River', 29),
      closedRow('cp-7', 'Green Lake', 31),
    ]);
    renderRail(native([]), { closed });

    expect(
      await screen.findByText(
        'No comment periods are open right now. 2 closed in the last 30 days.',
      ),
    ).toBeInTheDocument();
  });

  it('drops the closed sentence when the closed periods cannot be read', async () => {
    renderRail(native([]), { closed: json(null, 500) });

    const line = await screen.findByText(/^No comment periods are open right now\./);
    expect(line).toHaveTextContent(/^No comment periods are open right now\.$/);
  });

  it('says the periods are unavailable, in place, after one request', async () => {
    const requests = renderRail(json(null, 500), { retries: true });

    expect(
      await screen.findByText('Comment periods are unavailable right now.'),
    ).toBeInTheDocument();
    expect(requests.filter((url) => url === OPEN_READ)).toHaveLength(1);
  });

  it('says the periods are unavailable without waiting for the closed read', async () => {
    renderRail(json(null, 500), { closed: PENDING });

    expect(
      await screen.findByText('Comment periods are unavailable right now.'),
    ).toBeInTheDocument();
  });

  it('shows the open rows while the closed read is pending', async () => {
    renderRail(native([LEGACY_PERIOD]), { closed: PENDING });

    expect(await screen.findByRole('link', { name: 'Kitimat Terminal' })).toBeInTheDocument();
    expect(within(section()).queryByText('Loading')).not.toBeInTheDocument();
  });

  it('holds the skeleton when no period is open and the closed read is pending', async () => {
    const queryClient = makeQueryClient();
    renderRail(native([]), { closed: PENDING, queryClient });

    await waitFor(() => expect(queryClient.isFetching()).toBe(1));
    expect(within(section()).getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText(/^No comment periods are open/)).not.toBeInTheDocument();
  });

  describe('a recently closed period', () => {
    const RED_MOUNTAIN = closedRow('cp-5', 'Red Mountain', 3);

    it('comes after the open rows', async () => {
      renderRail(native([ENGAGE_PERIOD, LEGACY_PERIOD]), { closed: native([RED_MOUNTAIN]) });

      await screen.findByRole('link', { name: 'Red Mountain' });
      const rows = within(section()).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(rows[2]).toHaveTextContent('Red Mountain');
    });

    it('says Closed in place of the days left', async () => {
      renderRail(native([LEGACY_PERIOD]), { closed: native([RED_MOUNTAIN]) });

      const card = (await screen.findByRole('link', { name: 'Red Mountain' })).closest('li')!;
      expect(card).not.toHaveTextContent('Remaining');
      expect(within(card).getByText('Closed')).toBeInTheDocument();
    });

    it('describes its link by the Closed pill, and an open row gets no description', async () => {
      renderRail(native([LEGACY_PERIOD]), { closed: native([RED_MOUNTAIN]) });

      expect(await screen.findByRole('link', { name: 'Red Mountain' })).toHaveAccessibleDescription(
        'Closed',
      );
      expect(screen.getByRole('link', { name: 'Kitimat Terminal' })).toHaveAccessibleDescription(
        '',
      );
    });

    it('describes an ENGAGE link by the Closed pill too', async () => {
      const onEngage = { ...RED_MOUNTAIN, isMet: true, metURL: 'https://engage.example/red' };
      renderRail(native([]), { closed: native([onEngage]) });

      expect(
        await screen.findByRole('link', { name: 'Red Mountain (opens in new tab)' }),
      ).toHaveAccessibleDescription('Closed');
    });

    it('shows once when the open read also answered with it', async () => {
      const straddling = { ...LEGACY_PERIOD, dateCompleted: at(-3) };
      const queryClient = makeQueryClient();
      renderRail(native([LEGACY_PERIOD]), { closed: native([straddling]), queryClient });

      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getAllByRole('link', { name: 'Kitimat Terminal' })).toHaveLength(1);
    });

    it('sits under the none-open line, which drops the 30-day sentence', async () => {
      renderRail(native([]), { closed: native([RED_MOUNTAIN]) });

      expect(await screen.findByRole('link', { name: 'Red Mountain' })).toBeInTheDocument();
      expect(screen.getByText(/^No comment periods are open right now\./)).toHaveTextContent(
        /^No comment periods are open right now\.$/,
      );
    });
  });

  it('keeps the open rows when the closed read fails', async () => {
    const queryClient = makeQueryClient();
    renderRail(native([LEGACY_PERIOD]), { closed: json(null, 500), queryClient });

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(await screen.findByRole('link', { name: 'Kitimat Terminal' })).toBeInTheDocument();
  });
});
