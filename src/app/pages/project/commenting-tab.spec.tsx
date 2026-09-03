import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { CommentingTab } from './commenting-tab';

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return { ...original, useProjectContext: () => ({ project: null, projId: 'proj-1', lists: [] }) };
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
      return jsonResponse(periods);
    }),
  );

  const router = createMemoryRouter(
    [
      { path: '/p/:projId/commenting', Component: CommentingTab },
      { path: '/p/:projId/cp/:cpId', element: <div>comment period page</div> },
    ],
    { initialEntries: ['/p/proj-1/commenting'] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('commenting tab', () => {
  beforeEach(() => {
    requests = [];
    periods = [OPEN_PERIOD, CLOSED_PERIOD];
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks eagle-api for the project comment periods, newest first', async () => {
    renderTab();

    await screen.findByText('Draft Application');
    expect(requests[0]).toBe(
      '/api/commentperiod?project=proj-1&sortBy=-dateStarted' +
        '&fields=project|dateStarted|dateCompleted|instructions|isMet|metURL|informationLabel',
    );
  });

  it('titles an open period from the subject in its instructions', async () => {
    renderTab();

    expect(await screen.findByText('Draft Application')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share your thoughts' })).toBeInTheDocument();
  });

  it('shows the closed period with its label and a View Engagement button', async () => {
    renderTab();

    expect(await screen.findByRole('heading', { name: 'Early Engagement' })).toBeInTheDocument();
    expect(screen.getByText(/^Closed /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Engagement' })).toBeInTheDocument();
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

  it('opens an ENGAGE-hosted period in a new tab instead of navigating', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    periods = [{ ...OPEN_PERIOD, isMet: true, metURL: 'https://engage.example/cedar' }];

    const router = renderTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Share your thoughts' }));

    expect(open).toHaveBeenCalledWith('https://engage.example/cedar', '_blank');
    expect(router.state.location.pathname).toBe('/p/proj-1/commenting');
    open.mockRestore();
  });

  it('navigates to the comment period page for an eagle-hosted period', async () => {
    const router = renderTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Share your thoughts' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/p/proj-1/cp/cp-open'));
  });

  it('says so when the project has no comment periods', async () => {
    periods = [];
    renderTab();

    expect(
      await screen.findByText('No comment periods are currently scheduled for this project.'),
    ).toBeInTheDocument();
  });
});
