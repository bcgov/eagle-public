import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { track } from 'app/analytics/analytics';
import { loadConfig } from 'app/config/config';
import { clearSelection } from 'app/state/bulk-download';
import { renderAt } from '../../../test-utils';
import { toWireFilters, yearOptions } from './search-filters';
import { UnifiedSearch } from './unified-search';

vi.mock('app/analytics/analytics', () => ({ track: vi.fn(), page: vi.fn(), reset: vi.fn() }));

const trackMock = vi.mocked(track);

const DOCUMENTS = [
  { _id: 'd1', displayName: 'Fish habitat report', datePosted: '2025-01-02T12:00:00Z', type: 'l1' },
];
/** One `List` row, so the document type cell has a name to show instead of the stored id. */
const LISTS = [{ _id: 'l1', name: 'Letter', type: 'doctype' }];
const PROJECTS = [
  {
    _id: 'p1',
    name: 'Alpha Mine',
    dateUpdated: '2025-02-03',
    region: 'Skeena',
    // Populated on this read, a bare id on others.
    currentPhaseName: { _id: 'ph1', name: 'Effects Assessment' },
  },
];

let counts: Record<string, number | null>;
/** Whether the index says it could not sort by `dateUpdated`, which it can only say when asked. */
let dropsDateSort: boolean;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function envelope(rows: unknown[], total = rows.length, meta: Record<string, unknown> = {}) {
  return json([{ searchResults: rows, meta: [{ searchResultsTotal: total, ...meta }] }]);
}

/** Every request the page makes, answered by what the URL asks for. */
function stubApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/search/counts')) return json([{ counts }]);
    if (url.includes('dataset=List')) return envelope(LISTS);
    if (url.includes('dataset=Organization')) return envelope([]);
    if (url.includes('dataset=Project')) {
      const sort = dropsDateSort && url.includes('sortBy=-dateUpdated') ? ['dateUpdated'] : [];
      return envelope(PROJECTS, 1, { dropped: { filter: [], sort } });
    }
    if (url.includes('dataset=Document')) return envelope(DOCUMENTS, 1);
    return envelope([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSearch(path: string) {
  return renderAt(path, [{ path: '/search', Component: UnifiedSearch }]);
}

function pill(name: RegExp) {
  return screen.getByRole('button', { name });
}

beforeEach(async () => {
  counts = { Project: 12, Document: 5 };
  dropsDateSort = false;
  window.__env = { logLevel: 4 };
  await loadConfig();
  clearSelection();
  trackMock.mockClear();
  stubApi();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UnifiedSearch', () => {
  it('opens on documents, which is what a bare /search has always listed', async () => {
    renderSearch('/search');

    expect(await screen.findByText('Fish habitat report')).toBeInTheDocument();
    expect(pill(/^Documents/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('leads with the breadcrumb and the title, and nothing between them', async () => {
    renderSearch('/search');

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(crumbs).toHaveTextContent('Home');
    expect(within(crumbs).getByText('Search')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
  });

  it('badges every record type before a keyword is typed', async () => {
    renderSearch('/search');

    await waitFor(() => expect(within(pill(/^Projects/)).getByText('12')).toBeInTheDocument());
    expect(within(pill(/^Documents/)).getByText('5')).toBeInTheDocument();
  });

  it('keeps the keyword and drops the filters and sort when the record type changes', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch(
      '/search?record=projects&keywords=fish&region=Skeena&sortBy=%2Bname',
    );

    await screen.findByText('Alpha Mine');
    await user.click(pill(/^Documents/));

    await waitFor(() => expect(router.state.location.search).not.toContain('record=projects'));
    const query = new URLSearchParams(router.state.location.search);
    expect(query.get('keywords')).toBe('fish');
    expect(query.get('region')).toBeNull();
    expect(query.get('sortBy')).toBeNull();
    // The field follows the URL rather than emptying itself on the way across.
    expect(screen.getByRole('searchbox')).toHaveValue('fish');
  });

  it('badges a record type with its count and leaves an unknown total bare', async () => {
    counts = { Project: 12, Document: null };
    renderSearch('/search?keywords=fish');

    await waitFor(() => expect(within(pill(/^Projects/)).getByText('12')).toBeInTheDocument());
    expect(pill(/^Documents/)).toHaveTextContent(/^Documents$/);
  });

  it('goes back to the first page when a filter changes', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents&currentPage=3');

    await screen.findByText('Fish habitat report');
    await user.click(screen.getByRole('button', { name: /more filters/i }));
    await user.click(screen.getByLabelText('Featured documents'));

    await waitFor(() => expect(router.state.location.search).toContain('isFeatured=true'));
    expect(new URLSearchParams(router.state.location.search).get('currentPage')).toBeNull();
  });

  it('copies the current view and says so for two seconds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderSearch('/search?record=documents&keywords=fish');
    await screen.findByText('Fish habitat report');

    vi.useFakeTimers();
    // fireEvent, not userEvent: its key-by-key timing fights the fake clock this test owns.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link to this view/i }));
    });

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole('button', { name: /link copied/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: /copy link to this view/i })).toBeInTheDocument();
  });

  it('reports one search event per settled search', async () => {
    const user = userEvent.setup();
    renderSearch('/search?record=documents&keywords=fish');
    await screen.findByText('Fish habitat report');

    expect(trackMock.mock.calls.map(([event]) => event)).toEqual(['Search Executed']);
    expect(trackMock.mock.calls[0][1]).toMatchObject({ search_term: 'fish', record: 'documents' });

    await user.click(screen.getByRole('button', { name: /more filters/i }));
    await user.click(screen.getByLabelText('Featured documents'));

    await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(2));
    expect(trackMock.mock.calls[1][1]).toMatchObject({ filter_count: 1 });
  });

  it('settles on name order once the index says it dropped the date sort', async () => {
    // demi-search groups `dropped` by what it applied it to, and only reports the sort it was
    // asked for: an answer read as "date works again" would send the page back and forth forever.
    dropsDateSort = true;
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&keywords=fish');

    const projectSorts = () =>
      fetchMock.mock.calls.map(String).filter((url) => url.includes('dataset=Project&'));
    await waitFor(() =>
      // Scoped to the projects search: the organizations read always sorts by name.
      expect(projectSorts().some((url) => url.includes('sortBy=+name'))).toBe(true),
    );
    // Asked for the date sort once, then not again: the fallback is one way.
    expect(projectSorts().filter((url) => url.includes('sortBy=-dateUpdated'))).toHaveLength(1);
  });

  it('names a populated record in a cell rather than printing the object', async () => {
    renderSearch('/search?record=projects');

    const row = (await screen.findByText('Alpha Mine')).closest('tr');
    expect(within(row as HTMLElement).getByText('Effects Assessment')).toBeInTheDocument();
  });

  it('reads a date cell as the day the record carries, not the stored timestamp', async () => {
    renderSearch('/search?record=documents');

    const row = (await screen.findByText('Fish habitat report')).closest('tr');
    expect(within(row as HTMLElement).getByText('2025-01-02')).toBeInTheDocument();
  });

  it('shows the name of a coded value rather than the id the row stores', async () => {
    renderSearch('/search?record=documents');

    // Scoped to the row: the filter control above it offers the same word as an option.
    const row = (await screen.findByText('Fish habitat report')).closest('tr');
    expect(within(row as HTMLElement).getByText('Letter')).toBeInTheDocument();
  });

  it('says the search is unavailable when the backend fails, rather than that nothing matched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/search/counts')) return json([{ counts }]);
        if (url.includes('dataset=Project')) return new Response('', { status: 500 });
        return envelope([]);
      }),
    );

    renderSearch('/search?record=projects&keywords=coalmine');

    expect(await screen.findByText('Search is unavailable right now')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing in projects matches/)).not.toBeInTheDocument();
  });

  it('reports no search event for a search the backend never answered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('dataset=Project')) return new Response('', { status: 500 });
        return envelope([]);
      }),
    );

    renderSearch('/search?record=projects&keywords=coalmine');

    await screen.findByText('Search is unavailable right now');
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('searches once the typing has settled, not on every keystroke', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const { router } = renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    await user.type(screen.getByRole('searchbox'), 'coal');

    await waitFor(() => expect(router.state.location.search).toContain('keywords=coal'));
    const typedSearches = () =>
      fetchMock.mock.calls
        .map(String)
        .filter((url) => url.includes('dataset=Project&') && url.includes('keywords=co'));

    // One request for the settled word; `co` and `coa` never left the page.
    await waitFor(() => expect(typedSearches()).toHaveLength(1));
    expect(typedSearches()[0]).toContain('keywords=coal');
  });

  it('offers no results and no request for a record type that has no config yet', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&keywords=fish');
    await screen.findByText('Alpha Mine');

    await user.click(pill(/^Activities & updates/));

    expect(await screen.findByText('Not available yet')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.map(String).filter((url) => url.includes('RecentActivity')),
    ).toEqual([]);
  });
});

describe('a year chosen in a date column', () => {
  it('is sent as the range that year covers', () => {
    expect(toWireFilters({ datePosted: '2021', type: 'l1' }, ['datePosted'])).toEqual({
      type: 'l1',
      datePostedStart: '2021-01-01',
      datePostedEnd: '2021-12-31',
    });
  });

  it('leaves a bound the advanced panel has already set', () => {
    expect(
      toWireFilters({ dateUpdated: '2021', dateUpdatedStart: '2021-06-01' }, ['dateUpdated']),
    ).toEqual({ dateUpdatedStart: '2021-06-01', dateUpdatedEnd: '2021-12-31' });
  });

  it('rides as it is written when the column is not a year column', () => {
    expect(toWireFilters({ datePosted: '2021' })).toEqual({ datePosted: '2021' });
  });

  it('offers the years the results carry, newest first, and the year in force', () => {
    const rows = [
      { datePosted: '2021-11-02T00:00:00Z' },
      { datePosted: '2019-03-04' },
      { datePosted: '2021-01-09' },
      { datePosted: '' },
    ];

    expect(yearOptions(rows, 'datePosted', '2015')).toEqual([
      { value: '2021', label: '2021' },
      { value: '2019', label: '2019' },
      { value: '2015', label: '2015' },
    ]);
  });
});
