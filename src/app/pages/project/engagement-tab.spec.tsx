import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notificationToProject } from 'app/api/notification';
import { queryClient as appQueryClient } from 'app/api/query-client';
import { ProjectNotification } from 'app/models/projectNotification';
import { json, native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
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

/** DEMI files the project's periods under its Track id, `26`, and joins the Eagle id back on. */
const DEMI_PROJECT = { id: '26', eagleId: 'proj-1' };

const OPEN_PERIOD = {
  id: 'cp-open',
  projectId: '26',
  projectEagleId: 'proj-1',
  dateStarted: daysFromNow(-3),
  dateCompleted: daysFromNow(4),
  instructions:
    '<p>Public   Comment Period on the <b>Draft Application</b> for Cedar Quarry, closing soon.</p>',
};

const CLOSED_PERIOD = {
  id: 'cp-closed',
  projectId: '26',
  projectEagleId: 'proj-1',
  dateStarted: '2020-01-01T00:00:00.000Z',
  dateCompleted: '2020-02-01T00:00:00.000Z',
  informationLabel: 'Early Engagement',
};

let requests: string[];
let periods: unknown[];

function renderTab() {
  requests = stubFetch((url) =>
    url.startsWith('/demi-projects/') ? json(DEMI_PROJECT) : native(periods),
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

  afterEach(() => {
    vi.unstubAllGlobals();
    appQueryClient.clear();
  });

  it("asks DEMI for the project's comment periods under its DEMI id, newest first", async () => {
    renderTab();

    await screen.findByText('Draft Application');
    expect(requests).toContain(
      '/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=26',
    );
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
      { id: 'cp-next', dateStarted: daysFromNow(5), dateCompleted: daysFromNow(30) },
    ];
    renderTab();

    expect(await screen.findByText(/Days Remaining$/)).toHaveClass('status-pill--success');
    expect(screen.getByText(/^Closed /)).toHaveClass('status-pill--neutral');
    expect(screen.getByText(/^Starts /)).toHaveClass('status-pill--warning');
  });

  it('titles an open period from the subject in its instructions', async () => {
    renderTab();

    expect(await screen.findByText('Draft Application')).toBeInTheDocument();
  });

  it('offers an open period hosted here as a View Engagement link in the closed style', async () => {
    periods = [OPEN_PERIOD];
    renderTab();

    const link = await screen.findByRole('link', { name: 'View Engagement' });
    expect(link).toHaveAttribute('href', '/p/proj-1/cp/cp-open');
    expect(link).toHaveClass('engagement-tab__cta--secondary');
    expect(screen.queryByRole('link', { name: /Share your thoughts/ })).toBeNull();
  });

  it('shows the closed period with its label and a View Engagement link', async () => {
    periods = [CLOSED_PERIOD];
    renderTab();

    expect(await screen.findByRole('heading', { name: 'Early Engagement' })).toBeInTheDocument();
    expect(screen.getByText(/^Closed /)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Engagement' })).toBeInTheDocument();
  });

  it('drops duplicate periods that point at the same engagement', async () => {
    periods = [
      { ...OPEN_PERIOD, isMet: true, metURL: 'https://engage.example/cedar' },
      { ...OPEN_PERIOD, id: 'cp-dupe', isMet: true, metURL: 'https://engage.example/cedar' },
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
    expect(link).toHaveClass('engagement-tab__cta--primary');
  });

  it('navigates to the comment period page for an eagle-hosted period', async () => {
    periods = [OPEN_PERIOD];
    const router = renderTab();

    const link = await screen.findByRole('link', { name: 'View Engagement' });
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

  /** DEMI has no project under a notification id, so it is sent as the periods' parent as is. */
  function renderNotificationTab(respond: () => Response) {
    requests = stubFetch((url) =>
      url.startsWith('/demi-projects/') ? json(null, 404) : respond(),
    );
    return renderAt(`/pn/${ID}/engagement`, [
      { path: '/pn/:projId/engagement', Component: EngagementTab },
    ]);
  }

  const noPeriods = () => native([]);

  afterEach(() => {
    vi.unstubAllGlobals();
    appQueryClient.clear();
  });

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
    const { projectEagleId: _none, ...period } = { ...OPEN_PERIOD, projectId: ID };
    renderNotificationTab(() => native([period]));

    expect(await screen.findByRole('link', { name: 'View Engagement' })).toHaveAttribute(
      'href',
      `/pn/${ID}/cp/cp-open`,
    );
    expect(requests).toContain(
      `/demi/api/comment-periods?pageSize=100&sort=-dateStarted&project=${ID}`,
    );
  });

  it('calls it a project notification when there is no period at all', async () => {
    context = notificationContext({
      pcp: 'none',
      dateStarted: undefined,
      dateCompleted: undefined,
    });
    renderNotificationTab(noPeriods);

    expect(
      await screen.findByText(
        'No comment periods are currently scheduled for this project notification.',
      ),
    ).toBeInTheDocument();
  });

  it('holds the list busy while the notification loads, even once the periods answer none', async () => {
    context = notificationContext({}, true);
    stubFetch(noPeriods);
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
