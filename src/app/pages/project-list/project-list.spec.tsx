import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { clearValue } from 'app/api/org';
import { ProjectList } from './project-list';

const PROJECTS = [
  { _id: 'p1', name: 'Alpha Mine', type: 'Mines', region: 'Skeena' },
  { _id: 'p2', name: 'Beta Dam', type: 'Energy', region: 'Cariboo' }
];

const LISTS = [
  { _id: 'd1', name: 'Certificate Issued', type: 'eaDecisions' },
  { _id: 'i1', name: 'Coordinated', type: 'ceaaInvolvements' },
  { _id: 'ph1', name: 'Pre-Application', type: 'projectPhase' }
];

const ORGS = [{ _id: 'o1', name: 'Acme Resources' }];

function searchResponse(results: unknown[], total: number) {
  return new Response(JSON.stringify([{ searchResults: results, meta: [{ searchResultsTotal: total }] }]), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

/** Every search request URL the app issued, oldest first. */
let requests: string[];

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.includes('dataset=List')) return searchResponse(LISTS, LISTS.length);
    if (url.includes('/organization')) {
      return new Response(JSON.stringify(ORGS), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('dataset=Project')) return searchResponse(PROJECTS, 42);
    return searchResponse([], 0);
  });
}

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/projects-list', Component: ProjectList }], {
    initialEntries: [path]
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return router;
}

/** The most recent Project search request. */
function lastProjectRequest(): string {
  return requests.filter(url => url.includes('dataset=Project')).at(-1)!;
}

describe('projects list', () => {
  beforeEach(() => {
    requests = [];
    clearValue();
    vi.stubGlobal('fetch', mockFetch());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests page 1 with the default sort and renders the rows', async () => {
    renderAt('/projects-list');

    expect(await screen.findByText('Alpha Mine')).toBeInTheDocument();
    expect(screen.getByText('Beta Dam')).toBeInTheDocument();
    expect(lastProjectRequest()).toBe(
      '/api/search?dataset=Project&pageNum=0&pageSize=10&projectLegislation=default&sortBy=+name&sortBy=&populate=true&fuzzy=false'
    );
  });

  it('reads currentPage, pageSize and sortBy off the URL, sending a 0-based pageNum', async () => {
    renderAt('/projects-list?currentPage=3&pageSize=25&sortBy=-region');

    await screen.findByText('Alpha Mine');
    expect(lastProjectRequest()).toBe(
      '/api/search?dataset=Project&pageNum=2&pageSize=25&projectLegislation=default&sortBy=-region&sortBy=&populate=true&fuzzy=false'
    );
  });

  it('restores a + sort that arrived form-decoded from an Angular deep link', async () => {
    renderAt('/projects-list?sortBy=%20name');

    await screen.findByText('Alpha Mine');
    expect(lastProjectRequest()).toContain('&sortBy=+name');
  });

  it('writes currentPage to the URL and refetches on a page change', async () => {
    const router = renderAt('/projects-list');
    await screen.findByText('Alpha Mine');

    await userEvent.click(screen.getAllByRole('button', { name: 'Go to page 2' })[0]);

    await waitFor(() => expect(router.state.location.search).toContain('currentPage=2'));
    await waitFor(() => expect(lastProjectRequest()).toContain('&pageNum=1&'));
  });

  it('writes sortBy to the URL and the request, and returns to page 1', async () => {
    const router = renderAt('/projects-list?currentPage=4');
    await screen.findByText('Alpha Mine');

    await userEvent.click(screen.getByRole('columnheader', { name: /Column header Region/ }));

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('sortBy')).toBe('+region');
      expect(params.get('currentPage')).toBe('1');
    });
    await waitFor(() => expect(lastProjectRequest()).toContain('&sortBy=+region'));
  });

  it('flips the sort direction when the same column is clicked twice', async () => {
    const router = renderAt('/projects-list');
    await screen.findByText('Alpha Mine');

    await userEvent.click(screen.getByRole('columnheader', { name: /Column header Name/ }));

    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe('-name'));
  });

  it('writes a page size change to the URL and returns to page 1', async () => {
    const router = renderAt('/projects-list?currentPage=3');
    await screen.findByText('Alpha Mine');

    // The picker renders above and below the table; either drives the same URL.
    await userEvent.click(screen.getAllByTitle('Show 25 records per page')[0]);

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('pageSize')).toBe('25');
      expect(params.get('currentPage')).toBe('1');
    });
  });

  it('turns a keyword search into keywords + a -score sort, back on page 1', async () => {
    const router = renderAt('/projects-list?currentPage=5');
    await screen.findByText('Alpha Mine');

    await userEvent.type(screen.getByPlaceholderText('Type keyword to search'), 'copper');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('keywords')).toBe('copper');
      expect(params.get('sortBy')).toBe('-score');
      expect(params.get('currentPage')).toBe('1');
    });
    await waitFor(() => expect(lastProjectRequest()).toContain('&keywords=copper&'));
  });

  it('sends a filter from the URL as an and[] param', async () => {
    renderAt('/projects-list?type=id-mines,id-other&region=skeena');

    await screen.findByText('Alpha Mine');
    const request = lastProjectRequest();
    expect(request).toContain('&and[type]=id-mines&and[type]=id-other');
    expect(request).toContain('&and[region]=skeena');
  });

  it('writes an applied filter to the URL and the request', async () => {
    const router = renderAt('/projects-list');
    await screen.findByText('Alpha Mine');

    await userEvent.click(screen.getByRole('button', { name: /Open Advanced Filters/ }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Type EA Decision' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Certificate Issued' }));

    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('eacDecision')).toBe('d1'));
    await waitFor(() => expect(lastProjectRequest()).toContain('&and[eacDecision]=d1'));
  });

  it('opens the advanced filter panel when the URL already carries a filter', async () => {
    renderAt('/projects-list?region=skeena');

    expect(await screen.findByRole('button', { name: /Close Advanced Filters/ })).toBeInTheDocument();
  });
});
