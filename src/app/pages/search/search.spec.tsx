import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../../test-utils';
import { loadConfig } from 'app/config/config';
import { Search } from './search';

const DOCUMENTS = [
  {
    _id: 'doc1',
    displayName: 'Fish and Fish Habitat.pdf',
    datePosted: '2026-05-04T00:00:00.000Z',
    type: 't1',
    milestone: 'm1',
    project: { _id: 'p1', name: 'Alpha Mine' },
  },
];

const LISTS = [
  { _id: 'm1', name: 'Amendment', type: 'label', legislation: 2002 },
  { _id: 'a1', name: 'Proponent', type: 'author', legislation: 2018 },
  { _id: 't1', name: 'Letter', type: 'doctype', legislation: 2002 },
  { _id: 'p1', name: 'Pre-Application', type: 'projectPhase', legislation: 2018 },
];

let requests: string[];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderSearch(path: string) {
  return renderAt(path, [{ path: '/search', Component: Search }]).router;
}

/** The most recent Document search request. */
function lastDocumentRequest(): string {
  return requests.filter((url) => url.includes('dataset=Document')).at(-1)!;
}

describe('document search', () => {
  const originalEnv = window.__env;

  beforeEach(async () => {
    requests = [];
    window.__env = { logLevel: 4, CONTENT_SEARCH: true };
    await loadConfig();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requests.push(url);
        if (url.includes('dataset=List')) {
          return jsonResponse([
            { searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] },
          ]);
        }
        if (url.includes('dataset=Document')) {
          return jsonResponse([{ searchResults: DOCUMENTS, meta: [{ searchResultsTotal: 42 }] }]);
        }
        return jsonResponse([{ searchResults: [], meta: [] }]);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.__env = originalEnv;
  });

  it('requests page 1 sorted by newest and renders the row', async () => {
    renderSearch('/search');

    expect(await screen.findByText('Fish and Fish Habitat.pdf')).toBeInTheDocument();
    expect(lastDocumentRequest()).toBe(
      '/api/search?dataset=Document&pageNum=0&pageSize=10&projectLegislation=default&sortBy=-datePosted&sortBy=&populate=true&fuzzy=false',
    );
  });

  it('resolves type and milestone ids against the List collection', async () => {
    renderSearch('/search');

    expect(await screen.findByText('Letter')).toBeInTheDocument();
    expect(screen.getByText('Amendment')).toBeInTheDocument();
  });

  it('shows both tabs, linking Document Content to /search/content', async () => {
    renderSearch('/search');

    await screen.findByText('Fish and Fish Habitat.pdf');
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('tab', { name: 'Document Content' })).toHaveAttribute(
      'href',
      '/search/content',
    );
  });

  it('restores currentPage, pageSize and sortBy from a deep link', async () => {
    renderSearch('/search?currentPage=3&pageSize=25&sortBy=%20displayName');

    await screen.findByText('Fish and Fish Habitat.pdf');
    expect(lastDocumentRequest()).toBe(
      '/api/search?dataset=Document&pageNum=2&pageSize=25&projectLegislation=default&sortBy=+displayName&sortBy=&populate=true&fuzzy=false',
    );
  });

  it('sends every filter from the URL as an and[] param, in filter-list order', async () => {
    renderSearch('/search?milestone=m1,m2&documentAuthorType=a1&type=t1&projectPhase=p1');

    await screen.findByText('Fish and Fish Habitat.pdf');
    expect(lastDocumentRequest()).toContain(
      '&and[milestone]=m1&and[milestone]=m2&and[documentAuthorType]=a1&and[type]=t1&and[projectPhase]=p1',
    );
  });

  it('sends the date range as and[datePostedStart] and and[datePostedEnd]', async () => {
    renderSearch(
      '/search?datePostedStart=2020-01-01T00:00:00.000Z&datePostedEnd=2021-12-31T00:00:00.000Z',
    );

    await screen.findByText('Fish and Fish Habitat.pdf');
    const request = lastDocumentRequest();
    expect(request).toContain('&and[datePostedStart]=2020-01-01T00:00:00.000Z');
    expect(request).toContain('&and[datePostedEnd]=2021-12-31T00:00:00.000Z');
  });

  it('shows the date range the URL carries in the two date inputs', async () => {
    renderSearch(
      '/search?datePostedStart=2020-01-01T00:00:00.000Z&datePostedEnd=2021-12-31T00:00:00.000Z',
    );

    await screen.findByText('Fish and Fish Habitat.pdf');
    const inputs = screen.getAllByLabelText('Date input field') as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(['2020-01-01', '2021-12-31']);
  });

  it('opens the advanced filter panel when the URL already carries a filter', async () => {
    renderSearch('/search?milestone=m1');

    expect(
      await screen.findByRole('button', { name: /Close Advanced Filters/ }),
    ).toBeInTheDocument();
  });

  it('writes a chosen filter to the URL and the request', async () => {
    const router = renderSearch('/search');
    await screen.findByText('Fish and Fish Habitat.pdf');

    await userEvent.click(screen.getByRole('button', { name: /Open Advanced Filters/ }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Type Document Type' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Letter' }));

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('type')).toBe('t1'),
    );
    await waitFor(() => expect(lastDocumentRequest()).toContain('&and[type]=t1'));
  });

  it('writes a date range chosen in the panel to the URL as an ISO timestamp', async () => {
    const router = renderSearch('/search');
    await screen.findByText('Fish and Fish Habitat.pdf');

    await userEvent.click(screen.getByRole('button', { name: /Open Advanced Filters/ }));
    const startDate = document.getElementById('datePostedStart') as HTMLInputElement;
    await userEvent.type(startDate, '2020-01-01');

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('datePostedStart')).toBe(
        '2020-01-01T00:00:00.000Z',
      ),
    );
    await waitFor(() =>
      expect(lastDocumentRequest()).toContain('&and[datePostedStart]=2020-01-01T00:00:00.000Z'),
    );
  });

  it('turns a keyword search into keywords + a -score sort, back on page 1', async () => {
    const router = renderSearch('/search?currentPage=5');
    await screen.findByText('Fish and Fish Habitat.pdf');

    await userEvent.type(screen.getByPlaceholderText('Type keyword to search'), 'caribou');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('keywords')).toBe('caribou');
      expect(params.get('sortBy')).toBe('-score');
      expect(params.get('currentPage')).toBe('1');
    });
    await waitFor(() => expect(lastDocumentRequest()).toContain('&keywords=caribou&'));
  });

  it('writes a column sort to the URL and the request, returning to page 1', async () => {
    const router = renderSearch('/search?currentPage=4');
    await screen.findByText('Fish and Fish Habitat.pdf');

    await userEvent.click(
      screen.getByRole('columnheader', { name: /Column header Document Name/ }),
    );

    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('sortBy')).toBe('+displayName');
      expect(params.get('currentPage')).toBe('1');
    });
    await waitFor(() => expect(lastDocumentRequest()).toContain('&sortBy=+displayName'));
  });

  it('writes a page change to the URL and refetches with a 0-based pageNum', async () => {
    const router = renderSearch('/search');
    await screen.findByText('Fish and Fish Habitat.pdf');

    await userEvent.click(screen.getAllByRole('button', { name: 'Go to page 2' })[0]!);

    await waitFor(() => expect(router.state.location.search).toContain('currentPage=2'));
    await waitFor(() => expect(lastDocumentRequest()).toContain('&pageNum=1&'));
  });
});
