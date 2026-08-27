import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { Amendments } from './amendments';
import { Application } from './application';
import { Certificates } from './certificates';
import { DocumentsTab } from './documents-tab';

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
  { _id: 'ph-amend-2018', name: 'Post Decision - Amendment', legislation: 2018, type: 'projectPhase' },

  { _id: 'author-eao', name: 'EAO', legislation: 2018, type: 'author' }
];

const DOCUMENTS = [
  {
    _id: 'doc-1',
    displayName: 'Cedar Quarry Certificate',
    documentFileName: 'cert.pdf',
    datePosted: '2026-05-01T00:00:00.000Z',
    type: 'type-cert-2018',
    milestone: 'ms-cert-2002',
    projectPhase: 'ph-amend-2018',
    isFeatured: true
  }
];

let requests: string[];
let total = 1;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function renderTab(Tab: () => React.ReactNode, path: string) {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('dataset=List')) {
        return jsonResponse([{ searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] }]);
      }
      return jsonResponse([
        { searchResults: total > 0 ? DOCUMENTS : [], meta: [{ searchResultsTotal: total }] }
      ]);
    })
  );

  const router = createMemoryRouter([{ path: '/p/:projId/:tab', element: <Tab /> }], { initialEntries: [path] });

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return router;
}

function documentRequests(): string[] {
  return requests.filter(url => url.includes('dataset=Document'));
}

// The tabs read their project id and lists off the shell's outlet context; the tests render each
// tab on its own, so the context comes from a stub instead.
vi.mock('./project-context', async importOriginal => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({ project: null, projId: 'proj-1', lists: LISTS })
  };
});

describe('project document tabs', () => {
  beforeEach(() => {
    requests = [];
    total = 1;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('certificates asks for certificate documents, sorted by date then name', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-datePosted&sortBy=+displayName&populate=false' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-cert-2002&and[type]=type-cert-2018&and[type]=type-order-2002&and[type]=type-order-2018' +
        '&and[type]=type-dm-2002&and[type]=type-dm-2018' +
        '&and[milestone]=ms-cert-2002&and[milestone]=ms-certdec-2018&and[milestone]=ms-decision-2002' +
        '&and[milestone]=ms-certext-2002&and[milestone]=ms-certext-2018&and[milestone]=ms-transfer-2018' +
        '&fuzzy=false'
    );
  });

  it('certificates renders no filter panel', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.queryByRole('button', { name: /Advanced Filters/ })).not.toBeInTheDocument();
  });

  it('certificates renders the document row without a featured star column', async () => {
    renderTab(Certificates, '/p/proj-1/certificates');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.getByRole('cell', { name: 'Cedar Quarry Certificate' })).toHaveClass('col-4');
    expect(screen.queryByText('star')).not.toBeInTheDocument();
    // Ids are resolved to list names for display.
    expect(screen.getByRole('cell', { name: 'Certificate Package' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Certificate' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Post Decision - Amendment' })).toBeInTheDocument();
  });

  it('certificates shows its own empty message', async () => {
    total = 0;
    renderTab(Certificates, '/p/proj-1/certificates');

    expect(
      await screen.findByText('There are no certificate documents associated with this project.')
    ).toBeInTheDocument();
  });

  it('amendments asks for amendment documents and offers the filter panel', async () => {
    renderTab(Amendments, '/p/proj-1/amendments');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/api/search?dataset=Document&project=proj-1&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-datePosted&sortBy=+displayName&populate=false' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-amend-2002&and[type]=type-amend-2018&and[type]=type-req-2002&and[type]=type-dm-2002' +
        '&and[type]=type-dm-2018&and[type]=type-tt-2002&and[type]=type-tt-2018' +
        '&and[milestone]=ms-amend-2002&and[milestone]=ms-amend-2018' +
        '&and[projectPhase]=ph-amend-2002&and[projectPhase]=ph-amend-2018' +
        '&fuzzy=false'
    );
    expect(screen.getByRole('button', { name: /Open Advanced Filters/ })).toBeInTheDocument();
  });

  it('application carries the URL keywords and filters into the request', async () => {
    renderTab(Application, '/p/proj-1/application?keywords=slope&milestone=ms-eac&sortBy=-score');

    await screen.findByText('Cedar Quarry Certificate');
    expect(documentRequests().at(-1)).toBe(
      '/api/search?dataset=Document&project=proj-1&keywords=slope&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-score&sortBy=+displayName&populate=false' +
        '&and[documentSource]=PROJECT' +
        '&and[type]=type-app-2002&and[type]=type-app-2018&and[type]=type-memo-2002&and[type]=type-memo-2018' +
        '&and[milestone]=ms-appreview&and[milestone]=ms-eac&and[milestone]=ms-eac-rev' +
        '&and[milestone]=ms-eac' +
        '&fuzzy=false'
    );
  });

  it('application opens the filter panel when the URL already carries a filter', async () => {
    renderTab(Application, '/p/proj-1/application?projectPhase=ph-amend-2018');

    await screen.findByText('Cedar Quarry Certificate');
    expect(screen.getByRole('button', { name: /Close Advanced Filters/ })).toBeInTheDocument();
  });

  it('documents asks for every project document, populated, with a featured star column', async () => {
    renderTab(DocumentsTab, '/p/proj-1/documents');

    expect(await screen.findByText('Cedar Quarry Certificate')).toBeInTheDocument();
    expect(documentRequests().at(-1)).toBe(
      '/api/search?dataset=Document&pageNum=0&pageSize=10&projectLegislation=default' +
        '&sortBy=-datePosted&sortBy=+displayName&populate=true' +
        '&and[project]=proj-1&fuzzy=false'
    );
    expect(screen.getByRole('cell', { name: 'Cedar Quarry Certificate' })).toHaveClass('col-3');
    expect(screen.getByText('star')).toBeInTheDocument();
  });

  it('documents restarts at page one when a column is sorted', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents?currentPage=3');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(screen.getByRole('columnheader', { name: /Date/ }));

    await waitFor(() => expect(router.state.location.search).toContain('currentPage=1'));
    expect(router.state.location.search).toContain('sortBy=%2BdatePosted');
  });

  it('sorting a column that was not sorted starts ascending', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.click(screen.getByRole('columnheader', { name: /Name/ }));

    await waitFor(() => expect(router.state.location.search).toContain('sortBy=%2BdisplayName'));
  });

  it('documents keeps the chosen page size when a keyword search runs', async () => {
    const router = renderTab(DocumentsTab, '/p/proj-1/documents?pageSize=50');

    await screen.findByText('Cedar Quarry Certificate');
    await userEvent.type(screen.getByPlaceholderText('Type keyword to search'), 'slope{Enter}');

    await waitFor(() => expect(router.state.location.search).toContain('keywords=slope'));
    expect(router.state.location.search).toContain('pageSize=50');
    expect(router.state.location.search).toContain('sortBy=-score');
  });
});
