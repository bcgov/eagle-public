import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { track } from 'app/analytics/analytics';
import { loadConfig } from 'app/config/config';
import { clearSelection } from 'app/state/bulk-download';
import { renderAt } from '../../../test-utils';
import { TYPEAHEAD_DEBOUNCE_MS } from 'app/components/filters/typeahead';
import { documentsConfig } from './types/documents';
import { UnifiedSearch } from './unified-search';
import { native } from '../home/home-fetch.spec-helper';

vi.mock('app/analytics/analytics', () => ({ track: vi.fn(), page: vi.fn(), reset: vi.fn() }));

const trackMock = vi.mocked(track);

/** Documents as `/documents` answers them: the coded fields carry their name, ids beside them. */
const DOCUMENTS = [
  {
    id: 'd1',
    displayName: 'Fish habitat report',
    datePosted: '2025-01-02T12:00:00Z',
    type: 'Letter',
    typeId: 'l1',
    documentAuthorType: 'EAO',
    documentAuthorTypeId: 'a1',
    fileSize: 2048,
  },
];
/** `List` rows, so the filter options have a name to show instead of the stored id. */
const LISTS = [
  { id: 'l1', name: 'Letter', type: 'doctype' },
  { id: 'a1', name: 'EAO', type: 'author' },
  // Both Acts carry a milestone of this name, each under its own id.
  { id: 'amend-2002', name: 'Amendment', type: 'label', legislation: 2002 },
  { id: 'amend-2018', name: 'Amendment', type: 'label', legislation: 2018 },
  // A second 2002 row of the same name, which only its id tells apart.
  { id: 'amend-2002-b', name: 'Amendment', type: 'label', legislation: 2002 },
];

/** An author id in no `List` row, which is what the test backend returns for some documents. */
const ORPHAN_ID = '6a61123ff0c29b9e36505fd7';

/** What `/documents` answers; a test that needs other cells puts its own rows here. */
let documents: Record<string, unknown>[];

/**
 * `/documents/passages` rows: one per passage, the hit wrapped in `<mark>` as the wire carries it.
 * Both sit in d1, so the page draws them as one document.
 */
const PASSAGE_ROWS = [
  {
    id: 'd1::p14::c0',
    documentId: 'd1',
    pageNumber: 14,
    pageNumbered: false,
    snippet: 'fish passage <mark>habitat</mark> near the culvert',
  },
  {
    id: 'd1::p15::c1',
    documentId: 'd1',
    pageNumber: 15,
    pageNumbered: false,
    snippet: 'riparian planting on the south bank',
  },
];
/** What `/documents/passages` answers, and the passage total in its `x-total-count`. */
let passages: Record<string, unknown>[];
let passageTotal: number;

/** Projects as `/projects` answers them: DEMI's Track id, the Eagle id the app routes by. */
const PROJECTS = [
  {
    id: '154',
    eagleId: 'p1',
    name: 'Alpha Mine',
    dateUpdated: '2025-02-03',
    region: 'Skeena',
    sector: 'Coal Mines',
    projectType: 'Mines',
    proponentName: 'Coast Aggregates',
    // A `List` ref, as DEMI stores it.
    currentPhaseName: { _id: 'ph1', name: 'Effects Assessment' },
  },
];

/** Updates as `/updates` answers them: the Eagle project id, and the project name joined on. */
const ACTIVITIES = [
  {
    id: 'u1',
    headline: 'Amendment application accepted for review',
    // Stored as HTML, which the row reads as words.
    content: '<p>The office accepted the amendment&nbsp;application.</p>',
    dateAdded: '2026-02-18',
    type: 'News',
    projectId: 'p1',
    projectEagleId: 'p1',
    projectName: 'Cedar LNG',
    documentUrl: '/api/document/d1/fetch/Amendment%20Order.pdf',
  },
];

const NOTIFICATIONS = [
  {
    id: 'n1',
    name: 'Bear Creek Aggregate',
    type: 'Mines',
    region: 'Cariboo',
    pcp: 'open',
    decision: 'In Progress',
    description: 'Expansion of an existing sand and gravel operation.',
    proponent: 'Cariboo Gravel Ltd.',
    notificationReceivedDate: '2025-03-14T12:00:00.000Z',
  },
];

/** A `/comment-periods` row. How a row draws is covered in types/comment-periods.spec.tsx. */
const COMMENT_PERIOD = {
  id: 'cp-2',
  projectId: '200',
  projectEagleId: 'eagle-2',
  isMet: false,
  projectName: 'Kitimat Terminal',
  informationLabel: 'Kitimat Terminal comment period',
  dateStarted: '2025-03-03T12:00:00.000Z',
  dateCompleted: '2025-04-02T12:00:00.000Z',
};

/** What `/counts?kind=projects,documents` answers. */
let counts: Record<string, number | null>;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** The answer a test is holding open, to look at the page while those rows are in flight. */
let held: { kind: string; gate: Promise<void>; release: () => void } | null;

/** The native kind a URL reads: `/demi/api/<kind>?...`. */
function kindOf(url: URL): string {
  return url.pathname.replace(/^\/demi\/api\//, '');
}

/** Holds one kind's page answer back until the returned function lets it through. */
function holdAnswersFor(kind: string): () => void {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  held = { kind, gate, release };
  return () => {
    held = null;
    release();
  };
}

/** Every request the page makes, answered by the native kind the URL reads. */
function stubApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const kind = kindOf(url);
    if (held && held.kind === kind) await held.gate;
    switch (kind) {
      case 'counts':
        return json(counts);
      case 'lists':
        return native(LISTS);
      case 'organizations':
        return native([]);
      case 'documents/passages':
        return native(passages, passageTotal);
      case 'documents': {
        const ids = url.searchParams.get('ids');
        if (ids)
          return native(documents.filter((row) => ids.split(',').includes(String(row['id']))));
        return native(documents);
      }
      case 'projects':
        return native(PROJECTS);
      case 'updates':
        return native(ACTIVITIES);
      case 'notifications':
        return native(NOTIFICATIONS);
      case 'comment-periods':
        return native([COMMENT_PERIOD]);
      default:
        return native([]);
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * The query of every list read the page made of one native kind, oldest first. `oneRow` picks the
 * one-row counted reads (tab badges, the other-scope probe) instead of the page reads.
 */
function asked(
  fetchMock: ReturnType<typeof vi.fn>,
  kind: string,
  { oneRow = false } = {},
): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), 'http://localhost'))
    .filter(
      (url) =>
        kindOf(url) === kind &&
        !url.searchParams.has('ids') &&
        (url.searchParams.get('pageSize') === '1') === oneRow,
    )
    .map((url) => url.searchParams);
}

function renderSearch(path: string) {
  return renderAt(path, [{ path: '/search', Component: UnifiedSearch }]);
}

/**
 * Runs out a debounce on the fake clock. The router renders the URL it writes as a transition,
 * which outlasted findBy under load; inside act it lands, with its effects, before act returns.
 */
async function settle(debounceMs: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(debounceMs);
  });
}

function pill(name: RegExp) {
  return screen.getByRole('button', { name });
}

/** Turns eagle-notify on for one test, the way a deployed environment's config does. */
async function withNotifyApi(): Promise<void> {
  window.__env = { ...window.__env, NOTIFY_API: 'https://notify.example' };
  await loadConfig();
}

/** The phone width where the rows become cards and the sort select stands in for the headings. */
function stubNarrow(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width: 719.98px'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

/** The cell a row shows under a named heading, which is what a reader reads down the column. */
function cellUnder(row: HTMLElement, heading: string): HTMLElement {
  const index = screen
    .getAllByRole('columnheader')
    .findIndex((cell) => (cell.textContent ?? '').startsWith(heading));
  return within(row).getAllByRole('cell')[index];
}

beforeEach(async () => {
  counts = { projects: 12, documents: 5 };
  documents = DOCUMENTS;
  passages = PASSAGE_ROWS;
  passageTotal = 2;
  held = null;
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

  it('carries the keyword field, the record types and the help link in the band', async () => {
    renderSearch('/search');

    const band = screen
      .getByRole('heading', { level: 1, name: 'Search' })
      .closest('section') as HTMLElement;
    expect(
      within(band).getByRole('searchbox', {
        name: 'Search projects, documents, updates and comment periods',
      }),
    ).toHaveAttribute('placeholder', 'Search projects and more');
    expect(within(band).getByRole('group', { name: 'Record type' })).toBeInTheDocument();
    expect(within(band).getByRole('link', { name: /Search help/ })).toBeInTheDocument();
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

  it('offers no name filter cell, which no native list takes', async () => {
    renderSearch('/search?record=documents');
    await screen.findByText('Fish habitat report');

    expect(screen.queryByLabelText('Filter by Name')).not.toBeInTheDocument();
  });

  it('neither sends nor chips a name filter an old address carries', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=documents&nameContains=habitat');
    await screen.findByText('Fish habitat report');

    expect(asked(fetchMock, 'documents').at(-1)?.has('nameContains')).toBe(false);
    expect(screen.queryByRole('button', { name: /Remove Name/ })).not.toBeInTheDocument();
  });

  it('names the Act on a milestone chip and drops only the term whose chip was cleared', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents&milestone=amend-2002,amend-2018');
    const newer = await screen.findByRole('button', { name: 'Remove Milestone Amendment (2018)' });
    expect(
      screen.getByRole('button', { name: 'Remove Milestone Amendment (2002)' }),
    ).toBeInTheDocument();

    await user.click(newer);

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('milestone')).toBe('amend-2002'),
    );
  });

  it('drops the second of two same-name, same-Act milestones when its chip is cleared', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=documents&milestone=amend-2002,amend-2002-b');
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Remove Milestone Amendment (2002)' }),
      ).toHaveLength(2),
    );

    await user.click(
      screen.getAllByRole('button', { name: 'Remove Milestone Amendment (2002)' })[1],
    );

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('milestone')).toBe('amend-2002'),
    );
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
    counts = { projects: 12, documents: null };
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

  it('opens the projects tab with Last updated switched off but still in the picker', async () => {
    const user = userEvent.setup();
    renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    expect(screen.queryByRole('columnheader', { name: /Last updated/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('checkbox', { name: 'Last updated' })).not.toBeChecked();
  });

  it('sends the type from a home page link, but not the sub-type /projects cannot filter', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&type=Mines&sector=Mineral%20Mines');
    await screen.findByText('Alpha Mine');

    const query = asked(fetchMock, 'projects').at(-1);
    expect(query?.get('projectType')).toBe('Mines');
    expect(query?.has('sector')).toBe(false);
    expect(screen.queryByRole('button', { name: /Remove Sub-type/ })).not.toBeInTheDocument();
  });

  it('keeps the lookup options of a type that reads none off its rows when new rows land', async () => {
    const optionsFrom = vi.spyOn(documentsConfig, 'optionsFrom');
    try {
      const { router, queryClient } = renderSearch('/search?record=documents');
      // Both lookups have landed and been built into options.
      await waitFor(() => {
        const [lists, orgs] = optionsFrom.mock.lastCall ?? [];
        expect(lists).toBe(queryClient.getQueryData(['lists']));
        expect(orgs).toBe(queryClient.getQueryData(['proponents']));
      });
      const built = optionsFrom.mock.calls.length;

      documents = [{ ...DOCUMENTS[0], _id: 'd2', displayName: 'Salmon survey' }];
      await act(() => router.navigate('/search?record=documents&sortBy=%2BdatePosted'));
      await screen.findByText('Salmon survey');

      expect(optionsFrom).toHaveBeenCalledTimes(built);
    } finally {
      optionsFrom.mockRestore();
    }
  });

  it('ranks by relevance, not by name, when a keyword is set and no sort is picked', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&keywords=alpha');
    await screen.findByText('Alpha Mine');

    // An unsorted `q` read comes back best match first.
    const query = asked(fetchMock, 'projects').at(-1);
    expect(query?.get('q')).toBe('alpha');
    expect(query?.has('sort')).toBe(false);
  });

  it('shows Relevance in the phone sort select while a keyword ranks the results', async () => {
    stubNarrow();
    renderSearch('/search?record=projects&keywords=alpha');
    await screen.findByText('Alpha Mine');

    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(select).toHaveDisplayValue('Relevance');
    expect(within(select).getAllByRole('option')[0]).toHaveTextContent('Relevance');
  });

  it('does not rank a keyword too short to be sent', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&keywords=a');
    await screen.findByText('Alpha Mine');

    const query = asked(fetchMock, 'projects').at(-1);
    expect(query?.get('sort')).toBe('name');
    expect(query?.has('q')).toBe(false);
  });

  it('sends a plus in the keyword as a literal plus, not a space', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&keywords=a%2Bb');
    await screen.findByText('Alpha Mine');

    expect(asked(fetchMock, 'projects').at(-1)?.get('q')).toBe('a+b');
  });

  it('leaves Relevance out of the phone sort select while there is no keyword', async () => {
    stubNarrow();
    renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(within(select).queryByRole('option', { name: 'Relevance' })).not.toBeInTheDocument();
  });

  it('drops Relevance from the phone sort select once the keyword is cleared', async () => {
    stubNarrow();
    const { router } = renderSearch('/search?record=projects&keywords=alpha');
    await screen.findByText('Alpha Mine');
    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(within(select).getByRole('option', { name: 'Relevance' })).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    await settle(TYPEAHEAD_DEBOUNCE_MS);

    expect(router.state.location.search).not.toContain('keywords');
    const sort = screen.getByRole('combobox', { name: 'Sort' });
    expect(within(sort).queryByRole('option', { name: 'Relevance' })).not.toBeInTheDocument();
    expect(sort).not.toHaveDisplayValue('Relevance');
  });

  it('offers only the name orders in the phone sort select, the one sort /projects takes', async () => {
    stubNarrow();
    renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Name A–Z', 'Name Z–A']);
  });

  it('reads a project sort /projects does not take as the name order', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=projects&sortBy=-dateUpdated');
    await screen.findByText('Alpha Mine');

    expect(asked(fetchMock, 'projects').at(-1)?.get('sort')).toBe('name');
  });

  it('sorts updates by their posted date only, the order /updates takes', async () => {
    stubNarrow();
    renderSearch('/search?record=activities');
    await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline });

    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['-dateAdded', '+dateAdded']);
  });

  it('shows Last updated once the reader picks it, and says so on the address', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Last updated' }));

    expect(await screen.findByRole('columnheader', { name: /Last updated/ })).toBeInTheDocument();
    // Sub-type, the tab's other default-off column, stays off and is now named on the address.
    expect(new URLSearchParams(router.state.location.search).get('cols')).toBe('sector');
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
        if (url.includes('/demi/api/projects?')) return new Response('', { status: 500 });
        return native([]);
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
        if (url.includes('/demi/api/projects?')) return new Response('', { status: 500 });
        return native([]);
      }),
    );

    renderSearch('/search?record=projects&keywords=coalmine');

    await screen.findByText('Search is unavailable right now');
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('searches once the typing has settled, not on every keystroke', async () => {
    const fetchMock = stubApi();
    const { router } = renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    vi.useFakeTimers();
    for (const typed of ['c', 'co', 'coa', 'coal']) {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: typed } });
    }
    await settle(TYPEAHEAD_DEBOUNCE_MS);

    expect(router.state.location.search).toContain('keywords=coal');
    const typedSearches = asked(fetchMock, 'projects').filter((query) => query.has('q'));
    // One request for the settled word; `co` and `coa` never left the page.
    expect(typedSearches.map((query) => query.get('q'))).toEqual(['coal']);
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

    expect(asked(fetchMock, 'updates').at(-1)?.get('sort')).toBe('-dateAdded');
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

  it('says the count is of what matched once a keyword narrows it', async () => {
    renderSearch('/search?record=documents&keywords=fish');

    expect(await screen.findByText('1–1 of 1 documents matching')).toBeInTheDocument();
  });

  it('draws each project notification as a row linking to its page, with its filters in the panel', async () => {
    const user = userEvent.setup();
    renderSearch('/search');
    await screen.findByText('Fish habitat report');

    await user.click(pill(/^Project notifications/));

    const link = await screen.findByRole('link', { name: 'Bear Creek Aggregate' });
    // No associated project, so the name opens the notification's own page.
    expect(link).toHaveAttribute('href', '/pn/n1');
    const row = link.closest('tr') as HTMLElement;
    expect(cellUnder(row, 'Type')).toHaveTextContent('Mines');
    expect(cellUnder(row, 'Region')).toHaveTextContent('Cariboo');
    expect(cellUnder(row, 'Proponent')).toHaveTextContent('Cariboo Gravel Ltd.');
    expect(cellUnder(row, 'Decision')).toHaveTextContent('In Progress');
    expect(cellUnder(row, 'Received')).toHaveTextContent('2025-03-14');

    // `/notifications` takes one value per filter, so every filter is a single pick in the panel.
    await user.click(screen.getByRole('button', { name: /More filters/ }));

    expect(screen.getByLabelText('Public comment period')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter by Type' })).not.toBeInTheDocument();
  });

  it('narrows notifications by one type picked in the panel', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderSearch('/search?record=notifications');
    await screen.findByRole('link', { name: 'Bear Creek Aggregate' });

    await user.click(screen.getByRole('button', { name: /More filters/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'Mines');

    await waitFor(() =>
      expect(asked(fetchMock, 'notifications').at(-1)?.getAll('type')).toEqual(['Mines']),
    );
  });

  it('counts a column filter on the Filters button, which a list has no filter row for', async () => {
    renderSearch('/search?record=activities&type=News');

    await screen.findByRole('heading', { level: 3, name: ACTIVITIES[0].headline });

    const filters = screen.getByRole('button', { name: /More filters/ });
    expect(within(filters).getByText('1')).toBeInTheDocument();
  });

  it('drops the rows of the tab it left rather than drawing them through the new one', async () => {
    const user = userEvent.setup();
    const release = holdAnswersFor('ProjectNotification');
    renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    await user.click(pill(/^Project notifications/));

    // A project drawn under the notification columns would link to /pn/ and lose its phase.
    await waitFor(() => expect(screen.queryByText(/alpha mine/i)).not.toBeInTheDocument());

    await act(async () => release());

    expect(await screen.findByRole('link', { name: 'Bear Creek Aggregate' })).toBeInTheDocument();
  });

  it('holds the count back until the rows land, rather than reading "No projects"', async () => {
    const release = holdAnswersFor('Project');
    renderSearch('/search?record=projects');

    // A hidden status region announces the wait; the count bar stays quiet.
    expect(await screen.findByText('Loading')).toBeInTheDocument();
    expect(screen.queryAllByText(/No projects/)).toHaveLength(0);

    await act(async () => release());

    expect(await screen.findByText('1–1 of 1 projects')).toBeInTheDocument();
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

/** Turns the text search on for one test, the way a deployed environment's config does. */
async function withContentSearch(): Promise<void> {
  window.__env = { ...window.__env, CONTENT_SEARCH: true };
  await loadConfig();
}

/** Every search the page asked one dataset for, in the order it asked. */

describe('the inside-documents scope', () => {
  beforeEach(withContentSearch);

  it('is offered on the documents tab, and only where the environment turns it on', async () => {
    const user = userEvent.setup();
    renderSearch('/search');

    expect(await screen.findByRole('button', { name: 'Inside documents' })).toBeInTheDocument();

    await user.click(pill(/^Projects/));
    await screen.findByText('Alpha Mine');
    expect(screen.queryByRole('button', { name: 'Inside documents' })).not.toBeInTheDocument();
  });

  it('hides the switch where the environment has no text search', async () => {
    window.__env = { logLevel: 4 };
    await loadConfig();
    renderSearch('/search');

    await screen.findByText('Fish habitat report');

    expect(screen.queryByRole('button', { name: 'Inside documents' })).not.toBeInTheDocument();
  });

  it('reads the passages of the keyword rather than the names', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderSearch('/search?keywords=habitat');

    await screen.findByText('Fish habitat report');
    await user.click(screen.getByRole('button', { name: 'Inside documents' }));

    // The term itself is wrapped in a mark, so the assertion reads the words around it.
    await screen.findByText(/near the culvert/);
    const query = asked(fetchMock, 'documents/passages').at(-1);
    expect(query?.get('q')).toBe('habitat');
    expect(query?.get('count')).toBe('true');
    // Passages rank by relevance and nothing else.
    expect(query?.has('sort')).toBe(false);
  });

  it('groups the passages under their document, named by one /documents?ids= read', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?scope=inside&keywords=habitat');

    await screen.findByText(/near the culvert/);
    // Two passages of d1 draw as one document carrying both.
    expect(screen.getAllByRole('checkbox', { name: 'Select Fish habitat report' })).toHaveLength(1);
    expect(screen.getByText('riparian planting on the south bank')).toBeInTheDocument();
    const labels = fetchMock.mock.calls
      .map(([input]) => new URL(String(input), 'http://localhost'))
      .filter((url) => url.pathname === '/demi/api/documents' && url.searchParams.has('ids'));
    expect(labels.map((url) => url.searchParams.get('ids'))).toEqual(['d1']);
  });

  it('names a document /documents?ids= did not return as untitled, keeping its passages', async () => {
    documents = [];
    renderSearch('/search?scope=inside&keywords=habitat');

    expect(await screen.findByText(/near the culvert/)).toBeInTheDocument();
    expect(screen.getByText('Untitled document')).toBeInTheDocument();
  });

  it('shows a passage as text, without the API markup around the hit', async () => {
    const user = userEvent.setup();
    renderSearch('/search?keywords=habitat');

    await screen.findByText('Fish habitat report');
    await user.click(screen.getByRole('button', { name: 'Inside documents' }));

    const passage = await screen.findByText(/near the culvert/);
    expect(passage.textContent).toBe('fish passage habitat near the culvert');
    // The page marks the term itself, from the plain text.
    expect(within(passage).getByText('habitat').tagName).toBe('MARK');
  });

  it('names the page of a passage the index gave one, and links into the file', async () => {
    passages = [{ ...PASSAGE_ROWS[0], pageNumbered: true, pageNumber: 170 }, PASSAGE_ROWS[1]];
    renderSearch('/search?scope=inside&keywords=habitat');

    const page = await screen.findByRole('link', { name: /^Page 170\b/ });
    expect(page.getAttribute('href')).toMatch(/#page=170$/);
    // The next passage has no page, so it keeps its place in the results.
    expect(screen.getByText('Passage 2')).toBeInTheDocument();
  });

  it('counts a passage with no page, even where a page number came with it', async () => {
    renderSearch('/search?scope=inside&keywords=habitat');

    expect(await screen.findByText('Passage 1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Page / })).not.toBeInTheDocument();
  });

  it('counts a flagged passage whose page number never arrived', async () => {
    passages = [
      { ...PASSAGE_ROWS[0], pageNumbered: true, pageNumber: null },
      { ...PASSAGE_ROWS[1], documentId: 'd2', pageNumbered: true, pageNumber: 0 },
    ];
    renderSearch('/search?scope=inside&keywords=habitat');

    // A page of zero is no page at all, so neither document may promise one.
    expect(await screen.findAllByText('Passage 1')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /^Page / })).not.toBeInTheDocument();
  });

  it('names the page of every passage the index gave one, and links each into the file', async () => {
    passages = [
      { ...PASSAGE_ROWS[0], pageNumber: 3, pageNumbered: true },
      { ...PASSAGE_ROWS[1], pageNumber: 7, pageNumbered: true },
    ];
    renderSearch('/search?scope=inside&keywords=habitat');

    expect(await screen.findByRole('link', { name: /^Page 3\b/ })).toBeInTheDocument();
    const second = screen.getByRole('link', { name: /^Page 7\b/ });
    expect(second.getAttribute('href')).toMatch(/#page=7$/);
  });

  it('counts a passage the index gave no page, beside one it did', async () => {
    passages = [{ ...PASSAGE_ROWS[0], pageNumber: 3, pageNumbered: true }, PASSAGE_ROWS[1]];
    renderSearch('/search?scope=inside&keywords=habitat');

    expect(await screen.findByRole('link', { name: /^Page 3\b/ })).toBeInTheDocument();
    expect(screen.getByText('Passage 2')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Page 2\b/ })).not.toBeInTheDocument();
  });

  it('ranks by relevance in the scope and keeps ranking by it on the way out', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const { router } = renderSearch('/search?keywords=habitat');

    await screen.findByText('Fish habitat report');
    await user.click(screen.getByRole('button', { name: 'Inside documents' }));
    // The term itself is wrapped in a mark, so the assertion reads the words around it.
    await screen.findByText(/near the culvert/);

    expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe('-matches');
    // Most matches is the only order here, and a select with one option is no choice.
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Names & details' }));
    await screen.findByText('Fish habitat report');
    expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBeNull();
    expect(asked(fetchMock, 'documents').at(-1)?.has('sort')).toBe(false);
  });

  it('asks for a word instead of searching the corpus with none', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?scope=inside');

    expect(await screen.findByText('Search inside the documents')).toBeInTheDocument();
    // The count states what is searchable rather than claiming a result nobody asked for.
    expect(await screen.findByText('5 documents indexed')).toBeInTheDocument();
    expect(asked(fetchMock, 'documents/passages')).toHaveLength(0);
    expect(screen.queryByRole('navigation', { name: 'Result pages' })).not.toBeInTheDocument();
  });

  it('points at the other scope when this one found nothing', async () => {
    const user = userEvent.setup();
    passages = [];
    passageTotal = 0;
    const { router } = renderSearch('/search?scope=inside&keywords=habitat');

    const cross = await screen.findByRole('button', { name: 'See 1 match in names & details' });
    expect(
      screen.getByText(
        'No passage inside a document contains it, but the name or details of one do.',
      ),
    ).toBeInTheDocument();

    await user.click(cross);
    await screen.findByText('Fish habitat report');
    expect(new URLSearchParams(router.state.location.search).get('scope')).toBeNull();
  });

  it('ticks a passage row as the document its passages sit in', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderSearch('/search?scope=inside&keywords=habitat');

    // The term itself is wrapped in a mark, so the assertion reads the words around it.
    await screen.findByText(/near the culvert/);
    await user.click(screen.getByRole('checkbox', { name: 'Select Fish habitat report' }));
    await user.click(await screen.findByRole('button', { name: 'Download 1' }));

    // What the basket holds is the document, not the chunk: that is the id a download can fetch.
    const posted = fetchMock.mock.calls.find(([url]) => String(url).includes('/bulk-downloads'));
    expect(JSON.parse(String((posted?.[1] as RequestInit | undefined)?.body))).toEqual({
      documentIds: ['d1'],
    });
  });

  it('carries a selection across the scope switch, which selects the same documents', async () => {
    const user = userEvent.setup();
    renderSearch('/search?keywords=habitat');

    await screen.findByText('Fish habitat report');
    await user.click(screen.getByRole('checkbox', { name: 'Select Fish habitat report' }));
    expect(await screen.findByRole('button', { name: 'Download 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Inside documents' }));

    await screen.findByText(/near the culvert/);
    expect(screen.getByRole('checkbox', { name: 'Select Fish habitat report' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Download 1' })).toBeInTheDocument();
  });

  it('badges the documents tab with what its own scope found, not the name matches', async () => {
    const user = userEvent.setup();
    // A word in the text of the files and in no document name or field, which is what the tab
    // would otherwise badge 0 while eight passages are listed under it.
    counts = { projects: 12, documents: 0 };
    passageTotal = 8;
    renderSearch('/search?scope=inside&keywords=habitat');

    await screen.findByText(/near the culvert/);
    await waitFor(() => expect(within(pill(/^Documents/)).getByText('8')).toBeInTheDocument());
    // Only the documents tab reads its own scope; the rest still count names and details.
    expect(within(pill(/^Projects/)).getByText('12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Names & details' }));
    await screen.findByText('Fish habitat report');
    expect(within(pill(/^Documents/)).getByText('0')).toBeInTheDocument();
  });

  it('counts the passages it found, and says they matched', async () => {
    passageTotal = 8;
    renderSearch('/search?scope=inside&keywords=habitat');

    expect(await screen.findByText('1–8 of 8 documents matching')).toBeInTheDocument();
  });

  it('drops the rows of the scope it left rather than drawing them as passages', async () => {
    const user = userEvent.setup();
    renderSearch('/search?keywords=habitat');
    await screen.findByText('Fish habitat report');

    const release = holdAnswersFor('documents/passages');
    await user.click(screen.getByRole('button', { name: 'Inside documents' }));

    /* A name row read as a passage group carries no passages, so it would draw as an empty
       document until the passages land. */
    await waitFor(() => expect(screen.queryByText('Fish habitat report')).not.toBeInTheDocument());
    expect(screen.queryByText('Untitled document')).not.toBeInTheDocument();

    await act(async () => release());

    expect(await screen.findByText(/near the culvert/)).toBeInTheDocument();
  });

  it('probes the other scope with the filters the switch would carry across', async () => {
    // Nothing matches the name, so the page asks what the text of the files holds.
    documents = [];
    const fetchMock = stubApi();
    renderSearch('/search?record=documents&keywords=habitat&milestone=m1&legislation=2002');

    // Two reads in a row with no timer between them, so no event to wait on; under load they outlasted 1 s.
    await screen.findByRole(
      'button',
      { name: 'See 2 matches inside the documents' },
      { timeout: 4000 },
    );

    const probe = asked(fetchMock, 'documents/passages', { oneRow: true }).at(-1);
    expect(probe?.get('q')).toBe('habitat');
    expect(probe?.get('milestoneId')).toBe('m1');
    // `/documents/passages` takes no legislation, so the probe leaves it behind.
    expect(probe?.has('legislation')).toBe(false);
  });

  it('leaves a filter passages cannot take off the wire inside the documents', async () => {
    // The scope offers no legislation filter, so only a typed address can put one in the URL.
    const fetchMock = stubApi();
    renderSearch('/search?scope=inside&keywords=habitat&legislation=2002&type=l1');

    await screen.findByText(/near the culvert/);

    const query = asked(fetchMock, 'documents/passages').at(-1);
    expect(query?.get('typeId')).toBe('l1');
    expect(query?.has('legislation')).toBe(false);
  });

  it('offers only the filters passages take in the panel inside the documents', async () => {
    // Inside the documents the list template has no filter row, so a column filter can only
    // reach the page through the panel.
    const user = userEvent.setup();
    renderSearch('/search?scope=inside&keywords=habitat');

    await screen.findByText(/near the culvert/);
    await user.click(screen.getByRole('button', { name: /More filters/ }));

    // A sibling column filter proves the panel is populated, not just empty.
    expect(screen.getByLabelText('Document type')).toBeInTheDocument();
    expect(screen.queryByLabelText('Legislation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Featured documents')).not.toBeInTheDocument();
  });
});

describe('the comment periods tab', () => {
  it('is offered among the record types', () => {
    renderSearch('/search');

    const types = screen.getByRole('group', { name: 'Record type' });
    expect(within(types).getByRole('button', { name: /^Comment periods/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reads /comment-periods when the address names the tab', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=commentPeriods');

    await waitFor(() => expect(asked(fetchMock, 'comment-periods').length).toBeGreaterThan(0));
    expect(pill(/^Comment periods/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws each period as a row linking to its details page under its project', async () => {
    renderSearch('/search?record=commentPeriods');

    const link = await screen.findByRole('link', { name: /Kitimat Terminal/ });
    expect(link).toHaveAttribute('href', '/p/eagle-2/cp/cp-2/details');
  });

  it('narrows to one status, on the address and in the query, until the reader clears it', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const { router } = renderSearch('/search?record=commentPeriods');
    await screen.findByRole('link', { name: /Kitimat Terminal/ });

    await user.click(screen.getByRole('button', { name: /More filters/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Upcoming');

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('status')).toBe('upcoming'),
    );
    await waitFor(() =>
      expect(asked(fetchMock, 'comment-periods').at(-1)?.get('status')).toBe('upcoming'),
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'All');

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).has('status')).toBe(false),
    );
    await waitFor(() =>
      expect(asked(fetchMock, 'comment-periods').at(-1)?.has('status')).toBe(false),
    );
  });

  // Closing date as well as opening date, and either date in the other direction.
  it.each([
    ['Closing date, newest first', '-dateCompleted', '-dateCompleted'],
    ['Oldest first', '+dateStarted', 'dateStarted'],
  ])('sorts by "%s" on the address and in the query', async (option, sortBy, wire) => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const { router } = renderSearch('/search?record=commentPeriods');
    await screen.findByRole('link', { name: /Kitimat Terminal/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), option);

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe(sortBy),
    );
    await waitFor(() => expect(asked(fetchMock, 'comment-periods').at(-1)?.get('sort')).toBe(wire));
  });

  it('hides the keyword box and sends no keyword, which /comment-periods does not take', async () => {
    const fetchMock = stubApi();
    renderSearch('/search?record=commentPeriods&keywords=kitimat');
    await screen.findByRole('link', { name: /Kitimat Terminal/ });

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Search/ })).not.toBeInTheDocument();
    const query = asked(fetchMock, 'comment-periods').at(-1);
    expect(query?.has('q')).toBe(false);
    expect(query?.get('sort')).toBe('-dateStarted');
  });

  it('keeps the keyword on the address for the tabs that take one', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=commentPeriods&keywords=kitimat');
    await screen.findByRole('link', { name: /Kitimat Terminal/ });

    await user.click(pill(/^Projects/));

    await screen.findByText('Alpha Mine');
    expect(new URLSearchParams(router.state.location.search).get('keywords')).toBe('kitimat');
    expect(screen.getByRole('searchbox')).toHaveValue('kitimat');
  });

  it('reads a sort the tab does not offer as its default, and can still leave it', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const { router } = renderSearch('/search?record=commentPeriods&sortBy=-dateAdded');
    await screen.findByRole('link', { name: /Kitimat Terminal/ });

    const select = screen.getByRole('combobox', { name: 'Sort' });
    expect(select).toHaveDisplayValue('Newest first');
    expect(asked(fetchMock, 'comment-periods').at(-1)?.get('sort')).toBe('-dateStarted');

    await user.selectOptions(select, 'Closing date, oldest first');

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('sortBy')).toBe(
        '+dateCompleted',
      ),
    );
  });

  it('drops its status filter and sort on the way to another tab', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const { router } = renderSearch(
      '/search?record=commentPeriods&status=open&sortBy=-dateCompleted',
    );
    await screen.findByRole('link', { name: /Kitimat Terminal/ });

    await user.click(pill(/^Documents/));

    // Documents is the default tab, so its address names no record type.
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).has('record')).toBe(false),
    );
    const params = new URLSearchParams(router.state.location.search);
    expect(params.has('status')).toBe(false);
    expect(params.has('sortBy')).toBe(false);
    await waitFor(() => expect(asked(fetchMock, 'documents').length).toBeGreaterThan(0));
    expect(asked(fetchMock, 'documents').at(-1)?.has('status')).toBe(false);
  });

  it('moves the address to the tab when it is picked from another one', async () => {
    const user = userEvent.setup();
    const { router } = renderSearch('/search?record=projects');
    await screen.findByText('Alpha Mine');

    await user.click(pill(/^Comment periods/));

    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('record')).toBe(
        'commentPeriods',
      ),
    );
    expect(await screen.findByRole('link', { name: /Kitimat Terminal/ })).toBeInTheDocument();
  });
});
