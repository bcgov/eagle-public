import { describe, it, expect, beforeEach, afterEach, onTestFinished, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../../test-utils';
import { fakeMap, mapProps } from './maplibre-test-stub';
import { Projects } from './projects';
import { filtersToParams, parseFilters } from './filter-state';
import { projectMatchesFilters, sortProjects } from './project-filter';
import { regionFillOpacity, regionLineOpacity, regionLineWidth } from './region-paint';
// Comes in with maplibre-gl, so the paint is checked by the same compiler the map uses.
import { createPropertyExpression, latest } from '@maplibre/maplibre-gl-style-spec';
import { logger } from 'app/config/logging';
import type { Project } from 'app/models/project';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('app/analytics/analytics', () => ({ track }));

import {
  baseLayerName,
  LIST_PAGE_SIZE,
  mapBounds,
  regionsVisible,
  sheetState,
  snapSheet,
} from 'app/state/map-ui';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('./maplibre-test-stub')).mapLibreStub(),
);

const PROJECTS = [
  {
    _id: 'p1',
    name: 'Cedar Quarry',
    proponent: { _id: 'o1', name: 'Cedar Holdings' },
    sector: 'Mining',
    type: 'Mines',
    region: 'Skeena',
    // Long enough for the card to clamp it; the Word class noise is stripped on the way in.
    description: `<p class="MsoNormal">A quarry near Cedar Creek. ${'Gravel and sand extraction. '.repeat(10)}</p>`,
    centroid: [-127.5, 54.2],
    currentPhaseName: { _id: 'ph1', name: 'Application Review' },
    dateAdded: '2026-01-05T00:00:00.000Z',
  },
  {
    _id: 'p2',
    name: 'Fir Transmission Line',
    location: 'Near Fort St. John',
    proponent: { _id: 'o2', name: 'Fir Power' },
    sector: 'Energy Storage',
    type: 'Energy-Electricity',
    region: 'Peace',
    description: 'A transmission line.',
    centroid: [-120.1, 56.4],
    currentPhaseName: { _id: 'ph2', name: 'Pre-Application' },
    dateAdded: '2026-02-05T00:00:00.000Z',
  },
];

const LISTS = [
  { _id: 'r1', type: 'region', name: 'Skeena' },
  { _id: 'r2', type: 'region', name: 'Peace' },
  { _id: 'r3', type: 'region', name: 'Thompson-Nicola' },
  { _id: 'r4', type: 'region', name: 'Omineca' },
  { _id: 'ph1', type: 'projectPhase', name: 'Application Review', legislation: '2018' },
  { _id: 'ph2', type: 'projectPhase', name: 'Pre-Application', legislation: '2018' },
];

// Far enough from today that the live clock never moves a period between states.
const OPEN_DATES = { dateStarted: '2020-01-01T12:00:00Z', dateCompleted: '2099-01-01T12:00:00Z' };
const UPCOMING_DATES = {
  dateStarted: '2098-01-01T12:00:00Z',
  dateCompleted: '2098-03-01T12:00:00Z',
};

/** Two of the nine EAO region polygons, enough to assert on the layer filter. */
const REGION_SHAPES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { regionName: 'Thompson', regionNumber: 3 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-121, 50],
            [-119, 50],
            [-119, 52],
            [-121, 52],
            [-121, 50],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { regionName: 'Peace', regionNumber: 9 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122, 55],
            [-119, 55],
            [-119, 58],
            [-122, 58],
            [-122, 55],
          ],
        ],
      },
    },
    // Inside Peace's bounding box, so picking both frames the same extent as Peace alone.
    {
      type: 'Feature',
      properties: { regionName: 'Omineca', regionNumber: 7 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-121, 56],
            [-120, 56],
            [-120, 57],
            [-121, 57],
            [-121, 56],
          ],
        ],
      },
    },
  ],
};

let requests: string[];
let projectFixtures: Record<string, unknown>[];
/**
 * What demi-search answers a keyword search with. By default the fixtures whose name matches, as
 * the index returns them: id and name only.
 */
let keywordResults: (keywords: string) => Record<string, unknown>[];
/** `searchResultsTotal` of a keyword answer; the row count when unset. */
let keywordTotal: number | undefined;
/** Comment period answers by `and[status]` (`open`, `upcoming`); an unset one answers empty. */
let commentPeriodResponders: Map<string, () => Promise<Response>>;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** The `/search` envelope a comment period list comes back in. */
function periodEnvelope(periods: unknown[]) {
  return [{ searchResults: periods, meta: [{ searchResultsTotal: periods.length }] }];
}

function stubFetch() {
  requests = [];
  projectFixtures = PROJECTS;
  keywordResults = (keywords) =>
    PROJECTS.filter((project) => project.name.toLowerCase().includes(keywords)).map(
      ({ _id, name }) => ({ _id, name }),
    );
  keywordTotal = undefined;
  commentPeriodResponders = new Map();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('dataset=Project')) {
        const keywords = new URL(url, 'http://localhost').searchParams.get('keywords');
        const results = keywords ? keywordResults(keywords) : projectFixtures;
        const total = (keywords && keywordTotal) || results.length;
        return jsonResponse([{ searchResults: results, meta: [{ searchResultsTotal: total }] }]);
      }
      if (url.includes('dataset=List')) {
        return jsonResponse([
          { searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] },
        ]);
      }
      if (url.includes('eao-regions.geojson')) {
        return jsonResponse(REGION_SHAPES);
      }
      if (url.includes('dataset=CommentPeriod')) {
        const status = new URL(url, 'http://localhost').searchParams.get('and[status]') ?? '';
        const responder = commentPeriodResponders.get(status);
        return responder ? responder() : jsonResponse(periodEnvelope([]));
      }
      return jsonResponse([]);
    }),
  );
}

/** `useResponsive` reads its two media queries; only the widest one says desktop. */
function stubViewport(desktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: desktop && query.includes('min-width: 1280px'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function renderProjects(path = '/projects') {
  return renderAt(path, [
    { path: '/projects', Component: Projects },
    { path: '/p/:projId', element: <div>project page</div> },
  ]).router;
}

function cards(): HTMLElement[] {
  return screen.getAllByTestId('project-card');
}

function projectRequests(): string[] {
  return requests.filter((url) => url.includes('dataset=Project'));
}

/** Card titles, top to bottom. */
function titles(): (string | null | undefined)[] {
  return cards().map((card) => card.querySelector('.app-card__name')?.textContent);
}

function keywordRequests(): string[] {
  return projectRequests().filter((url) => url.includes('keywords='));
}

/** Holds a request whose URL contains `match` until the returned release is called. */
function holdRequests(match: string): { release: () => void; held: () => boolean } {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  const responder = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes(match)) {
        held = true;
        await gate;
      }
      return responder(input);
    }),
  );
  return { release: () => release(), held: () => held };
}

/** Types into the search box on a fake clock, where userEvent's key timing would stall. */
async function typeOnFakeClock(text: string): Promise<void> {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText('Search projects'), { target: { value: text } });
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function pinIds(): (string | null)[] {
  return [...document.querySelectorAll('[data-testid="map-marker"]')].map((pin) =>
    pin.getAttribute('data-project-id'),
  );
}

/** p1 (Cedar Quarry) has an open comment period, p2 (Fir Transmission Line) an upcoming one. */
function stubEngagement(): void {
  commentPeriodResponders.set('open', async () =>
    jsonResponse(periodEnvelope([{ _id: 'cp1', project: 'p1', ...OPEN_DATES }])),
  );
  commentPeriodResponders.set('upcoming', async () =>
    jsonResponse(periodEnvelope([{ _id: 'cp2', project: 'p2', ...UPCOMING_DATES }])),
  );
}

/** By card text, not `getByText`: the pin tooltip carries the same project name. */
function cardFor(name: string): HTMLElement {
  const card = cards().find((item) => item.textContent?.includes(name));
  if (!card) throw new Error(`no card for ${name}`);
  return card;
}

/** The accordion body a mobile card names through `aria-controls`. */
function bodyOf(card: HTMLElement): HTMLElement {
  const id = card.getAttribute('aria-controls');
  const body = id ? document.getElementById(id) : null;
  if (!body) throw new Error(`no accordion body for ${card.textContent}`);
  return body;
}

function layerFor(id: string): HTMLElement {
  const layer = document.querySelector(`[data-testid="layer"][data-id="${id}"]`);
  if (!layer) throw new Error(`no map layer ${id}`);
  return layer as HTMLElement;
}

/** The pointer sitting over a region polygon; the real map fills `features` from the fill layer. */
/** A region fill feature as the map reports it; `promoteId` makes the name its id. */
function regionFeature(regionName: string) {
  return {
    type: 'Feature' as const,
    id: regionName,
    layer: { id: 'eao-regions-fill' },
    properties: { regionName },
    geometry: { type: 'Point' as const, coordinates: [0, 0] },
  };
}

/** The pointer sitting over a region polygon; the real map fills `features` from the fill layer. */
function moveOverRegion(regionName: string, x = 40, y = 60): void {
  act(() => mapProps?.onMouseMove?.({ features: [regionFeature(regionName)], point: { x, y } }));
}

/**
 * Watches every `scrollTop` written to the list's scroll area from now on, the first render
 * included; read it through the returned function. jsdom does not scroll.
 */
function watchListScroll(): () => number[] {
  const setter = vi.spyOn(Element.prototype, 'scrollTop', 'set');
  onTestFinished(() => setter.mockRestore());
  return () =>
    setter.mock.calls
      .filter((_, index) =>
        (setter.mock.contexts[index] as Element).classList.contains('app-list__scroll-container'),
      )
      .map(([value]) => value);
}

/** The last hover amount the map was given for a region; it eases between 0 and 1. */
function hoverAmount(regionName: string): unknown {
  const calls = fakeMap.setFeatureState.mock.calls.filter(
    ([target, state]) => target.id === regionName && 'hoverT' in state,
  );
  return calls.at(-1)?.[1]['hoverT'];
}

/** A click on a region polygon, off any pin. */
function clickRegion(regionName: string): void {
  const onClick = mapProps?.['onClick'] as (event: unknown) => void;
  act(() =>
    onClick({
      features: [regionFeature(regionName)],
      point: { x: 40, y: 60 },
      originalEvent: { target: document.body },
    }),
  );
}

/** The map's double-click window, which a desktop region click waits out before it picks. */
const DBLCLICK_WINDOW_MS = 300;

/** A desktop region click, then the wait before it picks. */
async function pickRegion(regionName: string): Promise<void> {
  clickRegion(regionName);
  await act(() => new Promise((resolve) => setTimeout(resolve, DBLCLICK_WINDOW_MS)));
}

function pinFor(id: string): HTMLElement {
  const pin = document.querySelector(`[data-testid="map-marker"][data-project-id="${id}"]`);
  if (!pin) throw new Error(`no map pin for ${id}`);
  return pin as HTMLElement;
}

beforeEach(() => {
  // jsdom has no scrollIntoView; the list calls it to bring the selected card into view.
  Element.prototype.scrollIntoView = vi.fn();
  fakeMap.reset();
  fakeMap.setZoom(6);
  stubFetch();
  stubViewport(true);
  sheetState.set('peek');
  baseLayerName.set('Light Gray');
  regionsVisible.set(true);
  mapBounds.set(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  track.mockClear();
});

describe('filter state', () => {
  it('round-trips every filter through the query string', () => {
    const filters = {
      regions: ['r1', 'r2'],
      phases: ['ph1'],
      types: ['mines'],
      applicant: 'cedar',
      clFile: '123',
      dispId: '456',
      purpose: 'quarry',
      publishFrom: new Date('2026-01-01T00:00:00.000Z'),
      publishTo: new Date('2026-06-30T00:00:00.000Z'),
      commentPeriod: 'open' as const,
      sort: 'updated' as const,
    };
    const params = filtersToParams(filters);

    expect(params.toString()).toBe(
      'regions=r1%2Cr2&phases=ph1&types=mines&applicant=cedar&clFile=123&dispId=456&purpose=quarry' +
        '&publishFrom=2026-01-01&publishTo=2026-06-30&cp=open&sort=updated',
    );
    expect(parseFilters(params)).toEqual(filters);
  });

  it('leaves empty filters out of the query string', () => {
    expect(filtersToParams(parseFilters(new URLSearchParams())).toString()).toBe('');
  });

  it('ignores a comment period state it does not offer', () => {
    expect(parseFilters(new URLSearchParams('cp=closed')).commentPeriod).toBeNull();
    expect(parseFilters(new URLSearchParams('cp=toString')).commentPeriod).toBeNull();
  });

  it('ignores a sort it does not offer', () => {
    expect(parseFilters(new URLSearchParams('sort=oldest')).sort).toBeNull();
    expect(parseFilters(new URLSearchParams('sort=hasOwnProperty')).sort).toBeNull();
  });
});

describe('project filter', () => {
  const regions = LISTS.filter((item) => item.type === 'region');
  const empty = parseFilters(new URLSearchParams());
  const project = PROJECTS[0] as any;

  it('matches a type filter by the dropdown code, not the raw code string', () => {
    expect(projectMatchesFilters(project, { ...empty, types: ['mines'] }, regions)).toBe(true);
    expect(projectMatchesFilters(project, { ...empty, types: ['transportation'] }, regions)).toBe(
      false,
    );
  });

  it('matches a region filter by id through the list metadata', () => {
    expect(projectMatchesFilters(project, { ...empty, regions: ['r1'] }, regions)).toBe(true);
    expect(projectMatchesFilters(project, { ...empty, regions: ['r2'] }, regions)).toBe(false);
  });

  it('keeps only projects with a comment period in the chosen state', () => {
    const states = new Map([['p1', new Set(['open' as const])]]);
    const open = { ...empty, commentPeriod: 'open' as const };
    const upcoming = { ...empty, commentPeriod: 'upcoming' as const };

    expect(projectMatchesFilters(project, open, regions, states)).toBe(true);
    expect(projectMatchesFilters(project, upcoming, regions, states)).toBe(false);
    expect(projectMatchesFilters(PROJECTS[1] as any, open, regions, states)).toBe(false);
    expect(projectMatchesFilters(PROJECTS[1] as any, empty, regions, states)).toBe(true);
  });

  it('matches a project under each state its comment periods are in', () => {
    const states = new Map([['p1', new Set(['open', 'upcoming'] as const)]]);

    expect(
      projectMatchesFilters(project, { ...empty, commentPeriod: 'open' }, regions, states),
    ).toBe(true);
    expect(
      projectMatchesFilters(project, { ...empty, commentPeriod: 'upcoming' }, regions, states),
    ).toBe(true);
  });

  it('leaves the search box text to the server', () => {
    expect(projectMatchesFilters(project, { ...empty, applicant: 'no such name' }, regions)).toBe(
      true,
    );
  });

  /** Just the fields a sort reads. */
  const row = (fields: Partial<Project>) => fields as Project;

  it('keeps the incoming order for equal names or equal update dates', () => {
    const a = row({ _id: 'a', name: 'Same', dateUpdated: '2026-01-01T00:00:00.000Z' });
    const b = row({ _id: 'b', name: 'Same', dateUpdated: '2026-01-01T00:00:00.000Z' });

    expect(sortProjects([a, b], 'name').map((p) => p._id)).toEqual(['a', 'b']);
    expect(sortProjects([b, a], 'updated').map((p) => p._id)).toEqual(['b', 'a']);
  });

  it('sorts an unreadable update date with the undated projects, last', () => {
    const dated = row({ _id: 'dated', name: 'B', dateUpdated: '2020-01-01T00:00:00.000Z' });
    const garbage = row({ _id: 'garbage', name: 'A', dateUpdated: 'garbage' });

    expect(sortProjects([garbage, dated], 'updated').map((p) => p._id)).toEqual([
      'dated',
      'garbage',
    ]);
  });

  it('drops projects outside the publish date range', () => {
    const publishFrom = new Date('2026-02-01T00:00:00.000Z');
    expect(projectMatchesFilters(project, { ...empty, publishFrom }, regions)).toBe(false);
    expect(projectMatchesFilters(PROJECTS[1] as any, { ...empty, publishFrom }, regions)).toBe(
      true,
    );
  });
});

describe('projects page', () => {
  it('requests every project once and renders a card per result', async () => {
    renderProjects();

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
    expect(screen.getByText('Cedar Holdings')).toBeInTheDocument();
    expect(screen.getByText('Fir Power')).toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('2 projects in view');

    expect(projectRequests()).toEqual([
      '/demi-search/search?dataset=Project&pageNum=0&pageSize=1000000&projectLegislation=default&sortBy=&sortBy=&populate=true&fuzzy=false',
    ]);
  });

  it('opens the project details page from the info card a card selection opened', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(cardFor('Cedar Quarry'));

    const popup = await screen.findByTestId('map-popup');
    await userEvent.click(within(popup).getByRole('button', { name: 'View project' }));

    expect(router.state.location.pathname).toBe('/p/p1');
  });

  it('writes the search box to the URL and narrows the list', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');

    await userEvent.type(screen.getByPlaceholderText('Search projects'), 'fir');

    await waitFor(() => expect(router.state.location.search).toBe('?applicant=fir'));
    await waitFor(() => expect(screen.queryByText('Application Review')).not.toBeInTheDocument());
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('1 project in view');
  });

  it('sends the search box to demi-search once typing stops', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.type(screen.getByPlaceholderText('Search projects'), 'fir');

    await waitFor(() => expect(keywordRequests()).toHaveLength(1));
    // One request for the whole word, not one per keystroke; sortBy stays empty for score order.
    expect(keywordRequests()[0]).toBe(
      '/demi-search/search?dataset=Project&keywords=fir&pageNum=0&pageSize=500&projectLegislation=default&sortBy=&sortBy=&populate=false&fuzzy=false',
    );

    vi.useFakeTimers();
    await advance(300);
    expect(projectRequests()).toHaveLength(2);
  });

  it('sends no search for a single character', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    vi.useFakeTimers();

    await typeOnFakeClock('f');
    await advance(300);

    expect(keywordRequests()).toEqual([]);
    expect(cards()).toHaveLength(2);
  });

  it('searches with the keywords a shared link carries', async () => {
    renderProjects('/projects?applicant=fir');

    expect(await screen.findByText('Pre-Application')).toBeInTheDocument();
    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search projects')).toHaveValue('fir');
    expect(keywordRequests()).toHaveLength(1);
    expect(keywordRequests()[0]).toContain('&keywords=fir&');
  });

  it('shows the full project record for a search hit, not the thinner index row', async () => {
    renderProjects('/projects?applicant=fir');
    await screen.findByText('Pre-Application');

    await userEvent.click(cardFor('Fir Transmission Line'));

    const popup = await screen.findByTestId('map-popup');
    expect(within(popup).getByText('Near Fort St. John')).toBeInTheDocument();
    expect(within(popup).getByText('Peace')).toBeInTheDocument();
  });

  it('says so when the search fails instead of finding nothing', async () => {
    const stub = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        // A 2xx with no result envelope, which the search client cannot read.
        String(input).includes('keywords=') ? jsonResponse([]) : stub(input),
      ),
    );
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    renderProjects('/projects?applicant=fir');

    expect(await screen.findByText('Projects could not be loaded right now.')).toBeInTheDocument();
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument();
    expect(error).toHaveBeenCalledWith('Error searching projects', 'Projects', expect.anything());
  });

  it('lists a project once when the search index returns its id twice', async () => {
    keywordResults = () => [{ _id: 'p2' }, { _id: 'p2' }];
    renderProjects('/projects?applicant=fir');

    await waitFor(() => expect(titles()).toEqual(['Fir Transmission Line']));
  });

  it('says so when the full project list fails to load', async () => {
    const stub = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('dataset=Project') ? jsonResponse([]) : stub(input),
      ),
    );
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    renderProjects();

    expect(await screen.findByText('Projects could not be loaded right now.')).toBeInTheDocument();
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument();
  });

  it('warns when more projects match than one search page holds', async () => {
    keywordTotal = 501;
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    renderProjects('/projects?applicant=fir');
    await screen.findByText('Pre-Application');

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('matched 501 projects'), 'project'),
    );
  });

  it('escapes the search text so an ampersand stays in the keywords', async () => {
    renderProjects(`/projects?applicant=${encodeURIComponent('fir & co')}`);
    await screen.findByText('No projects found');

    expect(keywordRequests()[0]).toContain('&keywords=fir%20%26%20co&');
  });

  it('lists the search results in the order demi-search ranked them', async () => {
    // p9 is in the index but not the full list, so it has no card.
    keywordResults = () => [{ _id: 'p2' }, { _id: 'p9' }, { _id: 'p1' }];
    renderProjects('/projects?applicant=line');
    await screen.findByText('Pre-Application');

    expect(titles()).toEqual(['Fir Transmission Line', 'Cedar Quarry']);
  });

  it('scrolls the list back to the top once, when the new search results land', async () => {
    const scrolls = watchListScroll();
    const fir = holdRequests('keywords=fir');
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.type(screen.getByPlaceholderText('Search projects'), 'fir');
    await waitFor(() => expect(fir.held()).toBe(true));
    expect(scrolls()).toEqual([]);

    fir.release();
    await waitFor(() => expect(screen.queryByText('Application Review')).not.toBeInTheDocument());

    expect(scrolls()).toEqual([0]);
  });

  it('brings the open card back into view once the new search results land', async () => {
    const scrolls = watchListScroll();
    const fir = holdRequests('keywords=fir');
    renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(cardFor('Fir Transmission Line'));
    await screen.findByTestId('map-popup');

    await userEvent.type(screen.getByPlaceholderText('Search projects'), 'fir');
    await waitFor(() => expect(fir.held()).toBe(true));
    const scrolledIntoView = vi.mocked(Element.prototype.scrollIntoView);
    scrolledIntoView.mockClear();
    const before = scrolls().length;

    fir.release();
    await waitFor(() => expect(screen.queryByText('Application Review')).not.toBeInTheDocument());

    expect(scrolls().slice(before)).toEqual([0]);
    expect(scrolledIntoView.mock.contexts).toContain(cardFor('Fir Transmission Line'));
  });

  it('leaves the list where it is on first load, a card pick and a map pan', async () => {
    const scrolls = watchListScroll();
    renderProjects();
    await screen.findByText('Application Review');
    expect(scrolls()).toEqual([]);

    await userEvent.click(cardFor('Cedar Quarry'));
    await screen.findByTestId('map-popup');
    act(() => mapBounds.set({ north: 58, south: 54, east: -119, west: -128 }));
    await userEvent.hover(cardFor('Cedar Quarry'));

    expect(scrolls()).toEqual([]);
  });

  it('scrolls the list back to the top when the sort changes, keeping the open card in sight', async () => {
    const scrolls = watchListScroll();
    renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(cardFor('Fir Transmission Line'));
    await screen.findByTestId('map-popup');
    const scrolledIntoView = vi.mocked(Element.prototype.scrollIntoView);
    scrolledIntoView.mockClear();

    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Name A-Z');

    await waitFor(() => expect(scrolls()).toEqual([0]));
    expect(scrolledIntoView.mock.contexts).toContain(cardFor('Fir Transmission Line'));
  });

  it('renders with an unreadable date in the URL, ignoring it', async () => {
    renderProjects('/projects?publishFrom=garbage');

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(cards()).toHaveLength(2);
  });

  it('keeps the last results on screen while the next search runs', async () => {
    const cedar = holdRequests('keywords=cedar');
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.type(screen.getByPlaceholderText('Search projects'), 'cedar');
    await waitFor(() => expect(cedar.held()).toBe(true));

    expect(screen.queryAllByTestId('project-card-skeleton')).toHaveLength(0);
    expect(cards()).toHaveLength(2);

    cedar.release();

    await waitFor(() => expect(screen.queryByText('Pre-Application')).not.toBeInTheDocument());
    expect(cards()).toHaveLength(1);
  });

  it("keeps one search's results on screen while the next search runs, and says it is searching", async () => {
    renderProjects('/projects?applicant=fir');
    await waitFor(() => expect(titles()).toEqual(['Fir Transmission Line']));
    const cedar = holdRequests('keywords=cedar');

    // One change, not clear-then-type: a term typed straight after clearing starts from the full list.
    fireEvent.change(screen.getByPlaceholderText('Search projects'), {
      target: { value: 'cedar' },
    });
    await waitFor(() => expect(cedar.held()).toBe(true));

    expect(titles()).toEqual(['Fir Transmission Line']);
    expect(screen.getByTestId('results-count')).toHaveTextContent('1 project in view. Searching');

    cedar.release();

    await waitFor(() => expect(titles()).toEqual(['Cedar Quarry']));
    expect(screen.getByTestId('results-count')).toHaveTextContent(/^1 project in view$/);
  });

  it('clears the search filter out of the URL again', async () => {
    const router = renderProjects('/projects?applicant=fir');
    await screen.findByText('Pre-Application');

    await waitFor(() => expect(screen.queryByText('Application Review')).not.toBeInTheDocument());
    const sent = projectRequests().length;
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'));
    });

    // Back to the full list at once, from the list already loaded.
    expect(router.state.location.search).toBe('');
    expect(cards()).toHaveLength(2);
    await advance(300);
    expect(projectRequests()).toHaveLength(sent);
  });

  it('shows the old results again when the same term is typed back after clearing', async () => {
    renderProjects('/projects?applicant=fir');
    await screen.findByText('Pre-Application');
    await waitFor(() => expect(screen.queryByText('Application Review')).not.toBeInTheDocument());
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'));
    });
    await typeOnFakeClock('fir');

    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
    expect(cardFor('Fir Transmission Line')).toBeInTheDocument();
  });

  it('keeps a term typed back after clearing on screen while a longer term settles', async () => {
    renderProjects('/projects?applicant=fir');
    await waitFor(() => expect(titles()).toEqual(['Fir Transmission Line']));
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'));
    });
    await advance(300);
    await typeOnFakeClock('fir');
    await advance(300);
    await typeOnFakeClock('firs');

    // The cleared term was typed again, so it is the last answer, not a stale one.
    expect(titles()).toEqual(['Fir Transmission Line']);
  });

  it('never shows the old results for a term typed straight after clearing', async () => {
    renderProjects('/projects?applicant=fir');
    await screen.findByText('Pre-Application');
    await waitFor(() => expect(screen.queryByText('Application Review')).not.toBeInTheDocument());
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Clear search'));
    });
    await typeOnFakeClock('ce');

    expect(screen.getByText('Application Review')).toBeInTheDocument();
    await advance(299);
    expect(screen.getByText('Application Review')).toBeInTheDocument();
    expect(keywordRequests()).toHaveLength(1);
  });

  it('applies filters taken from the URL on first load', async () => {
    renderProjects('/projects?regions=r2');

    expect(await screen.findByText('Pre-Application')).toBeInTheDocument();
    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
  });

  it('keeps the filters panel collapsed but counts the filters the URL carries', async () => {
    renderProjects('/projects?regions=r2');
    await screen.findByText('Pre-Application');

    const toggle = screen.getByRole('button', { name: /Filters/ });
    const panel = document.querySelector('#applist-filters') as HTMLElement;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(toggle).getByText('1')).toBeInTheDocument();
    // Collapsed, but in the DOM for the expand transition, so it must stay out of the tab order.
    expect(panel).toHaveAttribute('data-open', 'false');
    expect(panel).toHaveAttribute('inert');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveAttribute('data-open', 'true');
    expect(panel).not.toHaveAttribute('inert');
    expect(within(panel).getByText('Project Phase')).toBeInTheDocument();
  });

  it('leaves the search text out of the Filters badge', async () => {
    renderProjects('/projects?applicant=Cedar');
    await screen.findByText('Cedar Quarry');

    const toggle = screen.getByRole('button', { name: /Filters/ });
    expect(within(toggle).queryByText('1')).not.toBeInTheDocument();
  });

  it('closes the filters panel on Escape and returns focus to the Filters button', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    const toggle = screen.getByRole('button', { name: /Filters/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('shows skeleton cards until the projects arrive', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const responder = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('dataset=Project')) await gate;
        return responder(input);
      }),
    );

    renderProjects();

    expect(await screen.findAllByTestId('project-card-skeleton')).toHaveLength(6);
    expect(screen.queryByText('Loading projects...')).toBeNull();
    expect(screen.getByText('Loading projects')).toHaveClass('visually-hidden');
    expect(document.querySelector('.app-list__list')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelector('.app-map__shimmer')).toBeInTheDocument();

    release?.();

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.queryAllByTestId('project-card-skeleton')).toHaveLength(0);
    expect(document.querySelector('.app-map__shimmer')).toBeNull();
  });

  it('narrows the list and the pins to the chosen comment period state', async () => {
    stubEngagement();
    const router = renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(pinFor('p2')).toHaveAttribute('data-engagement', 'upcoming'));

    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await userEvent.selectOptions(screen.getByLabelText('Comment Period'), 'Open now');

    await waitFor(() => expect(router.state.location.search).toBe('?cp=open'));
    expect(track).toHaveBeenLastCalledWith(
      'Project Filters Applied',
      expect.objectContaining({ comment_period: 'open', total_filters: 1 }),
    );
    expect(cards()).toHaveLength(1);
    expect(cardFor('Cedar Quarry')).toBeInTheDocument();
    expect(pinIds()).toEqual(['p1']);

    await userEvent.selectOptions(screen.getByLabelText('Comment Period'), 'Upcoming');

    await waitFor(() => expect(router.state.location.search).toBe('?cp=upcoming'));
    expect(cardFor('Fir Transmission Line')).toBeInTheDocument();
    expect(pinIds()).toEqual(['p2']);

    await userEvent.selectOptions(screen.getByLabelText('Comment Period'), 'Any');

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(cards()).toHaveLength(2);
  });

  it('lists a project with an open and an upcoming period under both', async () => {
    commentPeriodResponders.set('open', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp1', project: 'p1', ...OPEN_DATES }])),
    );
    commentPeriodResponders.set('upcoming', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp2', project: 'p1', ...UPCOMING_DATES }])),
    );
    renderProjects('/projects?cp=upcoming');

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.queryByText('Pre-Application')).not.toBeInTheDocument();
    // The pin still shows the state that outranks.
    expect(pinFor('p1')).toHaveAttribute('data-engagement', 'open');
  });

  it('says the comment periods failed to load instead of finding no projects', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    commentPeriodResponders.set('open', async () => new Response('', { status: 500 }));
    renderProjects('/projects?cp=open');

    expect(
      await screen.findByText('Comment periods could not be loaded right now.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument();
  });

  it('finds no projects, not a load error, when only the other comment period read fails', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    commentPeriodResponders.set('upcoming', async () => new Response('', { status: 500 }));
    renderProjects('/projects?cp=open');

    expect(await screen.findByText('No projects found')).toBeInTheDocument();
    expect(
      screen.queryByText('Comment periods could not be loaded right now.'),
    ).not.toBeInTheDocument();
  });

  it('applies and counts a comment period filter taken from the URL', async () => {
    stubEngagement();
    renderProjects('/projects?cp=open');

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.queryByText('Pre-Application')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Comment Period')).toHaveDisplayValue('Open now');
    const toggle = screen.getByRole('button', { name: /Filters/ });
    expect(within(toggle).getByText('1')).toBeInTheDocument();
  });

  it('holds the list on skeletons until the comment periods arrive', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubEngagement();
    const open = commentPeriodResponders.get('open')!;
    commentPeriodResponders.set('open', async () => {
      await gate;
      return open();
    });
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await userEvent.selectOptions(screen.getByLabelText('Comment Period'), 'Open now');

    expect(await screen.findAllByTestId('project-card-skeleton')).toHaveLength(6);
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument();
    expect(screen.queryByText('Pre-Application')).not.toBeInTheDocument();

    release?.();

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.queryByText('Pre-Application')).not.toBeInTheDocument();
  });

  it('shows "No projects found" when nothing matches', async () => {
    renderProjects('/projects?applicant=nothing-matches-this');

    expect(await screen.findByText('No projects found')).toBeInTheDocument();
  });
});

describe('region paint', () => {
  type PaintKey = 'fill-opacity' | 'line-width' | 'line-opacity';

  /** Compiles a paint expression the way MapLibre does, then evaluates it for one feature state. */
  function paintAt(
    key: PaintKey,
    expression: unknown,
    state: { hoverT?: number; selected?: boolean },
  ): number {
    const spec = key === 'fill-opacity' ? latest.paint_fill[key] : latest.paint_line[key];
    const compiled = createPropertyExpression(expression, spec as never);
    if (compiled.result !== 'success') throw new Error(JSON.stringify(compiled.value));
    return compiled.value.evaluate({ zoom: 6 }, { type: 2, properties: {} } as never, state);
  }

  /** The value at rest and fully hovered, for one paint and one pick state. */
  function restAndHover(key: PaintKey, expression: unknown, selected?: boolean): number[] {
    return [0, 1].map((hoverT) => paintAt(key, expression, { hoverT, selected }));
  }

  it('eases every look with the hover amount when no region is picked', () => {
    expect(restAndHover('fill-opacity', regionFillOpacity(false))).toEqual([0.08, 0.13]);
    expect(restAndHover('line-width', regionLineWidth(false))).toEqual([1, 2]);
    expect(restAndHover('line-opacity', regionLineOpacity(false))).toEqual([0.5, 0.7]);
    // Half-way through the tween sits half-way between.
    expect(paintAt('line-width', regionLineWidth(false), { hoverT: 0.5 })).toBe(1.5);
    // No hover state yet reads as rest.
    expect(paintAt('fill-opacity', regionFillOpacity(false), {})).toBe(0.08);
  });

  it('holds a picked region strong and fades the rest when a region is picked', () => {
    expect(restAndHover('fill-opacity', regionFillOpacity(true), true)).toEqual([0.14, 0.17]);
    expect(restAndHover('fill-opacity', regionFillOpacity(true), false)).toEqual([0.04, 0.09]);
    // A picked outline never thins under the pointer.
    expect(restAndHover('line-width', regionLineWidth(true), true)).toEqual([4.5, 4.5]);
    expect(restAndHover('line-width', regionLineWidth(true), false)).toEqual([1, 2]);
    expect(restAndHover('line-opacity', regionLineOpacity(true), true)).toEqual([1, 1]);
    expect(restAndHover('line-opacity', regionLineOpacity(true), false)).toEqual([0.4, 0.6]);
  });
});

describe('project sort', () => {
  /** A third project, with no update date, so name, date and rank each give a different order. */
  const ASPEN = { ...PROJECTS[0], _id: 'p3', name: 'Aspen Road', centroid: [-126, 54.5] };
  const AZ = ['Aspen Road', 'Cedar Quarry', 'Fir Transmission Line'];
  const RECENTLY_UPDATED = ['Cedar Quarry', 'Fir Transmission Line', 'Aspen Road'];

  async function renderThree(path: string, shown = 3) {
    projectFixtures = [
      { ...PROJECTS[1], dateUpdated: '2026-03-01T00:00:00.000Z' },
      ASPEN,
      { ...PROJECTS[0], dateUpdated: '2026-04-01T00:00:00.000Z' },
    ];
    keywordResults = () => [{ _id: 'p2' }, { _id: 'p3' }, { _id: 'p1' }];
    const router = renderProjects(path);
    await waitFor(() => expect(cards()).toHaveLength(shown));
    return router;
  }

  function sortOptions(): string[] {
    return within(screen.getByLabelText('Sort'))
      .getAllByRole('option')
      .map((option) => option.textContent ?? '');
  }

  it('keeps the server order under Relevance by default with no keywords', async () => {
    const router = await renderThree('/projects');

    // The fixture list is out of name order, so any client sort would show.
    expect(titles()).toEqual(['Fir Transmission Line', 'Aspen Road', 'Cedar Quarry']);
    expect(screen.getByLabelText('Sort')).toHaveDisplayValue('Relevance');
    expect(sortOptions()).toEqual(['Relevance', 'Name A-Z', 'Recently updated']);
    expect(router.state.location.search).toBe('');
  });

  it('keeps the demi-search order by default while searching', async () => {
    await renderThree('/projects?applicant=road');

    expect(titles()).toEqual(['Fir Transmission Line', 'Aspen Road', 'Cedar Quarry']);
    expect(screen.getByLabelText('Sort')).toHaveDisplayValue('Relevance');
  });

  it('reorders the search results by name and writes the choice to the URL', async () => {
    const router = await renderThree('/projects?applicant=road');

    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Name A-Z');

    await waitFor(() => expect(router.state.location.search).toBe('?applicant=road&sort=name'));
    expect(titles()).toEqual(AZ);
  });

  it('sorts by most recently updated, undated last', async () => {
    const router = await renderThree('/projects');

    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Recently updated');
    await waitFor(() => expect(router.state.location.search).toBe('?sort=updated'));
    expect(titles()).toEqual(RECENTLY_UPDATED);
  });

  it('drops the sort from the URL when Relevance is picked again, and says the new order', async () => {
    const router = await renderThree('/projects?sort=name');

    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Relevance');

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByTestId('results-count')).toHaveTextContent(
      '3 projects in view. Sorted by Relevance',
    );
    expect(screen.getByText('. Sorted by Relevance')).toHaveClass('visually-hidden');
  });

  it('says the new order once, not again with the next count', async () => {
    await renderThree('/projects');

    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Name A-Z');
    expect(screen.getByTestId('results-count')).toHaveTextContent(
      '3 projects in view. Sorted by Name A-Z',
    );

    // A box around Cedar Quarry only.
    act(() => mapBounds.set({ north: 55, south: 53, east: -126, west: -129 }));

    await waitFor(() => expect(cards().length).toBeLessThan(3));
    expect(screen.getByTestId('results-count')).toHaveTextContent(/^\d+ projects? in view$/);
  });

  it('keeps the sort when the filters are cleared', async () => {
    const router = await renderThree('/projects?regions=r1&sort=updated', 2);

    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => expect(router.state.location.search).toBe('?sort=updated'));
  });

  it('restores the sort a shared link carries', async () => {
    await renderThree('/projects?sort=updated');

    expect(screen.getByLabelText('Sort')).toHaveDisplayValue('Recently updated');
    expect(titles()).toEqual(RECENTLY_UPDATED);
  });
});

describe('projects map', () => {
  it('renders one pin per project and opens the info card on a pin click', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);

    await userEvent.click(pinFor('p1'));

    const popup = await screen.findByTestId('map-popup');
    expect(popup).toHaveAttribute('role', 'dialog');
    expect(popup).toHaveClass('map-info');
    expect(within(popup).getByRole('heading', { name: 'Cedar Quarry' })).toBeInTheDocument();
    expect(within(popup).getByText('Cedar Holdings · Mines / Mining')).toBeInTheDocument();
    expect(cardFor('Cedar Quarry')).toHaveAttribute('aria-current', 'true');
    expect(cardFor('Fir Transmission Line')).not.toHaveAttribute('aria-current');
  });

  it('highlights the pin from the card and the card from the pin', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.hover(cardFor('Cedar Quarry'));
    expect(pinFor('p1')).toHaveClass('is-hovered');
    expect(pinFor('p2')).not.toHaveClass('is-hovered');

    await userEvent.unhover(cardFor('Cedar Quarry'));
    await userEvent.hover(pinFor('p2'));
    expect(cardFor('Fir Transmission Line')).toHaveClass('is-hovered');
    expect(cardFor('Cedar Quarry')).not.toHaveClass('is-hovered');
  });

  it('flies to the project a card selects', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(cardFor('Fir Transmission Line'));

    expect(fakeMap.flyTo).toHaveBeenCalledTimes(1);
    const options = fakeMap.flyTo.mock.calls[0][0] as { center: [number, number]; zoom: number };
    expect(options.center).toEqual([-120.1, 56.4]);
    expect(options.zoom).toBeGreaterThanOrEqual(10);
  });

  it('selects and flies to the project a link names in `selected`', async () => {
    renderProjects('/projects?selected=p2');
    await screen.findByText('Application Review');

    expect(cardFor('Fir Transmission Line')).toHaveAttribute('aria-current', 'true');
    expect(cardFor('Cedar Quarry')).not.toHaveAttribute('aria-current');
    const popup = await screen.findByTestId('map-popup');
    expect(
      within(popup).getByRole('heading', { name: 'Fir Transmission Line' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fakeMap.flyTo).toHaveBeenCalledTimes(1));
    const options = fakeMap.flyTo.mock.calls[0][0] as { center: [number, number] };
    expect(options.center).toEqual([-120.1, 56.4]);
  });

  it('takes `selected` out of the URL once the visitor clears the selection', async () => {
    const router = renderProjects('/projects?selected=p2&type=Mines');
    await screen.findByText('Application Review');
    expect(new URLSearchParams(router.state.location.search).get('selected')).toBe('p2');

    await userEvent.click(cardFor('Fir Transmission Line'));

    expect(cardFor('Fir Transmission Line')).not.toHaveAttribute('aria-current');
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).has('selected')).toBe(false),
    );
    expect(new URLSearchParams(router.state.location.search).get('type')).toBe('Mines');
  });

  it('selects the project a later link names while the page stays open', async () => {
    const router = renderProjects('/projects?selected=p2');
    await screen.findByText('Application Review');
    expect(cardFor('Fir Transmission Line')).toHaveAttribute('aria-current', 'true');

    await act(() => router.navigate('/projects?selected=p1'));

    expect(cardFor('Cedar Quarry')).toHaveAttribute('aria-current', 'true');
    expect(cardFor('Fir Transmission Line')).not.toHaveAttribute('aria-current');
  });

  it('selects nothing and frames every pin when the linked project is not in the list', async () => {
    renderProjects('/projects?selected=gone');
    await screen.findByText('Application Review');

    expect(cards().filter((card) => card.hasAttribute('aria-current'))).toEqual([]);
    expect(screen.queryByTestId('map-popup')).not.toBeInTheDocument();
    expect(fakeMap.flyTo).not.toHaveBeenCalled();
    // The two fixture centroids, so the stale id did not hold back the refit.
    await waitFor(() =>
      expect(fakeMap.fitBounds).toHaveBeenLastCalledWith(
        [-127.5, 54.2, -120.1, 56.4],
        expect.objectContaining({ padding: 48 }),
      ),
    );
  });

  it('shrinks the list to the map view without dropping pins', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    expect(cards()).toHaveLength(2);

    // A box around Cedar Quarry only.
    act(() => mapBounds.set({ north: 55, south: 53, east: -126, west: -129 }));

    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(screen.getByTestId('results-count')).toHaveTextContent('1 project in view');
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
  });

  it('zooms to a cluster on click', async () => {
    fakeMap.setFeatures([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-125.5, 55.5] },
        properties: { cluster: true, cluster_id: 7, point_count: 12 },
      },
    ]);
    renderProjects();
    await screen.findByText('Application Review');

    const cluster = await screen.findByTestId('map-cluster');
    expect(cluster).toHaveTextContent('12');

    await userEvent.click(cluster);

    await waitFor(() => expect(fakeMap.getClusterExpansionZoom).toHaveBeenCalledWith(7));
    await waitFor(() =>
      expect(fakeMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({ center: [-125.5, 55.5], zoom: 11 }),
      ),
    );
  });

  it('closes the info card on a map click that hits no region or pin', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(cardFor('Cedar Quarry'));
    await screen.findByTestId('map-popup');

    const onClick = mapProps?.['onClick'] as (event: unknown) => void;
    act(() =>
      onClick({ features: [], point: { x: 40, y: 60 }, originalEvent: { target: document.body } }),
    );

    expect(screen.queryByTestId('map-popup')).not.toBeInTheDocument();
    expect(cardFor('Cedar Quarry')).not.toHaveAttribute('aria-current');
  });

  it('leaves the info card open when the map click came from a marker', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(cardFor('Cedar Quarry'));
    await screen.findByTestId('map-popup');
    // The real map wraps each marker in this element; the test double does not.
    const marker = document.createElement('div');
    marker.className = 'maplibregl-marker';
    const target = marker.appendChild(document.createElement('button'));

    const onClick = mapProps?.['onClick'] as (event: unknown) => void;
    act(() => onClick({ features: [], point: { x: 40, y: 60 }, originalEvent: { target } }));

    expect(screen.getByTestId('map-popup')).toHaveTextContent('Cedar Quarry');
  });

  it('closes the info card on Escape and returns focus to the card that opened it', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    const card = cardFor('Cedar Quarry');
    await userEvent.click(card);
    await screen.findByTestId('map-popup');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('map-popup')).toBeNull());
    expect(card).toHaveFocus();
  });

  it('keeps the search ranking, also once the map narrows the list', async () => {
    const NAMES = ['Trans Mountain Expansion', 'Kitimat Transload', 'Northern Transmission Line'];
    projectFixtures = [
      { ...PROJECTS[1], _id: 'n1', name: NAMES[2] },
      { ...PROJECTS[0], _id: 'k1', name: NAMES[1], centroid: [-135, 59] },
      { ...PROJECTS[0], _id: 't1', name: NAMES[0] },
    ];
    keywordResults = () => [{ _id: 't1' }, { _id: 'k1' }, { _id: 'n1' }];
    renderProjects('/projects?applicant=trans');
    await screen.findAllByText(NAMES[0]);
    const order = () =>
      cards().map((card) => NAMES.find((name) => card.textContent?.includes(name)));
    expect(order()).toEqual(NAMES);

    // A box around the two outer matches only; the middle one lies to the north-west of it.
    act(() => mapBounds.set({ north: 57, south: 53, east: -119, west: -129 }));
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(order()).toEqual([NAMES[0], NAMES[2]]);
  });

  it('pages the list far enough to show a project selected past the first page', async () => {
    projectFixtures = Array.from({ length: LIST_PAGE_SIZE + 2 }, (_, index) => ({
      ...PROJECTS[0],
      _id: `x${index}`,
      name: `Paged Project ${index}`,
      centroid: [-127.5 + index * 0.01, 54.2],
    }));
    renderProjects();
    await screen.findByText('Paged Project 0');
    expect(cards()).toHaveLength(LIST_PAGE_SIZE);

    await userEvent.click(pinFor(`x${LIST_PAGE_SIZE + 1}`));

    await waitFor(() =>
      expect(cardFor(`Paged Project ${LIST_PAGE_SIZE + 1}`)).toHaveAttribute(
        'aria-current',
        'true',
      ),
    );
  });

  it('rebuilds the marker set when the map repaints, without waiting for a move to end', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);

    // What a mid-animation repaint looks like: the clustering worker has replaced the two pins.
    act(() =>
      fakeMap.setFeatures([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-125.5, 55.5] },
          properties: { cluster: true, cluster_id: 3, point_count: 2 },
        },
      ]),
    );

    await waitFor(() => expect(screen.getByTestId('map-cluster')).toHaveTextContent('2'));
    expect(screen.queryAllByTestId('map-marker')).toHaveLength(0);
  });

  it('leaves the markers alone while the source is still clustering', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    fakeMap.setSourceLoaded(false);
    act(() =>
      fakeMap.setFeatures([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-125.5, 55.5] },
          properties: { cluster: true, cluster_id: 3, point_count: 2 },
        },
      ]),
    );

    expect(screen.queryByTestId('map-cluster')).toBeNull();
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
  });

  it('remembers the base layer picked from the Layers menu', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(screen.getByRole('button', { name: 'Map layers' }));
    await userEvent.click(screen.getByRole('radio', { name: 'World Imagery' }));

    expect(baseLayerName.get()).toBe('World Imagery');
  });
});

describe('eao region overlay', () => {
  it('draws every region polygon when no region filter is set', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-filter', 'null');
    expect(layerFor('eao-regions-line')).toHaveAttribute('data-filter', 'null');
    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-visibility', 'visible');
    expect(requests).toContain('/assets/geojson/eao-regions.geojson');
  });

  it('marks the filtered regions as picked, under the polygon spelling', async () => {
    renderProjects('/projects?regions=r3');
    await screen.findByText('No projects found');

    // r3 is "Thompson-Nicola" in the region list and "Thompson" in the shapefile.
    await waitFor(() =>
      expect(fakeMap.setFeatureState).toHaveBeenCalledWith(
        { source: 'eao-regions', id: 'Thompson' },
        { selected: true },
      ),
    );
    expect(fakeMap.setFeatureState).toHaveBeenCalledWith(
      { source: 'eao-regions', id: 'Peace' },
      { selected: false },
    );
    // Every polygon still draws; the unpicked ones only recede.
    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-filter', 'null');
  });

  it('picks a region from a polygon click and drops it on a second click', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');
    const fitsBefore = fakeMap.fitBounds.mock.calls.length;

    await pickRegion('Peace');

    await waitFor(() => expect(router.state.location.search).toBe('?regions=r2'));
    expect(cards()).toHaveLength(1);
    expect(cardFor('Fir Transmission Line')).toBeInTheDocument();
    expect(pinIds()).toEqual(['p2']);
    expect(screen.getByTestId('map-region-tip')).toHaveTextContent('Peace');
    expect(fakeMap.setFeatureState).toHaveBeenCalledWith(
      { source: 'eao-regions', id: 'Peace' },
      { selected: true },
    );
    // One fit, to the clicked polygon; the filter change does not refit on top of it.
    expect(fakeMap.fitBounds.mock.calls.slice(fitsBefore)).toEqual([
      [[-122, 55, -119, 58], expect.objectContaining({ padding: 30, maxZoom: 9 })],
    ]);

    await pickRegion('Peace');

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(cards()).toHaveLength(2);
    expect(fakeMap.fitBounds.mock.calls.length).toBe(fitsBefore + 1);
  });

  it('keeps the open project card when a polygon is clicked', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(cardFor('Fir Transmission Line'));
    expect(await screen.findByTestId('map-popup')).toBeInTheDocument();

    await pickRegion('Peace');

    await waitFor(() => expect(router.state.location.search).toBe('?regions=r2'));
    expect(screen.getByTestId('map-popup')).toHaveTextContent('Fir Transmission Line');
  });

  it('closes a card the picked region filters out, and later filter changes still refit', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(cardFor('Fir Transmission Line'));
    expect(await screen.findByTestId('map-popup')).toBeInTheDocument();

    await pickRegion('Thompson');

    await waitFor(() => expect(router.state.location.search).toBe('?regions=r3'));
    expect(screen.queryByTestId('map-popup')).toBeNull();
    expect(fakeMap.fitBounds).toHaveBeenLastCalledWith(
      [-121, 50, -119, 52],
      expect.objectContaining({ padding: 30 }),
    );

    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(fakeMap.fitBounds.mock.lastCall?.[1]).toMatchObject({ padding: 48 });
  });

  it('refits after a panel change even when a picked region did not move the extent', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');

    await pickRegion('Peace');
    await waitFor(() => expect(router.state.location.search).toBe('?regions=r2'));
    // Omineca sits inside Peace's box, so this pick leaves the framed extent as it was.
    await pickRegion('Omineca');
    await waitFor(() => expect(router.state.location.search).toBe('?regions=r2%2Cr4'));
    const fits = fakeMap.fitBounds.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: /Filters/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(fakeMap.fitBounds.mock.calls.length).toBe(fits + 1);
    expect(fakeMap.fitBounds.mock.lastCall?.[1]).toMatchObject({ padding: 48 });
  });

  it('leaves a double-click to the zoom: no pick, no event, no fit', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(mapProps?.['onDblClick']).toBeDefined());
    const fits = fakeMap.fitBounds.mock.calls.length;
    track.mockClear();
    vi.useFakeTimers();

    clickRegion('Peace');
    clickRegion('Peace');
    act(() => (mapProps?.['onDblClick'] as () => void)());
    await advance(DBLCLICK_WINDOW_MS);

    expect(router.state.location.search).toBe('');
    expect(track).not.toHaveBeenCalled();
    expect(fakeMap.fitBounds.mock.calls.length).toBe(fits);
  });

  it('picks on a lone click once the double-click window has passed', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(mapProps?.['onClick']).toBeDefined());
    vi.useFakeTimers();

    clickRegion('Peace');
    await advance(DBLCLICK_WINDOW_MS - 1);
    expect(router.state.location.search).toBe('');

    await advance(1);
    expect(router.state.location.search).toBe('?regions=r2');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('reports a region picked on the map like one picked in the panel', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    const applied = () => track.mock.calls.filter(([name]) => name === 'Project Filters Applied');

    await pickRegion('Peace');

    expect(applied()).toHaveLength(1);
    expect(track).toHaveBeenLastCalledWith(
      'Project Filters Applied',
      expect.objectContaining({ regions_count: 1, total_filters: 1 }),
    );

    await pickRegion('Peace');

    expect(applied()).toHaveLength(2);
    expect(track).toHaveBeenLastCalledWith(
      'Project Filters Applied',
      expect.objectContaining({ regions_count: 0, total_filters: 0 }),
    );
  });

  it('clears the region name, highlight and cursor when the pointer leaves the map', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    moveOverRegion('Peace');

    await waitFor(() => expect(hoverAmount('Peace')).toBe(1));

    act(() => mapProps?.onMouseOut?.());

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
    expect(fakeMap.getCanvas().style.cursor).toBe('');
    await waitFor(() => expect(hoverAmount('Peace')).toBe(0));
  });

  it('clears the region name and highlight when the visitor drags the map', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    moveOverRegion('Peace');

    await waitFor(() => expect(hoverAmount('Peace')).toBe(1));

    act(() => mapProps?.onMoveStart?.({ originalEvent: new MouseEvent('mousedown') }));

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
    await waitFor(() => expect(hoverAmount('Peace')).toBe(0));
  });

  it('leaves the filter alone for a polygon with no region in the list', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');

    await pickRegion('Atlantis');

    expect(router.state.location.search).toBe('');
    expect(cards()).toHaveLength(2);
  });

  it('opens on the whole selected regions, not on the projects left inside them', async () => {
    renderProjects('/projects?regions=r2,r3');
    await screen.findByText('Pre-Application');

    // Union of the two fixture polygons; the one matching project sits at [-120.1, 56.4].
    await waitFor(() =>
      expect(fakeMap.fitBounds).toHaveBeenLastCalledWith([-122, 50, -119, 58], expect.anything()),
    );
    expect(fakeMap.fitBounds.mock.lastCall?.[1]).toMatchObject({ padding: 48, maxZoom: 10 });
  });

  it('names the region under the pointer and highlights that polygon', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    moveOverRegion('Peace');

    const tip = screen.getByTestId('map-region-tip');
    expect(tip).toHaveTextContent('Peace');
    expect(fakeMap.getCanvas().style.cursor).toBe('pointer');
    // Offset from the pointer, so the cursor never covers the label.
    expect(tip).toHaveStyle({ left: '52px', top: '72px' });
    await waitFor(() => expect(hoverAmount('Peace')).toBe(1));
  });

  it('drops the region name and the highlight when the pointer leaves', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    moveOverRegion('Peace');
    await waitFor(() => expect(hoverAmount('Peace')).toBe(1));

    act(() => mapProps?.onMouseLeave?.());

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
    expect(fakeMap.getCanvas().style.cursor).toBe('');
    await waitFor(() => expect(hoverAmount('Peace')).toBe(0));
  });

  it('leaves the region unnamed while a pin is hovered', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.hover(pinFor('p1'));
    moveOverRegion('Peace');

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
  });

  it('hides the polygons when the Layers menu unchecks them', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(screen.getByRole('button', { name: 'Map layers' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Regions' }));

    expect(regionsVisible.get()).toBe(false);
    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-visibility', 'none');
    expect(layerFor('eao-regions-line')).toHaveAttribute('data-visibility', 'none');
  });
});

describe('projects map on a phone', () => {
  beforeEach(() => stubViewport(false));

  it('picks a tapped region at once, naming and lighting it only for a moment', async () => {
    const router = renderProjects();
    await screen.findByText('Application Review');
    // The map is lazy-loaded; its handlers exist once it has mounted.
    await waitFor(() => expect(mapProps?.['onClick']).toBeDefined());
    vi.useFakeTimers();

    clickRegion('Peace');

    // A double tap zooms without a `dblclick`, so a tap does not wait out the window.
    expect(router.state.location.search).toBe('?regions=r2');
    expect(screen.getByTestId('map-region-tip')).toHaveTextContent('Peace');

    await advance(1000);
    expect(hoverAmount('Peace')).toBe(1);

    await advance(1000);

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
    expect(hoverAmount('Peace')).toBe(0);
  });

  it('scrolls the sheet list back to the top when a tapped region narrows it', async () => {
    const scrolls = watchListScroll();
    renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(mapProps?.['onClick']).toBeDefined());

    clickRegion('Peace');

    await waitFor(() => expect(scrolls()).toEqual([0]));
  });

  it('drops a tapped region name and highlight when the layout switches to desktop', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(mapProps?.['onClick']).toBeDefined());
    clickRegion('Peace');
    await waitFor(() => expect(hoverAmount('Peace')).toBe(1));

    stubViewport(true);
    // Any render reads the media queries again.
    await userEvent.hover(cardFor('Fir Transmission Line'));

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
    await waitFor(() => expect(hoverAmount('Peace')).toBe(0));
  });

  it('cycles the sheet through its three heights', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    const sheet = document.querySelector('.app-list') as HTMLElement;
    const handle = document.querySelector('.sheet-handle') as HTMLElement;
    expect(sheet).toHaveAttribute('data-state', 'peek');

    await userEvent.click(handle);
    expect(sheet).toHaveAttribute('data-state', 'half');

    await userEvent.click(handle);
    expect(sheet).toHaveAttribute('data-state', 'full');

    await userEvent.click(handle);
    expect(sheet).toHaveAttribute('data-state', 'peek');
  });

  it('raises and lowers the sheet from the focused handle', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    const sheet = document.querySelector('.app-list') as HTMLElement;
    const handle = document.querySelector('.sheet-handle') as HTMLElement;
    handle.focus();

    await userEvent.keyboard('{ArrowUp}');
    expect(sheet).toHaveAttribute('data-state', 'half');

    await userEvent.keyboard('{ArrowUp}');
    expect(sheet).toHaveAttribute('data-state', 'full');

    // Full is the ceiling: ArrowUp there must not wrap back round to peek.
    await userEvent.keyboard('{ArrowUp}');
    expect(sheet).toHaveAttribute('data-state', 'full');

    await userEvent.keyboard('{ArrowDown}');
    expect(sheet).toHaveAttribute('data-state', 'half');

    await userEvent.keyboard('{ArrowDown}');
    expect(sheet).toHaveAttribute('data-state', 'peek');

    await userEvent.keyboard('{ArrowDown}');
    expect(sheet).toHaveAttribute('data-state', 'peek');
  });

  it('drags the sheet to a new height and swallows the click the drag ends in', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    const sheet = document.querySelector('.app-list') as HTMLElement;
    const handle = document.querySelector('.sheet-handle') as HTMLElement;
    Object.defineProperty(sheet, 'offsetHeight', { value: 400, configurable: true });
    sheet.style.setProperty('--sheet-peek', '88px');

    // Peek sits 312px down, half 200px down: 150px of drag lands nearest half.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 350 });
    expect(sheet).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 350 });

    expect(sheet).toHaveAttribute('data-state', 'half');
    expect(sheet).not.toHaveAttribute('data-dragging');

    // The browser fires a click after the drag; it must not cycle on to full.
    fireEvent.click(handle);
    expect(sheet).toHaveAttribute('data-state', 'half');
  });

  it('expands the selected project inside its list card instead of a card on the map', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(pinFor('p1'));

    const card = cardFor('Cedar Quarry');
    await waitFor(() => expect(card).toHaveAttribute('aria-expanded', 'true'));
    const body = bodyOf(card);
    // The description toggle and the footer button, under the card that names and phases it.
    expect(within(body).queryByText('Application Review')).toBeNull();
    expect(within(body).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(body).getByRole('button', { name: 'View project' })).toBeInTheDocument();
    // No title of its own: the card button above is the accordion header.
    expect(within(body).queryByRole('heading', { name: 'Cedar Quarry' })).toBeNull();
    expect(body).toHaveAttribute('data-open', 'true');

    // Selected from the map, so the list card takes focus and comes into view at the top.
    expect(card).toHaveFocus();
    expect(card.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    // The pin tap raises the sheet, and nothing renders above the list any more.
    expect(sheetState.get()).toBe('full');
    expect(document.querySelector('.app-list__selected')).toBeNull();
    expect(screen.queryByTestId('map-popup')).toBeNull();
  });

  it('collapses the expanded card when it is tapped again', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(pinFor('p1'));
    const card = cardFor('Cedar Quarry');
    const body = bodyOf(card);

    await userEvent.click(card);

    expect(card).toHaveAttribute('aria-expanded', 'false');
    expect(body).not.toHaveAttribute('data-open');
    // Still mounted, but inert, while the row shrinks; gone once the transition ends.
    expect(body).toHaveAttribute('inert');
    expect(within(body).getByRole('button', { name: 'View project' })).toBeInTheDocument();
    fireEvent.transitionEnd(body);
    expect(within(body).queryByRole('button', { name: 'View project' })).toBeNull();
  });

  it('moves the expanded body to the card that is tapped next', async () => {
    renderProjects();
    await screen.findByText('Application Review');
    await userEvent.click(pinFor('p1'));

    await userEvent.click(cardFor('Fir Transmission Line'));

    expect(cardFor('Cedar Quarry')).toHaveAttribute('aria-expanded', 'false');
    const fir = cardFor('Fir Transmission Line');
    expect(fir).toHaveAttribute('aria-expanded', 'true');
    expect(within(bodyOf(fir)).getByRole('button', { name: 'View project' })).toBeInTheDocument();
    expect(bodyOf(cardFor('Cedar Quarry'))).not.toHaveAttribute('data-open');
  });
});

describe('project detail popup', () => {
  it('shows the open comment period of the selected pin above its card', async () => {
    commentPeriodResponders.set('open', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp1', project: 'p1', ...OPEN_DATES }])),
    );
    renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(pinFor('p1')).toHaveAttribute('data-engagement', 'open'));

    await userEvent.click(pinFor('p1'));

    const popup = await screen.findByTestId('map-popup');
    expect(within(popup).getByRole('region', { name: 'Open for public comment' })).toBeVisible();
    expect(within(popup).getByRole('link', { name: 'Share your thoughts' })).toHaveAttribute(
      'href',
      '/p/p1/cp/cp1/details',
    );
  });

  it('draws no banner for a pin with no open or upcoming period', async () => {
    commentPeriodResponders.set('open', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp1', project: 'p1', ...OPEN_DATES }])),
    );
    renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(pinFor('p1')).toHaveAttribute('data-engagement', 'open'));

    await userEvent.click(pinFor('p2'));

    const popup = await screen.findByTestId('map-popup');
    expect(
      within(popup).getByRole('heading', { name: 'Fir Transmission Line' }),
    ).toBeInTheDocument();
    expect(within(popup).queryByRole('region')).toBeNull();
  });

  it('expands the clamped description', async () => {
    renderProjects();
    await screen.findByText('Application Review');

    await userEvent.click(pinFor('p1'));
    const popup = await screen.findByTestId('map-popup');
    const description = popup.querySelector('.popup-desc') as HTMLElement;

    expect(description.innerHTML).toMatch(/^<p>A quarry near Cedar Creek\. /);
    expect(description.innerHTML).not.toContain('MsoNormal');
    expect(description).toHaveClass('is-clamped');

    const more = within(popup).getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(more);

    expect(description).not.toHaveClass('is-clamped');
    expect(within(popup).getByRole('button', { name: 'Less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('engagement markers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('marks open and upcoming pins, and says the state in the pin label', async () => {
    commentPeriodResponders.set('open', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp1', project: 'p1', ...OPEN_DATES }])),
    );
    commentPeriodResponders.set('upcoming', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp2', project: 'p2', ...UPCOMING_DATES }])),
    );
    renderProjects();
    await screen.findByText('Application Review');

    await waitFor(() => expect(pinFor('p2')).toHaveAttribute('data-engagement', 'upcoming'));
    expect(pinFor('p2')).toHaveClass('is-upcoming');
    expect(pinFor('p2')).toHaveTextContent(
      'Fir Transmission Line, public comment period coming soon',
    );
    expect(pinFor('p1')).toHaveAttribute('data-engagement', 'open');
    expect(pinFor('p1')).toHaveClass('is-open');
    expect(pinFor('p1')).toHaveTextContent('Cedar Quarry, open for public comment');
  });

  it('marks a pin open once its period opens, without a new fetch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const dateStarted = new Date(Date.now() + 30_000).toISOString();
    commentPeriodResponders.set('upcoming', async () =>
      jsonResponse(
        periodEnvelope([{ _id: 'cp2', project: 'p2', dateStarted, dateCompleted: '2099-01-01' }]),
      ),
    );
    renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(pinFor('p2')).toHaveAttribute('data-engagement', 'upcoming'));
    const sent = requests.length;

    await advance(60_000);

    expect(pinFor('p2')).toHaveAttribute('data-engagement', 'open');
    expect(requests).toHaveLength(sent);
  });

  it('marks a cluster by the most urgent state among its members', async () => {
    fakeMap.setFeatures([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-125.5, 55.5] },
        properties: {
          cluster: true,
          cluster_id: 7,
          point_count: 12,
          openCount: 1,
          upcomingCount: 4,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-121.5, 50.5] },
        properties: {
          cluster: true,
          cluster_id: 8,
          point_count: 5,
          openCount: 0,
          upcomingCount: 2,
        },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-118.5, 49.5] },
        properties: {
          cluster: true,
          cluster_id: 9,
          point_count: 3,
          openCount: 0,
          upcomingCount: 0,
        },
      },
    ]);
    renderProjects();
    await screen.findByText('Application Review');

    const clusters = await screen.findAllByTestId('map-cluster');
    const byCount = (count: string) => clusters.find((item) => item.textContent === count);
    expect(byCount('12')).toHaveAttribute('data-engagement', 'open');
    expect(byCount('5')).toHaveAttribute('data-engagement', 'upcoming');
    expect(byCount('3')).not.toHaveAttribute('data-engagement');
  });

  it('keeps the upcoming markers when the open read fails, and logs the failure', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    commentPeriodResponders.set('open', async () => new Response('', { status: 500 }));
    commentPeriodResponders.set('upcoming', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp2', project: 'p2', ...UPCOMING_DATES }])),
    );
    renderProjects();
    await screen.findByText('Application Review');

    await waitFor(() => expect(pinFor('p2')).toHaveAttribute('data-engagement', 'upcoming'));
    expect(pinFor('p1')).not.toHaveAttribute('data-engagement');
    expect(error).toHaveBeenCalledWith(
      'Error loading comment periods',
      'Projects',
      expect.anything(),
    );
  });

  it('shows the banner inside the expanded list card on a phone', async () => {
    stubViewport(false);
    commentPeriodResponders.set('open', async () =>
      jsonResponse(periodEnvelope([{ _id: 'cp1', project: 'p1', ...OPEN_DATES }])),
    );
    renderProjects();
    await screen.findByText('Application Review');
    await waitFor(() => expect(pinFor('p1')).toHaveAttribute('data-engagement', 'open'));

    await userEvent.click(pinFor('p1'));

    const body = bodyOf(cardFor('Cedar Quarry'));
    expect(within(body).getByRole('region', { name: 'Open for public comment' })).toBeVisible();
    expect(within(body).getByRole('link', { name: 'Share your thoughts' })).toHaveAttribute(
      'href',
      '/p/p1/cp/cp1/details',
    );
  });
});

describe('snapSheet', () => {
  // A 400px sheet showing an 88px peek: peek sits 312px down, half 200px, full 0.
  const HEIGHT = 400;
  const PEEK = 88;

  it('keeps the state a drag under the threshold started in', () => {
    expect(snapSheet('peek', -39, HEIGHT, PEEK)).toBe('peek');
    expect(snapSheet('half', 39, HEIGHT, PEEK)).toBe('half');
  });

  it('snaps to the nearest stop the drag headed towards, skipping past the next one', () => {
    // 312 - 300 leaves the sheet 12px from the top: past half, so full wins.
    expect(snapSheet('peek', -300, HEIGHT, PEEK)).toBe('full');
    expect(snapSheet('peek', -150, HEIGHT, PEEK)).toBe('half');
    expect(snapSheet('full', 300, HEIGHT, PEEK)).toBe('peek');
    expect(snapSheet('full', 150, HEIGHT, PEEK)).toBe('half');
  });

  it('always moves a drag past the threshold, never back to where it started', () => {
    expect(snapSheet('half', -60, HEIGHT, PEEK)).toBe('full');
    expect(snapSheet('half', 60, HEIGHT, PEEK)).toBe('peek');
  });

  it('stays put when there is no stop left in the drag direction', () => {
    expect(snapSheet('full', -300, HEIGHT, PEEK)).toBe('full');
    expect(snapSheet('peek', 300, HEIGHT, PEEK)).toBe('peek');
  });
});
