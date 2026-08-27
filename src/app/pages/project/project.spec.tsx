import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { logger } from 'app/config/logging';
import { ProjectPage } from './project';
import { ProjectDetailsTab } from './project-details-tab';

const LISTS = [
  { _id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { _id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { _id: 'type-memo-2002', name: 'Scientific Memo', legislation: 2002, type: 'doctype' },
  { _id: 'type-memo-2018', name: 'Independent Memo', legislation: 2018, type: 'doctype' },
  { _id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { _id: 'ms-eac', name: 'EAC Application', legislation: 2018, type: 'label' },
  { _id: 'ms-eac-rev', name: 'Revised EAC Application', legislation: 2018, type: 'label' },

  { _id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { _id: 'type-cert-2018', name: 'Certificate Package', legislation: 2018, type: 'doctype' },
  { _id: 'type-order-2002', name: 'Order', legislation: 2002, type: 'doctype' },
  { _id: 'type-order-2018', name: 'Order', legislation: 2018, type: 'doctype' },
  { _id: 'type-dm-2002', name: 'Decision Materials', legislation: 2002, type: 'doctype' },
  { _id: 'type-dm-2018', name: 'Decision Materials', legislation: 2018, type: 'doctype' },
  { _id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },
  { _id: 'ms-certdec-2018', name: 'Certificate Decision', legislation: 2018, type: 'label' },
  { _id: 'ms-decision-2002', name: 'Decision', legislation: 2002, type: 'label' },
  { _id: 'ms-certext-2002', name: 'Certificate Extension', legislation: 2002, type: 'label' },
  { _id: 'ms-certext-2018', name: 'Certificate Extension', legislation: 2018, type: 'label' },
  { _id: 'ms-transfer-2018', name: 'Transfer of Certificate/Order', legislation: 2018, type: 'label' },

  { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { _id: 'type-amend-2018', name: 'Amendment Package', legislation: 2018, type: 'doctype' },
  { _id: 'type-req-2002', name: 'Request', legislation: 2002, type: 'doctype' },
  { _id: 'type-tt-2002', name: 'Tracking Table', legislation: 2002, type: 'doctype' },
  { _id: 'type-tt-2018', name: 'Tracking Table', legislation: 2018, type: 'doctype' },
  { _id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  { _id: 'ms-amend-2018', name: 'Amendment', legislation: 2018, type: 'label' },
  { _id: 'ph-amend-2002', name: 'Post Decision - Amendment', legislation: 2002, type: 'projectPhase' },
  { _id: 'ph-amend-2018', name: 'Post Decision - Amendment', legislation: 2018, type: 'projectPhase' }
];

const PROJECT = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  legislation: '2018 Environmental Assessment Act',
  region: 'Skeena',
  location: 'Near Cedar Creek',
  eacDecision: { name: 'In Progress' },
  centroid: [],
  commentPeriodForBanner: []
};

/** A comment period whose window brackets today, so the banner is visible. */
function openCommentPeriod() {
  const started = new Date();
  started.setDate(started.getDate() - 2);
  const completed = new Date();
  completed.setDate(completed.getDate() + 5);
  return [
    {
      _id: 'cp-1',
      dateStarted: started.toISOString(),
      dateCompleted: completed.toISOString(),
      informationLabel: 'Draft Application'
    }
  ];
}

let requests: string[];
let tabSearchResponse: (url: string) => unknown;
let project: Record<string, unknown>;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function renderShell(path = '/p/proj-1/decisions') {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith('/api/project/')) {
        return jsonResponse([project]);
      }
      if (url.includes('dataset=List')) {
        return jsonResponse([{ searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] }]);
      }
      if (url.includes('dataset=Document')) {
        return jsonResponse(tabSearchResponse(url));
      }
      return jsonResponse([{ searchResults: [], meta: [] }]);
    })
  );

  const router = createMemoryRouter(
    [
      {
        path: '/p/:projId',
        Component: ProjectPage,
        children: [{ path: 'decisions', element: <div>tab body</div> }]
      },
      { path: '/projects', element: <div>projects page</div> }
    ],
    { initialEntries: [path] }
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return router;
}

describe('project shell', () => {
  beforeEach(() => {
    requests = [];
    project = { ...PROJECT };
    tabSearchResponse = () => [{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the always-visible tabs and hides the optional ones with no documents', async () => {
    renderShell();

    expect(await screen.findByRole('tab', { name: 'Project Details' })).toHaveAttribute('id', 'project-details-tab');
    expect(screen.getByRole('tab', { name: 'Commenting' })).toHaveAttribute('href', '/p/proj-1/commenting');
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute('href', '/p/proj-1/documents');

    await waitFor(() => expect(requests.filter(url => url.includes('dataset=Document'))).toHaveLength(3));
    expect(screen.queryByRole('tab', { name: 'Application' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Certificate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Amendment(s)' })).not.toBeInTheDocument();
  });

  it('asks for one document per optional tab, filtered by that tab type and milestone ids', async () => {
    renderShell();

    await waitFor(() => expect(requests.filter(url => url.includes('dataset=Document'))).toHaveLength(3));

    expect(requests.find(url => url.includes('and[type]=type-app-2002'))).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=1&projectLegislation=default&sortBy=&sortBy=&populate=true' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-app-2002&and[type]=type-app-2018&and[type]=type-memo-2002&and[type]=type-memo-2018' +
        '&and[milestone]=ms-appreview&and[milestone]=ms-eac&and[milestone]=ms-eac-rev' +
        '&fuzzy=false'
    );
  });

  it('shows an optional tab once its search finds a document', async () => {
    tabSearchResponse = url =>
      url.includes('and[milestone]=ms-amend-2002')
        ? [{ searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] }]
        : [{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }];

    renderShell();

    expect(await screen.findByRole('tab', { name: 'Amendment(s)' })).toHaveAttribute('href', '/p/proj-1/amendments');
    expect(screen.queryByRole('tab', { name: 'Certificate' })).not.toBeInTheDocument();
  });

  it('leaves an optional tab hidden and logs when the search answers unusably', async () => {
    // getSearchResults turns a non-2xx into `null`, so a 502 and a document-less project are
    // indistinguishable downstream. The tab must stay hidden, and the console must say why.
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    tabSearchResponse = () => [{ meta: [] }];

    renderShell();

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.queryByRole('tab', { name: 'Amendment(s)' })).not.toBeInTheDocument();
    expect(error.mock.calls.some(call => String(call[0]).includes('leaving it hidden'))).toBe(true);
  });

  it('does not log when the search legitimately finds nothing', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    renderShell();

    await waitFor(() => expect(requests.filter(url => url.includes('dataset=Document'))).toHaveLength(3));
    expect(error.mock.calls.some(call => String(call[0]).includes('leaving it hidden'))).toBe(false);
  });

  it('renders the comment period banner for an open period', async () => {
    project = { ...PROJECT, commentPeriodForBanner: openCommentPeriod() };

    renderShell();

    expect(await screen.findByText('Public Comment Period is Open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Comment Period' })).toBeInTheDocument();
    expect(screen.getByText('Draft Application')).toBeInTheDocument();
  });

  it('renders no banner when the project has no comment period', async () => {
    renderShell();

    await screen.findByRole('tab', { name: 'Project Details' });
    expect(screen.queryByText(/Public Comment Period is/)).not.toBeInTheDocument();
  });

  it('renders the map placeholder when the project has no centroid', async () => {
    renderShell();

    expect(await screen.findByText('No map available')).toBeInTheDocument();
  });

  it('sends the visitor back to the project list when the project cannot be loaded', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    project = undefined as unknown as Record<string, unknown>;

    const router = renderShell();

    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'));
    expect(window.alert).toHaveBeenCalledWith("Uh-oh, couldn't load project");
  });
});

/** A fetch stub that records URLs and hands back promises the test resolves when it chooses. */
function deferredFetch() {
  const urls: string[] = [];
  const pending: { url: string; resolve: () => void }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return new Promise<Response>(resolve => {
        pending.push({
          url,
          resolve: () => {
            if (url.includes('dataset=List')) {
              return resolve(jsonResponse([{ searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] }]));
            }
            if (url.startsWith('/api/project/') && !url.includes('/pin')) {
              return resolve(jsonResponse([PROJECT]));
            }
            if (url.includes('/pin')) {
              return resolve(jsonResponse([{ results: [], total_items: 0 }]));
            }
            resolve(jsonResponse([{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }]));
          }
        });
      });
    })
  );
  return {
    urls,
    /** Resolves every request recorded so far, including any queued since the last flush. */
    flush: () => pending.splice(0).forEach(entry => entry.resolve())
  };
}

function renderShellWithDetailsTab() {
  const router = createMemoryRouter(
    [
      {
        path: '/p/:projId',
        Component: ProjectPage,
        children: [{ path: 'project-details', Component: ProjectDetailsTab }]
      },
      { path: '/projects', element: <div>projects page</div> }
    ],
    { initialEntries: ['/p/proj-1/project-details'] }
  );
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe('project page first paint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires every projId-only query before any of them resolves', async () => {
    const fetchStub = deferredFetch();

    renderShellWithDetailsTab();

    // Nothing has been resolved, so anything in this list was issued from the project id alone
    // rather than from another request's answer.
    await waitFor(() => expect(fetchStub.urls).toHaveLength(5));
    const issued = fetchStub.urls.join('\n');
    expect(issued).toMatch(/^\/api\/project\/proj-1\?/m);
    expect(issued).toMatch(/^\/api\/project\/proj-1\/pin\?/m);
    expect(issued).toMatch(/dataset=List/);
    expect(issued).toMatch(/dataset=RecentActivity/);
    expect(issued).toMatch(/dataset=Document.*pageSize=5/);
  });

  it('fires the three optional-tab probes as soon as the List query answers, project still pending', async () => {
    const fetchStub = deferredFetch();

    renderShellWithDetailsTab();

    await waitFor(() => expect(fetchStub.urls).toHaveLength(5));
    // Only the List response is needed to build the probe filters; releasing it must not wait on
    // the project fetch, which is still outstanding here.
    fetchStub.urls.splice(0);
    fetchStub.flush();

    await waitFor(() => expect(fetchStub.urls.filter(url => url.includes('pageSize=1'))).toHaveLength(3));
  });

  it('shows skeleton placeholders in the hero and the details block, then swaps both for the project', async () => {
    const fetchStub = deferredFetch();

    const { container } = renderShellWithDetailsTab();

    expect(await screen.findByText('Loading project')).toBeInTheDocument();
    expect(screen.getByText('Loading project details')).toBeInTheDocument();
    // Placeholder bars stand in for the hero name and every detail row, and the regions holding
    // them are marked busy.
    expect(container.querySelector('h1 .placeholder')).toBeInTheDocument();
    expect(container.querySelector('.sidebar-content[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelector('.location-info[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('.location-info .placeholder').length).toBeGreaterThan(1);
    // Every placeholder sits under an aria-hidden node, so the only thing announced is the
    // visually-hidden loading text.
    for (const bar of container.querySelectorAll('.placeholder')) {
      expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.queryByText('Cedar Quarry')).not.toBeInTheDocument();

    fetchStub.flush();
    // The tab probes and the featured-document search start after the first flush.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cedar Quarry'));
    fetchStub.flush();

    await waitFor(() => expect(screen.queryByText('Loading project')).not.toBeInTheDocument());
    expect(screen.queryByText('Loading project details')).not.toBeInTheDocument();
    expect(container.querySelector('h1 .placeholder')).toBeNull();
    expect(container.querySelector('.location-info .placeholder')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText('Proponent')).toBeInTheDocument();
  });
});
