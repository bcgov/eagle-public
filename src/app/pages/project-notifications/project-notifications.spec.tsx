import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ProjectNotifications } from './project-notifications';

const NOTIFICATIONS = [
  {
    _id: 'n1',
    name: 'Cedar Quarry',
    type: 'Mines',
    region: 'Skeena',
    decision: 'Not Reviewable',
    decisionDate: '2026-05-04T00:00:00.000Z',
    description: 'A quarry near Cedar Creek.',
    pcp: 'open',
    dateStarted: '2026-08-01T00:00:00.000Z',
    dateCompleted: '2099-09-01T00:00:00.000Z',
  },
];

const DOCUMENTS = [
  {
    _id: 'doc1',
    displayName: 'Notification Form',
    datePosted: '2026-05-01T00:00:00.000Z',
    documentAuthor: 'auth1',
  },
];

let requests: string[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAt(path: string) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('dataset=ProjectNotification')) {
        return jsonResponse([{ searchResults: NOTIFICATIONS, meta: [{ searchResultsTotal: 30 }] }]);
      }
      if (url.includes('dataset=Document')) {
        return jsonResponse([{ searchResults: DOCUMENTS, meta: [{ searchResultsTotal: 1 }] }]);
      }
      if (url.includes('dataset=List')) {
        return jsonResponse([
          { searchResults: [{ _id: 'auth1', name: 'EAO' }], meta: [{ searchResultsTotal: 1 }] },
        ]);
      }
      if (url.includes('/commentperiod')) {
        return jsonResponse([]);
      }
      return jsonResponse([{ searchResults: [], meta: [] }]);
    }),
  );

  const router = createMemoryRouter(
    [{ path: '/project-notifications', Component: ProjectNotifications }],
    {
      initialEntries: [path],
    },
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

function lastRequestFor(dataset: string): string | undefined {
  return requests.filter((url) => url.includes(`dataset=${dataset}`)).at(-1);
}

describe('project notifications', () => {
  beforeEach(() => {
    requests = [];
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests ProjectNotification with the -_id default sort', async () => {
    renderAt('/project-notifications');

    expect(await screen.findByText('CEDAR QUARRY')).toBeInTheDocument();
    expect(lastRequestFor('ProjectNotification')).toBe(
      '/api/search?dataset=ProjectNotification&pageNum=0&pageSize=10&projectLegislation=default&sortBy=-_id&sortBy=&populate=true&fuzzy=false',
    );
  });

  it('renders no table header, since the single column is a label only', async () => {
    renderAt('/project-notifications');

    await screen.findByText('CEDAR QUARRY');
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('sends the pcp and decision filters from the URL as and[] params', async () => {
    renderAt('/project-notifications?pcp=open&decision=Not%20Reviewable&region=skeena');

    await screen.findByText('CEDAR QUARRY');
    const request = lastRequestFor('ProjectNotification')!;
    expect(request).toContain('&and[region]=skeena');
    expect(request).toContain('&and[pcp]=open');
    expect(request).toContain('&and[decision]=Not Reviewable');
  });

  it('writes currentPage on a page change', async () => {
    const router = renderAt('/project-notifications');
    await screen.findByText('CEDAR QUARRY');

    await userEvent.click(screen.getAllByRole('button', { name: 'Go to page 2' })[0]);

    await waitFor(() => expect(router.state.location.search).toContain('currentPage=2'));
    await waitFor(() => expect(lastRequestFor('ProjectNotification')).toContain('&pageNum=1&'));
  });

  it('shows the details tab first, with the notification decision', async () => {
    renderAt('/project-notifications');

    expect(
      await screen.findByText('Notification Decision - Not Reviewable | 2026-05-04'),
    ).toBeInTheDocument();
    expect(screen.getByText('A quarry near Cedar Creek.')).toBeInTheDocument();
  });

  it('fetches the documents sub-table only once its tab is opened', async () => {
    renderAt('/project-notifications');
    await screen.findByText('CEDAR QUARRY');
    expect(lastRequestFor('Document')).toBeUndefined();

    await userEvent.click(screen.getByRole('tab', { name: 'Documents' }));

    await waitFor(() => expect(screen.getByText('Notification Form')).toBeInTheDocument());
    // Scoped to the parent notification, page size 5, and the backend's inverted sort convention.
    expect(lastRequestFor('Document')).toBe(
      '/api/search?dataset=Document&project=n1&pageNum=0&pageSize=5&projectLegislation=default&sortBy=+datePosted&sortBy=&populate=true&and[documentSource]=PROJECT-NOTIFICATION&fuzzy=false',
    );
  });

  it('offers the engagement tab for a notification with an open comment period', async () => {
    renderAt('/project-notifications');
    await screen.findByText('CEDAR QUARRY');

    await userEvent.click(screen.getByRole('tab', { name: 'Engagement' }));

    expect(
      await screen.findByRole('heading', { name: 'Public Comment Period' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share your thoughts' })).toBeInTheDocument();
  });
});
