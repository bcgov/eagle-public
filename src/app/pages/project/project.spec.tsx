import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { logger } from 'app/config/logging';
import { ProjectPage } from './project';

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

    // `fields=[object Object]` is what the Angular app sent too: it passes the field/value pairs
    // where buildValues expects names. Kept as-is so the request is byte-identical.
    expect(requests.find(url => url.includes('and[type]=type-app-2002'))).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=1&projectLegislation=default&sortBy=&sortBy=&populate=true' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-app-2002&and[type]=type-app-2018&and[type]=type-memo-2002&and[type]=type-memo-2018' +
        '&and[milestone]=ms-appreview&and[milestone]=ms-eac&and[milestone]=ms-eac-rev' +
        '&fields=[object Object]&fuzzy=false'
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
