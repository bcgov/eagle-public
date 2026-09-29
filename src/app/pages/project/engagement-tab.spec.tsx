import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notificationToProject } from 'app/api/notification';
import { ProjectNotification } from 'app/models/projectNotification';
import { makeQueryClient, renderAt } from '../../../test-utils';
import type { ProjectContext } from './project-context';
import { EngagementTab } from './engagement-tab';

const PROJECT_CONTEXT: ProjectContext = {
  project: null,
  projId: 'proj-1',
  basePath: '/p/proj-1',
  isNotification: false,
  lists: [],
  projectLoading: false,
};

/** What the shell hands its tabs; a notification test swaps in its own. */
let context: ProjectContext;

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return { ...original, useProjectContext: () => context };
});

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const OPEN_PERIOD = {
  _id: 'cp-open',
  dateStarted: daysFromNow(-3),
  dateCompleted: daysFromNow(4),
  instructions:
    '<p>Public   Comment Period on the <b>Draft Application</b> for Cedar Quarry, closing soon.</p>',
};

const CLOSED_PERIOD = {
  _id: 'cp-closed',
  dateStarted: '2020-01-01T00:00:00.000Z',
  dateCompleted: '2020-02-01T00:00:00.000Z',
  informationLabel: 'Early Engagement',
};

let requests: string[];
let periods: unknown[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderTab() {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return jsonResponse([
        { searchResults: periods, meta: [{ searchResultsTotal: periods.length }] },
      ]);
    }),
  );

  return renderAt('/p/proj-1/engagement', [
    { path: '/p/:projId/engagement', Component: EngagementTab },
    { path: '/p/:projId/cp/:cpId', element: <div>comment period page</div> },
  ]).router;
}

describe('engagement tab', () => {
  beforeEach(() => {
    requests = [];
    periods = [OPEN_PERIOD, CLOSED_PERIOD];
    context = PROJECT_CONTEXT;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks for the project comment periods through search, newest first', async () => {
    renderTab();

    await screen.findByText('Draft Application');
    const url = new URL(requests[0], 'http://x');
    expect(url.pathname).toBe('/demi-search/search');
    expect(url.searchParams.get('dataset')).toBe('CommentPeriod');
    expect(url.searchParams.get('and[project]')).toBe('proj-1');
    expect(url.searchParams.get('sortBy')).toBe('-dateStarted');
  });

  it('heads the tab and labels each card with its period status', async () => {
    renderTab();

    await screen.findByText('Draft Application');
    expect(screen.getByRole('heading', { level: 2, name: 'Engagement' })).toBeInTheDocument();
    expect(screen.getByText('Open', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Closed', { exact: true })).toBeInTheDocument();
  });

  it('colours each period pill by its state: open green, closed grey, upcoming amber', async () => {
    periods = [
      OPEN_PERIOD,
      CLOSED_PERIOD,
      { _id: 'cp-next', dateStarted: daysFromNow(5), dateCompleted: daysFromNow(30) },
    ];
    renderTab();

    expect(await screen.findByText(/Days Remaining$/)).toHaveClass('status-pill--success');
    expect(screen.getByText(/^Closed /)).toHaveClass('status-pill--neutral');
    expect(screen.getByText(/^Starts /)).toHaveClass('status-pill--warning');
  });

  it('titles an open period from the subject in its instructions', async () => {
    renderTab();

    expect(await screen.findByText('Draft Application')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Share your thoughts' })).toBeInTheDocument();
  });

  it('shows the closed period with its label and a View Engagement link', async () => {
    renderTab();

    expect(await screen.findByRole('heading', { name: 'Early Engagement' })).toBeInTheDocument();
    expect(screen.getByText(/^Closed /)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Engagement' })).toBeInTheDocument();
  });

  it('drops duplicate periods that point at the same engagement', async () => {
    periods = [
      { ...OPEN_PERIOD, isMet: true, metURL: 'https://engage.example/cedar' },
      { ...OPEN_PERIOD, _id: 'cp-dupe', isMet: true, metURL: 'https://engage.example/cedar' },
    ];

    renderTab();

    await screen.findByText('Draft Application');
    expect(screen.getAllByText('Draft Application')).toHaveLength(1);
  });

  it('links an ENGAGE-hosted period out to its own site, in a new tab', async () => {
    periods = [{ ...OPEN_PERIOD, isMet: true, metURL: 'https://engage.example/cedar' }];

    renderTab();

    const link = await screen.findByRole('link', {
      name: 'Share your thoughts (opens in new tab)',
    });
    expect(link).toHaveAttribute('href', 'https://engage.example/cedar');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('navigates to the comment period page for an eagle-hosted period', async () => {
    const router = renderTab();

    const link = await screen.findByRole('link', { name: 'Share your thoughts' });
    expect(link).toHaveAttribute('href', '/p/proj-1/cp/cp-open');

    await userEvent.click(link);

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/cp/cp-open'));
  });

  it('says so when the project has no comment periods', async () => {
    periods = [];
    renderTab();

    expect(
      await screen.findByText('No comment periods are currently scheduled for this project.'),
    ).toBeInTheDocument();
  });

  it('marks the list busy while the comment periods are in flight, and claims none are scheduled', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { container } = renderAt('/p/proj-1/engagement', [
      { path: '/p/:projId/engagement', element: <EngagementTab /> },
    ]);

    expect(container.querySelector('.engagement-tab__list[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(
      screen.queryByText('No comment periods are currently scheduled for this project.'),
    ).not.toBeInTheDocument();
  });
});

describe('engagement tab on a project notification', () => {
  const ID = '5c8a3a3ce7f1f1002466c2b1';

  /** A notification record as the shell holds it, with a period only on its own fields. */
  function notificationContext(
    fields: Record<string, unknown> = {},
    projectLoading = false,
  ): ProjectContext {
    const project = notificationToProject(
      new ProjectNotification({
        _id: ID,
        name: 'Bear Creek Aggregate',
        pcp: 'open',
        dateStarted: daysFromNow(-3),
        dateCompleted: daysFromNow(4),
        ...fields,
      }),
    );
    return {
      project: projectLoading ? null : project,
      projId: ID,
      basePath: `/pn/${ID}`,
      isNotification: true,
      lists: [],
      projectLoading,
    };
  }

  function renderNotificationTab(respond: () => Response) {
    requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requests.push(String(input));
        return respond();
      }),
    );
    return renderAt(`/pn/${ID}/engagement`, [
      { path: '/pn/:projId/engagement', Component: EngagementTab },
    ]);
  }

  const noPeriods = () => jsonResponse([{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }]);

  afterEach(() => vi.unstubAllGlobals());

  it('shows the period the notification holds when no period record answers', async () => {
    context = notificationContext();
    renderNotificationTab(noPeriods);

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Public Comment Period' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Open', { exact: true })).toBeInTheDocument();
  });

  it('shows the period the notification holds when the period search fails', async () => {
    context = notificationContext();
    renderNotificationTab(() => new Response('', { status: 500 }));

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Public Comment Period' }),
    ).toBeInTheDocument();
  });

  it('offers no link into EPIC for the held period, which has no page of its own', async () => {
    context = notificationContext();
    renderNotificationTab(noPeriods);

    await screen.findByRole('heading', { level: 3, name: 'Public Comment Period' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links the held period out to ENGAGE when it has an ENGAGE page', async () => {
    context = notificationContext({ isMet: true, metURL: 'https://engage.example/bear-creek' });
    renderNotificationTab(noPeriods);

    expect(
      await screen.findByRole('link', { name: 'Share your thoughts (opens in new tab)' }),
    ).toHaveAttribute('href', 'https://engage.example/bear-creek');
  });

  it('links a period record under /pn/, not /p/', async () => {
    context = notificationContext();
    renderNotificationTab(() =>
      jsonResponse([{ searchResults: [OPEN_PERIOD], meta: [{ searchResultsTotal: 1 }] }]),
    );

    expect(await screen.findByRole('link', { name: 'Share your thoughts' })).toHaveAttribute(
      'href',
      `/pn/${ID}/cp/cp-open`,
    );
  });

  it('calls it a project notification when there is no period at all', async () => {
    context = notificationContext({ pcp: 'none' });
    renderNotificationTab(noPeriods);

    expect(
      await screen.findByText(
        'No comment periods are currently scheduled for this project notification.',
      ),
    ).toBeInTheDocument();
  });

  it('holds the list busy while the notification loads, even once the periods answer none', async () => {
    context = notificationContext({}, true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => noPeriods()),
    );
    // The periods have already answered none, so only the notification is still in flight.
    const queryClient = makeQueryClient();
    queryClient.setQueryData(['commentPeriods', ID], []);
    renderAt(
      `/pn/${ID}/engagement`,
      [{ path: '/pn/:projId/engagement', Component: EngagementTab }],
      {
        queryClient,
      },
    );

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(
      screen.queryByText(/No comment periods are currently scheduled/),
    ).not.toBeInTheDocument();
  });
});
