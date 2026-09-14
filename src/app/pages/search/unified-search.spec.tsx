import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { track } from 'app/analytics/analytics';
import { loadConfig } from 'app/config/config';
import { clearSelection } from 'app/state/bulk-download';
import { renderAt } from '../../../test-utils';
import { UnifiedSearch } from './unified-search';

vi.mock('app/analytics/analytics', () => ({ track: vi.fn(), page: vi.fn(), reset: vi.fn() }));

const trackMock = vi.mocked(track);

const DOCUMENTS = [
  {
    _id: 'd1',
    displayName: 'Fish habitat report',
    datePosted: '2025-01-02T12:00:00Z',
    type: 'l1',
    documentAuthorType: 'a1',
  },
];
/** `List` rows, so the coded cells have a name to show instead of the stored id. */
const LISTS = [
  { _id: 'l1', name: 'Letter', type: 'doctype' },
  { _id: 'a1', name: 'EAO', type: 'author' },
];

/** An author id in no `List` row, which is what the test backend returns for some documents. */
const ORPHAN_ID = '6a61123ff0c29b9e36505fd7';

/** What `dataset=Document` answers; a test that needs other cells puts its own rows here. */
let documents: Record<string, unknown>[];
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

const ACTIVITIES = [
  {
    _id: 'u1',
    headline: 'Amendment application accepted for review',
    // Stored as HTML, which the row reads as words.
    content: '<p>The office accepted the amendment&nbsp;application.</p>',
    dateAdded: '2026-02-18',
    type: 'News',
    project: { _id: 'p1', name: 'Cedar LNG' },
    documentUrl: '/api/document/d1/fetch/Amendment%20Order.pdf',
  },
];

const NOTIFICATIONS = [
  {
    _id: 'n1',
    name: 'Bear Creek Aggregate',
    type: 'Mines',
    region: 'Cariboo',
    pcp: 'open',
    decision: 'In Progress',
    description: 'Expansion of an existing sand and gravel operation.',
  },
];

let counts: Record<string, number | null>;
/** Whether the index says it could not sort by `dateUpdated`, which it can only say when asked. */
let dropsDateSort: boolean;
/** Whether the activities index says it carries no `documentUrl`, which it only says when asked. */
let dropsAttachmentFilter: boolean;

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
    // Ahead of the Project leg: `dataset=ProjectNotification` starts with the same word.
    if (url.includes('dataset=ProjectNotification')) return envelope(NOTIFICATIONS);
    if (url.includes('dataset=Project')) {
      const sort = dropsDateSort && url.includes('sortBy=-dateUpdated') ? ['dateUpdated'] : [];
      return envelope(PROJECTS, 1, { dropped: { filter: [], sort } });
    }
    if (url.includes('dataset=Document')) return envelope(documents, documents.length);
    if (url.includes('dataset=RecentActivity')) {
      const filter =
        dropsAttachmentFilter && url.includes('and[documentUrl]') ? ['documentUrl'] : [];
      return envelope(ACTIVITIES, 1, { dropped: { filter, sort: [] } });
    }
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

/** Turns eagle-notify on for one test, the way a deployed environment's config does. */
async function withNotifyApi(): Promise<void> {
  window.__env = { ...window.__env, NOTIFY_API: 'https://notify.example' };
  await loadConfig();
}

/** The cell a row shows under a named heading, which is what a reader reads down the column. */
function cellUnder(row: HTMLElement, heading: string): HTMLElement {
  const index = screen
    .getAllByRole('columnheader')
    .findIndex((cell) => (cell.textContent ?? '').startsWith(heading));
  return within(row).getAllByRole('cell')[index];
}

beforeEach(async () => {
  counts = { Project: 12, Document: 5 };
  dropsDateSort = false;
  dropsAttachmentFilter = false;
  documents = DOCUMENTS;
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

  it('sends a name typed in the first filter cell once typing stops, and chips it', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents');
    await screen.findByText('Fish habitat report');

    await user.type(screen.getByLabelText('Filter by Name'), 'habitat');

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('nameContains')).toBe('habitat'),
    );
    const chip = await screen.findByRole('button', { name: 'Remove Name habitat' });
    expect(chip).toHaveTextContent('Name: habitat');
  });

  it('asks the index for the typed name under and[nameContains]', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderSearch('/search?record=documents');
    await screen.findByText('Fish habitat report');

    await user.type(screen.getByLabelText('Filter by Name'), 'habitat');

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.map(String).some((url) => url.includes('and[nameContains]=habitat')),
      ).toBe(true),
    );
  });

  it('chips a name carrying a comma as the one name that was typed', async () => {
    const fetchMock = stubApi();
    // The URL layer reads a comma as several picks, so the page has to put this name back together.
    renderSearch('/search?record=documents&nameContains=a,b');
    await screen.findByText('Fish habitat report');

    const chip = screen.getByRole('button', { name: 'Remove Name a,b' });
    expect(chip).toHaveTextContent('Name: a,b');
    // And it reaches the index as one filter: percent-encoded, so `and[]` does not split it again.
    const asked = fetchMock.mock.calls.map(String).filter((url) => url.includes('nameContains'));
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((url) => url.includes('and[nameContains]=a%2Cb'))).toBe(true);
  });

  it('drops the name filter when its chip is cleared', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents&nameContains=habitat');
    await screen.findByText('Fish habitat report');
    expect(screen.getByLabelText('Filter by Name')).toHaveValue('habitat');

    await user.click(screen.getByRole('button', { name: 'Remove Name habitat' }));

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('nameContains')).toBeNull(),
    );
    expect(screen.getByLabelText('Filter by Name')).toHaveValue('');
  });

  it('clears the name filter along with everything else', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents&keywords=fish&nameContains=habitat');
    await screen.findByText('Fish habitat report');

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    /* The keyword field settles on its own beat, so the keyword leaves the URL a moment after
       the filters do rather than in the same write. */
    await waitFor(() => {
      expect(router.state.location.search).not.toContain('nameContains');
      expect(router.state.location.search).not.toContain('keywords');
    });
  });

  it('leaves the name filter behind when the record type changes', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents&nameContains=habitat');
    await screen.findByText('Fish habitat report');

    await user.click(pill(/^Projects/));

    await waitFor(() => expect(router.state.location.search).toContain('record=projects'));
    expect(router.state.location.search).not.toContain('nameContains');
  });

  it('names the projects tab cell after the project column', async () => {
    renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    const box = screen.getByLabelText('Filter by Project');
    expect(box).toHaveAttribute('placeholder', 'Project');
  });

  it('names a coded cell from the List it was looked up in', async () => {
    renderSearch('/search?record=documents');

    const row = (await screen.findByText('Fish habitat report')).closest('tr') as HTMLElement;
    expect(cellUnder(row, 'Author')).toHaveTextContent('EAO');
  });

  it('empties a cell rather than printing an id the List has no name for', async () => {
    // Some documents on the test backend carry an author id the List collection has no row for.
    documents = [
      { ...DOCUMENTS[0], _id: 'd2', displayName: 'Orphan', documentAuthorType: ORPHAN_ID },
    ];
    renderSearch('/search?record=documents');

    const row = (await screen.findByText('Orphan')).closest('tr') as HTMLElement;
    expect(cellUnder(row, 'Author').textContent).toBe('');
    expect(row).not.toHaveTextContent(ORPHAN_ID);
  });

  it('still shows a value the List does not know when it is words rather than an id', async () => {
    documents = [
      { ...DOCUMENTS[0], _id: 'd3', displayName: 'Ministerial', documentAuthorType: 'Minister' },
    ];
    renderSearch('/search?record=documents');

    const row = (await screen.findByText('Ministerial')).closest('tr') as HTMLElement;
    expect(cellUnder(row, 'Author')).toHaveTextContent('Minister');
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

  it('lists updates as rows carrying their project and their file', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderSearch('/search');
    await screen.findByText('Fish habitat report');

    await user.click(pill(/^Activities & updates/));

    expect(
      await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline }),
    ).toBeInTheDocument();
    expect(screen.getByText('The office accepted the amendment application.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cedar LNG' })).toHaveAttribute('href', '/p/p1');
    expect(screen.getByRole('link', { name: 'Amendment Order.pdf' })).toHaveAttribute(
      'href',
      ACTIVITIES[0].documentUrl,
    );

    const asked = fetchMock.mock.calls.map(String).filter((url) => url.includes('RecentActivity&'));
    expect(asked.at(-1)).toContain('sortBy=-dateAdded');
  });

  it('drops the attachments filter once the index says it has no documentUrl', async () => {
    const user = userEvent.setup();
    dropsAttachmentFilter = true;
    const { router } = renderSearch('/search?record=activities');
    await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline });

    await user.click(screen.getByRole('button', { name: /More filters/ }));
    await user.click(screen.getByLabelText('Documents attached'));

    // The control cannot narrow anything, so it goes, and its value goes out of the URL with it.
    await waitFor(() =>
      expect(screen.queryByLabelText('Documents attached')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(router.state.location.search).not.toContain('documentUrl'));
  });

  it('counts activities as updates, the word the toolbar can put in a sentence', async () => {
    const user = userEvent.setup();
    renderSearch('/search');
    await screen.findByText('Fish habitat report');

    await user.click(pill(/^Activities & updates/));

    expect(await screen.findByText('1–1 of 1 updates')).toBeInTheDocument();
  });

  it('counts project notifications as notifications', async () => {
    const user = userEvent.setup();
    renderSearch('/search');
    await screen.findByText('Fish habitat report');

    await user.click(pill(/^Project notifications/));

    expect(await screen.findByText('1–1 of 1 notifications')).toBeInTheDocument();
  });

  it('draws each project notification as a card, with its filters in the panel', async () => {
    const user = userEvent.setup();
    renderSearch('/search');
    await screen.findByText('Fish habitat report');

    await user.click(pill(/^Project notifications/));

    expect(
      await screen.findByRole('heading', { name: 'BEAR CREEK AGGREGATE' }),
    ).toBeInTheDocument();
    // The card keeps the tabs the project notifications page gave each row.
    expect(screen.getByRole('tab', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Engagement' })).toBeInTheDocument();
    // A card has no columns, so the column filters are only reachable through the panel.
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /More filters/ }));

    expect(screen.getByLabelText('Region')).toBeInTheDocument();
    expect(screen.getByLabelText('Notification decision')).toBeInTheDocument();
  });

  it('counts a column filter on the Filters button, which a list has no filter row for', async () => {
    renderSearch('/search?record=activities&type=News');

    await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline });

    const filters = screen.getByRole('button', { name: /More filters/ });
    expect(within(filters).getByText('1')).toBeInTheDocument();
  });

  it('offers the sign-up for every project on the updates tab', async () => {
    await withNotifyApi();
    renderSearch('/search?record=activities');

    await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline });

    expect(
      screen.getByText('Get an email when any project publishes an Update.'),
    ).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Subscribe' });
    // The eagle-notify service the address is filed under: every project, not one of them.
    expect(trigger.closest('[data-service]')).toHaveAttribute('data-service', 'eao:updates');
  });

  it('offers no sign-up where the environment has no notify API', async () => {
    renderSearch('/search?record=activities');

    await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline });

    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
  });

  it('keeps the sign-up off the projects tab, which sends no updates of its own', async () => {
    await withNotifyApi();
    renderSearch('/search?record=projects');

    await screen.findByText('Alpha Mine');

    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument();
  });
});
