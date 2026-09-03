import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { loadConfig } from 'app/config/config';
import { ContentSearch } from './content-search';

const CHUNKS = [
  {
    _id: 'doc1',
    documentName: 'Fish and Fish Habitat.pdf',
    documentType: 'Letter',
    matchCount: 3,
    snippets: ['the <mark>fish</mark> habitat'],
    project: { _id: 'p1', name: 'Alpha Mine' },
  },
];

let requests: string[];
let total: number;
let results: unknown[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/search/content', Component: ContentSearch }], {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

async function configure(contentSearch: boolean): Promise<void> {
  window.__env = { logLevel: 4, CONTENT_SEARCH: contentSearch };
  await loadConfig();
}

/**
 * What this tab asks the API for. The filter controls were removed because the chunk index cannot
 * answer them for every value, so the request must carry no filter keys — a regression here is
 * silent, since the API drops what it cannot use and answers 200 with an unfiltered corpus.
 */
describe('content search', () => {
  const originalEnv = window.__env;

  beforeEach(async () => {
    requests = [];
    total = 120;
    results = CHUNKS;
    await configure(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requests.push(String(input));
        return jsonResponse([{ searchResults: results, meta: [{ searchResultsTotal: total }] }]);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.__env = originalEnv;
  });

  it('searches the chunk index by relevance and renders the card', async () => {
    renderAt('/search/content?keywords=pipeline');

    expect(await screen.findByText('Fish and Fish Habitat.pdf')).toBeInTheDocument();
    expect(requests.at(-1)).toBe(
      '/api/search?dataset=DocumentChunk&keywords=pipeline&pageNum=0&pageSize=10&projectLegislation=default&sortBy=-score&sortBy=&populate=true&fuzzy=false',
    );
  });

  it('sends no filter keys, even when the URL still carries them', async () => {
    // A stale link or a bookmark from before the controls were removed still carries these. They
    // must not be forwarded: `type` and the date range are dropped by the API unconditionally, and
    // `milestone` is dropped for the highest-volume values, so a forwarded key comes back as the
    // whole corpus wearing the label of a filtered result.
    renderAt('/search/content?keywords=pipeline&milestone=m1&type=t1&datePostedStart=2020-01-01');

    await screen.findByText('Fish and Fish Habitat.pdf');
    expect(requests.at(-1)).not.toContain('and[');
  });

  it('restores currentPage and pageSize from a deep link', async () => {
    renderAt('/search/content?keywords=pipeline&currentPage=3&pageSize=25');

    await screen.findByText('Fish and Fish Habitat.pdf');
    expect(requests.at(-1)).toContain('&pageNum=2&pageSize=25&');
    expect(await screen.findByText(/page 3/)).toBeInTheDocument();
  });

  it('shows both tabs when content search is enabled', async () => {
    renderAt('/search/content');

    expect(await screen.findByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(screen.getByRole('tab', { name: 'Document Content' })).toBeInTheDocument();
  });

  it('hides its own tab bar when content search is disabled', async () => {
    // Reachable only by a stale link once the flag is off, and the tab must not advertise itself.
    await configure(false);
    renderAt('/search/content');

    await screen.findByText('Fish and Fish Habitat.pdf');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('writes a keyword search to the URL and refetches, back on page 1', async () => {
    const router = renderAt('/search/content?keywords=pipeline&currentPage=4');
    await screen.findByText('Fish and Fish Habitat.pdf');

    const box = screen.getByPlaceholderText('Type keyword to search');
    await userEvent.clear(box);
    await userEvent.type(box, 'caribou');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('keywords')).toBe('caribou');
      expect(params.get('currentPage')).toBe('1');
    });
    await waitFor(() => expect(requests.at(-1)).toContain('&keywords=caribou&'));
  });

  it('pages through the passage window, keeping the keyword', async () => {
    const router = renderAt('/search/content?keywords=pipeline');
    await screen.findByText('Fish and Fish Habitat.pdf');

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('currentPage')).toBe('2'),
    );
    await waitFor(() => expect(requests.at(-1)).toContain('&keywords=pipeline&pageNum=1&'));
  });

  it('says nothing matched rather than leaving the previous results on screen', async () => {
    results = [];
    total = 0;
    renderAt('/search/content?keywords=zzzz');

    expect(await screen.findByText(/No documents contain that text/)).toBeInTheDocument();
  });
});
