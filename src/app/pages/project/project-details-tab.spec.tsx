import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { Project } from 'app/models/project';
import { ProjectDetailsTab } from './project-details-tab';

const LISTS = [
  { _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
];

const PROJECT = new Project({
  _id: 'proj-1',
  name: 'Cedar Quarry',
  description: 'First line.\nSecond line.',
  proponent: { name: 'Cedar Holdings' },
  type: 'Mines',
  sector: 'Sand and Gravel',
  build: 'modification',
  CEAAInvolvement: { name: 'None' },
  currentPhaseName: { name: 'Application Review' },
  eacDecision: { name: 'In Progress' },
  decisionDate: '2026-04-02T00:00:00.000Z',
});

const FEATURED = [
  {
    _id: 'doc-1',
    displayName: 'Featured Report',
    datePosted: '2026-05-01T00:00:00.000Z',
    isFeatured: true,
  },
];
const PINS = [{ _id: 'org-1', name: 'Cedar Nation', province: 'British Columbia' }];
const ACTIVITIES = [
  {
    _id: 'act-1',
    headline: 'Application accepted',
    content: '<p>Body</p>',
    dateAdded: '2026-06-01T00:00:00.000Z',
  },
];

let requests: string[];
let pinsTotal = 1;
let activitiesTotal = 1;
let featuredTotal = 1;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project: PROJECT, projId: 'proj-1', lists: LISTS }),
  };
});

function renderTab(path = '/p/proj-1/project-details') {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('/pin')) {
        return jsonResponse([{ results: pinsTotal > 0 ? PINS : [], total_items: pinsTotal }]);
      }
      if (url.includes('dataset=RecentActivity')) {
        return jsonResponse([
          {
            searchResults: activitiesTotal > 0 ? ACTIVITIES : [],
            meta: [{ searchResultsTotal: activitiesTotal }],
          },
        ]);
      }
      if (url.includes('dataset=Document')) {
        return jsonResponse([
          {
            searchResults: featuredTotal > 0 ? FEATURED : [],
            meta: [{ searchResultsTotal: featuredTotal }],
          },
        ]);
      }
      return jsonResponse([{ searchResults: [], meta: [] }]);
    }),
  );

  const router = createMemoryRouter(
    [{ path: '/p/:projId/project-details', Component: ProjectDetailsTab }],
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

describe('project details tab', () => {
  beforeEach(() => {
    requests = [];
    pinsTotal = 1;
    activitiesTotal = 1;
    featuredTotal = 1;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders the project facts, with newlines turned into breaks', async () => {
    renderTab();

    expect(await screen.findByText('Cedar Holdings')).toBeInTheDocument();
    expect(screen.getByText('Mines')).toBeInTheDocument();
    expect(screen.getByText('Sand and Gravel')).toBeInTheDocument();
    expect(screen.getByText('Application Review')).toBeInTheDocument();
    expect(screen.getByText('In Progress | April 2, 2026')).toBeInTheDocument();
    expect(document.querySelector('.desc')?.innerHTML).toBe('First line.<br>Second line.');
  });

  it('falls back when the project carries no nature description', async () => {
    renderTab();

    expect(await screen.findByText('No nature description available')).toBeInTheDocument();
  });

  it('asks for the five most recent featured documents', async () => {
    renderTab();

    await screen.findByText('Featured Report');
    expect(requests.find((url) => url.includes('isFeatured'))).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=5&projectLegislation=default' +
        '&sortBy=-datePosted&sortBy=&populate=false&and[isFeatured]=true&fuzzy=false',
    );
    expect(screen.getByText('Featured Documents')).toBeInTheDocument();
  });

  it('hides the featured documents block when the project has none', async () => {
    featuredTotal = 0;
    renderTab();

    await waitFor(() => expect(requests.some((url) => url.includes('isFeatured'))).toBe(true));
    await waitFor(() => expect(screen.queryByText('Featured Documents')).not.toBeInTheDocument());
  });

  it('asks for the participating nations page and renders them', async () => {
    renderTab();

    expect(await screen.findByText('Cedar Nation')).toBeInTheDocument();
    expect(requests.find((url) => url.includes('/pin'))).toBe(
      '/api/project/proj-1/pin?pageNum=0&pageSize=10&sortBy=+name',
    );
    expect(screen.getByText('Participating Indigenous Nations')).toBeInTheDocument();
  });

  it('scopes the nations table paging to its own query param', async () => {
    const router = renderTab('/p/proj-1/project-details?currentPagePins=2&sortByPins=-name');

    await waitFor(() =>
      expect(requests.find((url) => url.includes('/pin'))).toBe(
        '/api/project/proj-1/pin?pageNum=1&pageSize=10&sortBy=-name',
      ),
    );
    expect(router.state.location.search).toContain('currentPagePins=2');
  });

  it('hides the nations block when the project has none', async () => {
    pinsTotal = 0;
    renderTab();

    await waitFor(() => expect(requests.some((url) => url.includes('/pin'))).toBe(true));
    await waitFor(() =>
      expect(screen.queryByText('Participating Indigenous Nations')).not.toBeInTheDocument(),
    );
  });

  it('asks for the project activities, scoped to the project', async () => {
    renderTab();

    expect(await screen.findByText('Application accepted')).toBeInTheDocument();
    expect(requests.find((url) => url.includes('dataset=RecentActivity'))).toBe(
      '/api/search?dataset=RecentActivity&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-dateAdded&sortBy=&populate=true&and[project]=proj-1&fuzzy=false',
    );
  });

  it('writes the activities keyword search to its own query params', async () => {
    const router = renderTab();

    await screen.findByText('Application accepted');
    await userEvent.type(screen.getByPlaceholderText('Type keyword to search'), 'slope{Enter}');

    await waitFor(() => expect(router.state.location.search).toContain('keywordsActivities=slope'));
    expect(router.state.location.search).toContain('sortByActivities=-score');
    expect(router.state.location.search).toContain('currentPageActivities=1');
  });

  it('says so when the project has no activities', async () => {
    activitiesTotal = 0;
    renderTab();

    expect(await screen.findByText('No recent activities.')).toBeInTheDocument();
  });
});
