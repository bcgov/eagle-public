import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { logger } from 'app/config/logging';
import { DocumentsPage } from './documents-page';
import { useProjectContext, type ProjectContext } from './project-context';

const LISTS = [
  { _id: 'type-app-2002', name: 'Application Materials', legislation: 2002, type: 'doctype' },
  { _id: 'type-app-2018', name: 'Application Materials', legislation: 2018, type: 'doctype' },
  { _id: 'type-memo-2002', name: 'Scientific Memo', legislation: 2002, type: 'doctype' },
  { _id: 'type-memo-2018', name: 'Independent Memo', legislation: 2018, type: 'doctype' },
  { _id: 'ms-appreview', name: 'Application Review', legislation: 2002, type: 'label' },
  { _id: 'ms-eac', name: 'EAC Application', legislation: 2018, type: 'label' },
  { _id: 'ms-eac-rev', name: 'Revised EAC Application', legislation: 2018, type: 'label' },

  { _id: 'type-cert-2002', name: 'Certificate Package', legislation: 2002, type: 'doctype' },
  { _id: 'ms-cert-2002', name: 'Certificate', legislation: 2002, type: 'label' },

  { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
  { _id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
  {
    _id: 'ph-amend-2002',
    name: 'Post Decision - Amendment',
    legislation: 2002,
    type: 'projectPhase',
  },

  { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
  { _id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },
];

let requests: string[];
let tabSearchResponse: (url: string) => unknown;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const CONTEXT: ProjectContext = {
  project: { _id: 'proj-1', name: 'Cedar Quarry' } as ProjectContext['project'],
  projId: 'proj-1',
  lists: LISTS,
  projectLoading: false,
};

/** The Documents tab as the shell mounts it: outlet context in, sub-tab body out. */
function renderDocuments(path = '/p/proj-1/documents', retry: RetryOptions = {}) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const body = tabSearchResponse(url);
      return body instanceof Response ? body : jsonResponse(body);
    }),
  );

  return renderRouter(path, CONTEXT, retry);
}

interface RetryOptions {
  retry?: number | false;
  retryDelay?: number;
}

/** The same route tree, with whatever fetch stub the test installed. */
function renderRouter(
  path = '/p/proj-1/documents',
  context: ProjectContext = CONTEXT,
  { retry = false, retryDelay = 0 }: RetryOptions = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: '/p/:projId',
        element: <ShellStub context={context} />,
        children: [
          {
            path: 'documents',
            Component: DocumentsPage,
            children: [
              { index: true, element: <div>all documents</div> },
              { path: 'application', element: <ContextProbe /> },
              { path: 'compliance', element: <div>compliance documents</div> },
              { path: 'certificates', element: <div>certificate documents</div> },
              { path: 'amendments', element: <div>amendment documents</div> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry, retryDelay, gcTime: 0 } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** Stands in for a document sub-tab, and proves the context reached it. */
function ContextProbe() {
  const { projId } = useProjectContext();
  return <div>application documents for {projId}</div>;
}

function ShellStub({ context }: { context: ProjectContext }) {
  return <Outlet context={context} />;
}

/** The segmented control's links, by their accessible name. */
function segment(name: string) {
  return within(screen.getByRole('navigation', { name: 'Document type' })).getByRole('link', {
    name,
  });
}

function findSegment(name: string) {
  return within(screen.getByRole('navigation', { name: 'Document type' })).findByRole('link', {
    name,
  });
}

function querySegment(name: string) {
  return within(screen.getByRole('navigation', { name: 'Document type' })).queryByRole('link', {
    name,
  });
}

describe('documents page', () => {
  beforeEach(() => {
    tabSearchResponse = () => [{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to All Documents when the lists never arrive', async () => {
    // A disabled TanStack query reports `isPending`, so keying the placeholders on that alone left
    // the control shimmering for good whenever the List fetch failed.
    const withoutLists = { ...CONTEXT, lists: [] };
    requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([{ searchResults: [], meta: [] }])),
    );

    renderRouter('/p/proj-1/documents', withoutLists);

    expect(await findSegment('All Documents')).toBeInTheDocument();
    expect(document.querySelector('.document-type-filter [aria-busy="true"]')).toBeNull();
    expect(querySegment('C&E Documents')).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('holds the group as placeholders until every probe has answered', async () => {
    // Four probes resolve independently; rendering each answer as it lands makes the segments pop
    // in one at a time.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    requests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requests.push(String(input));
        await gate;
        return jsonResponse([
          { searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] },
        ]);
      }),
    );

    renderRouter();

    const group = await screen.findByRole('navigation', { name: 'Document type' });
    await waitFor(() => expect(requests).toHaveLength(4));
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();
    expect(group.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Loading document types')).toBeInTheDocument();

    release();

    expect(await findSegment('C&E Documents')).toBeInTheDocument();
    expect(within(group).getAllByRole('link')).toHaveLength(5);
    expect(group.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('always offers All Documents and hides the segments with no documents', async () => {
    renderDocuments();

    expect(await findSegment('All Documents')).toHaveAttribute('href', '/p/proj-1/documents');
    await waitFor(() =>
      expect(requests.filter((url) => url.includes('dataset=Document'))).toHaveLength(4),
    );
    expect(querySegment('Application')).not.toBeInTheDocument();
    expect(querySegment('Certificate')).not.toBeInTheDocument();
    expect(querySegment('Amendment(s)')).not.toBeInTheDocument();
    expect(querySegment('C&E Documents')).not.toBeInTheDocument();
  });

  it('asks for one document per segment, filtered by that view type and milestone ids', async () => {
    renderDocuments();

    await waitFor(() =>
      expect(requests.filter((url) => url.includes('dataset=Document'))).toHaveLength(4),
    );

    expect(requests.find((url) => url.includes('and[type]=type-app-2002'))).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=1&projectLegislation=default&sortBy=&sortBy=&populate=true' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-app-2002&and[type]=type-app-2018&and[type]=type-memo-2002&and[type]=type-memo-2018' +
        '&and[milestone]=ms-appreview&and[milestone]=ms-eac&and[milestone]=ms-eac-rev' +
        '&fuzzy=false',
    );
  });

  it('probes for compliance documents by milestone, with no empty type parameter', async () => {
    renderDocuments();

    await waitFor(() =>
      expect(requests.filter((url) => url.includes('dataset=Document'))).toHaveLength(4),
    );

    const probe = requests.find((url) => url.includes('and[milestone]=ms-ce-2002'));
    expect(probe).toContain('&and[milestone]=ms-ce-2002&and[milestone]=ms-ce-2018');
    // An empty `and[type]=` makes eagle-api answer with nothing at all, emptying the view.
    expect(probe).not.toContain('and[type]=');
  });

  it('shows the C&E segment once its search finds a document', async () => {
    tabSearchResponse = (url) =>
      url.includes('and[milestone]=ms-ce-2002')
        ? [{ searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] }]
        : [{ searchResults: [], meta: [{ searchResultsTotal: 0 }] }];

    renderDocuments();

    expect(await findSegment('C&E Documents')).toHaveAttribute(
      'href',
      '/p/proj-1/documents/compliance',
    );
    expect(querySegment('Certificate')).not.toBeInTheDocument();
  });

  it('leaves a segment hidden and logs when the search answers unusably', async () => {
    // getSearchResults turns a non-2xx into `null`, so a 502 and a document-less project are
    // indistinguishable downstream. The segment must stay hidden, and the console must say why.
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    tabSearchResponse = () => [{ meta: [] }];

    renderDocuments();

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(querySegment('Amendment(s)')).not.toBeInTheDocument();
    expect(error.mock.calls.some((call) => String(call[0]).includes('Could not determine'))).toBe(
      true,
    );
  });

  it('retries a probe that hit a bad gateway instead of caching it as "no documents"', async () => {
    // One rproxy 502 must not hide a segment for the rest of the visit: the probe throws, TanStack
    // retries, and the segment appears once the retry answers.
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    let amendmentProbes = 0;
    tabSearchResponse = (url) => {
      if (url.includes('type-amend-2002') && amendmentProbes++ === 0)
        return new Response('', { status: 502 });
      return [{ searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] }];
    };

    renderDocuments('/p/proj-1/documents', { retry: 1 });

    expect(await findSegment('Amendment(s)')).toBeInTheDocument();
    expect(amendmentProbes).toBe(2);
  });

  it('shows the settled segments while a failed probe waits to retry', async () => {
    // Production backoff is 1s/2s/4s. Holding every segment as a placeholder for that long would
    // hide All Documents behind one bad gateway.
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    tabSearchResponse = (url) =>
      url.includes('type-amend-2002')
        ? new Response('', { status: 502 })
        : [{ searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] }];

    renderDocuments('/p/proj-1/documents', { retry: 1, retryDelay: 5000 });

    expect(await findSegment('All Documents')).toBeInTheDocument();
    expect(segment('Certificate')).toBeInTheDocument();
    expect(querySegment('Amendment(s)')).not.toBeInTheDocument();
  });

  it('does not log when the search legitimately finds nothing', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    renderDocuments();

    await waitFor(() =>
      expect(requests.filter((url) => url.includes('dataset=Document'))).toHaveLength(4),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('marks only the open segment active, and passes the project context down to it', async () => {
    tabSearchResponse = () => [
      { searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] },
    ];

    renderDocuments('/p/proj-1/documents/application');

    const application = await findSegment('Application');
    expect(application).toHaveClass('active');
    expect(segment('All Documents')).not.toHaveClass('active');
    // react-router does not inherit outlet context; the sub-tab only sees it because
    // DocumentsPage passes it on.
    expect(screen.getByText('application documents for proj-1')).toBeInTheDocument();
  });

  it('keeps segment links stable when moving between document views', async () => {
    // Relative links compound: from /documents/compliance a `compliance` link would resolve to
    // /documents/compliance/compliance, and `.` would leave All Documents active everywhere.
    tabSearchResponse = () => [
      { searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] },
    ];

    renderDocuments();

    await userEvent.click(await findSegment('C&E Documents'));

    const compliance = await findSegment('C&E Documents');
    expect(compliance).toHaveAttribute('href', '/p/proj-1/documents/compliance');
    expect(compliance).toHaveClass('active');
    expect(segment('All Documents')).not.toHaveClass('active');
    expect(segment('Amendment(s)')).toHaveAttribute('href', '/p/proj-1/documents/amendments');
    expect(screen.getByText('compliance documents')).toBeInTheDocument();

    await userEvent.click(segment('All Documents'));
    expect(await screen.findByText('all documents')).toBeInTheDocument();
  });

  it('marks All Documents active only on the documents index', async () => {
    tabSearchResponse = () => [
      { searchResults: [{ _id: 'doc-1' }], meta: [{ searchResultsTotal: 1 }] },
    ];

    renderDocuments();

    const all = await findSegment('All Documents');
    expect(all).toHaveClass('active');
    expect(screen.getByText('all documents')).toBeInTheDocument();
  });
});
