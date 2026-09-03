import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { fakeMap, mapProps } from './maplibre-test-stub';
import { Projects } from './projects';
import { filtersToParams, parseFilters } from './filter-state';
import { projectMatchesFilters } from './project-filter';
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
  { _id: 'ph1', type: 'projectPhase', name: 'Application Review', legislation: '2018' },
  { _id: 'ph2', type: 'projectPhase', name: 'Pre-Application', legislation: '2018' },
];

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
  ],
};

let requests: string[];
let projectFixtures: typeof PROJECTS;
let commentPeriodResponders: Map<string, () => Promise<Response>>;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch() {
  requests = [];
  projectFixtures = PROJECTS;
  commentPeriodResponders = new Map();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes('dataset=Project')) {
        return jsonResponse([
          {
            searchResults: projectFixtures,
            meta: [{ searchResultsTotal: projectFixtures.length }],
          },
        ]);
      }
      if (url.includes('dataset=List')) {
        return jsonResponse([
          { searchResults: LISTS, meta: [{ searchResultsTotal: LISTS.length }] },
        ]);
      }
      if (url.includes('eao-regions.geojson')) {
        return jsonResponse(REGION_SHAPES);
      }
      if (url.includes('commentperiod')) {
        const projId = new URL(url, 'http://localhost').searchParams.get('project') ?? '';
        const responder = commentPeriodResponders.get(projId);
        return responder ? responder() : jsonResponse([]);
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

function renderAt(path = '/projects') {
  const router = createMemoryRouter(
    [
      { path: '/projects', Component: Projects },
      { path: '/p/:projId', element: <div>project page</div> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function cards(): HTMLElement[] {
  return screen.getAllByTestId('project-card');
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
function moveOverRegion(regionName: string, id: number, x = 40, y = 60): void {
  act(() =>
    mapProps?.onMouseMove?.({
      features: [
        {
          type: 'Feature',
          id,
          properties: { regionName },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
      point: { x, y },
    }),
  );
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
  vi.unstubAllGlobals();
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
    };
    const params = filtersToParams(filters);

    expect(params.toString()).toBe(
      'regions=r1%2Cr2&phases=ph1&types=mines&applicant=cedar&clFile=123&dispId=456&purpose=quarry' +
        '&publishFrom=2026-01-01&publishTo=2026-06-30',
    );
    expect(parseFilters(params)).toEqual(filters);
  });

  it('leaves empty filters out of the query string', () => {
    expect(filtersToParams(parseFilters(new URLSearchParams())).toString()).toBe('');
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
    renderAt();

    expect(await screen.findByText('Application Review')).toBeInTheDocument();
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
    expect(screen.getByText('Cedar Holdings')).toBeInTheDocument();
    expect(screen.getByText('Fir Power')).toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('2 projects in view');

    const projectRequests = requests.filter((url) => url.includes('dataset=Project'));
    expect(projectRequests).toEqual([
      '/api/search?dataset=Project&pageNum=0&pageSize=1000000&projectLegislation=default&sortBy=&sortBy=&populate=true&fuzzy=false',
    ]);
  });

  it('opens the project details page from the info card a card selection opened', async () => {
    const router = renderAt();
    await screen.findByText('Application Review');

    await userEvent.click(cardFor('Cedar Quarry'));

    const popup = await screen.findByTestId('map-popup');
    await userEvent.click(within(popup).getByRole('button', { name: 'View project' }));

    expect(router.state.location.pathname).toBe('/p/p1');
  });

  it('writes the search box to the URL and narrows the list', async () => {
    const router = renderAt();
    await screen.findByText('Application Review');

    await userEvent.type(screen.getByPlaceholderText('Start typing a project name'), 'fir');

    await waitFor(() => expect(router.state.location.search).toBe('?applicant=fir'));
    expect(screen.getByText('Pre-Application')).toBeInTheDocument();
    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('1 project in view');
  });

  it('clears the search filter out of the URL again', async () => {
    const router = renderAt('/projects?applicant=fir');
    await screen.findByText('Pre-Application');

    await userEvent.click(screen.getByLabelText('Clear search'));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Application Review')).toBeInTheDocument();
  });

  it('applies filters taken from the URL on first load', async () => {
    renderAt('/projects?regions=r2');

    expect(await screen.findByText('Pre-Application')).toBeInTheDocument();
    expect(screen.queryByText('Application Review')).not.toBeInTheDocument();
  });

  it('keeps the filters panel collapsed but counts the filters the URL carries', async () => {
    renderAt('/projects?regions=r2');
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
    renderAt('/projects?applicant=Cedar');
    await screen.findByText('Cedar Quarry');

    const toggle = screen.getByRole('button', { name: /Filters/ });
    expect(within(toggle).queryByText('1')).not.toBeInTheDocument();
  });

  it('closes the filters panel on Escape and returns focus to the Filters button', async () => {
    renderAt();
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

    renderAt();

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

  it('shows "No projects found" when nothing matches', async () => {
    renderAt('/projects?applicant=nothing-matches-this');

    expect(await screen.findByText('No projects found')).toBeInTheDocument();
  });
});

describe('projects map', () => {
  it('renders one pin per project and opens the info card on a pin click', async () => {
    renderAt();
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
    renderAt();
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
    renderAt();
    await screen.findByText('Application Review');

    await userEvent.click(cardFor('Fir Transmission Line'));

    expect(fakeMap.flyTo).toHaveBeenCalledTimes(1);
    const options = fakeMap.flyTo.mock.calls[0][0] as { center: [number, number]; zoom: number };
    expect(options.center).toEqual([-120.1, 56.4]);
    expect(options.zoom).toBeGreaterThanOrEqual(10);
  });

  it('shrinks the list to the map view without dropping pins', async () => {
    renderAt();
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
    renderAt();
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

  it('closes the info card on Escape and returns focus to the card that opened it', async () => {
    renderAt();
    await screen.findByText('Application Review');

    const card = cardFor('Cedar Quarry');
    await userEvent.click(card);
    await screen.findByTestId('map-popup');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('map-popup')).toBeNull());
    expect(card).toHaveFocus();
  });

  it('pages the list far enough to show a project selected past the first page', async () => {
    projectFixtures = Array.from({ length: LIST_PAGE_SIZE + 2 }, (_, index) => ({
      ...PROJECTS[0],
      _id: `x${index}`,
      name: `Paged Project ${index}`,
      centroid: [-127.5 + index * 0.01, 54.2],
    }));
    renderAt();
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
    renderAt();
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
    renderAt();
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
    renderAt();
    await screen.findByText('Application Review');

    await userEvent.click(screen.getByRole('button', { name: 'Map layers' }));
    await userEvent.click(screen.getByRole('radio', { name: 'World Imagery' }));

    expect(baseLayerName.get()).toBe('World Imagery');
  });
});

describe('eao region overlay', () => {
  it('draws every region polygon when no region filter is set', async () => {
    renderAt();
    await screen.findByText('Application Review');

    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-filter', 'true');
    expect(layerFor('eao-regions-line')).toHaveAttribute('data-filter', 'true');
    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-visibility', 'visible');
    expect(requests).toContain('/assets/geojson/eao-regions.geojson');
  });

  it('narrows the polygons to the filtered regions, under the polygon spelling', async () => {
    renderAt('/projects?regions=r2,r3');
    await screen.findByText('Pre-Application');

    // r3 is "Thompson-Nicola" in the region list and "Thompson" in the shapefile.
    const expected = JSON.stringify([
      'in',
      ['get', 'regionName'],
      ['literal', ['Peace', 'Thompson']],
    ]);
    expect(layerFor('eao-regions-fill')).toHaveAttribute('data-filter', expected);
    expect(layerFor('eao-regions-line')).toHaveAttribute('data-filter', expected);
  });

  it('opens on the whole selected regions, not on the projects left inside them', async () => {
    renderAt('/projects?regions=r2,r3');
    await screen.findByText('Pre-Application');

    // Union of the two fixture polygons; the one matching project sits at [-120.1, 56.4].
    await waitFor(() =>
      expect(fakeMap.fitBounds).toHaveBeenLastCalledWith([-122, 50, -119, 58], expect.anything()),
    );
    expect(fakeMap.fitBounds.mock.lastCall?.[1]).toMatchObject({ padding: 48, maxZoom: 10 });
  });

  it('names the region under the pointer and highlights that polygon', async () => {
    renderAt();
    await screen.findByText('Application Review');

    moveOverRegion('Peace', 9);

    const tip = screen.getByTestId('map-region-tip');
    expect(tip).toHaveTextContent('Peace');
    // Offset from the pointer, so the cursor never covers the label.
    expect(tip).toHaveStyle({ left: '52px', top: '72px' });
    expect(fakeMap.setFeatureState).toHaveBeenCalledWith(
      { source: 'eao-regions', id: 9 },
      { hover: true },
    );
  });

  it('drops the region name and the highlight when the pointer leaves', async () => {
    renderAt();
    await screen.findByText('Application Review');
    moveOverRegion('Peace', 9);

    act(() => mapProps?.onMouseLeave?.());

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
    expect(fakeMap.setFeatureState).toHaveBeenLastCalledWith(
      { source: 'eao-regions', id: 9 },
      { hover: false },
    );
  });

  it('leaves the region unnamed while a pin is hovered', async () => {
    renderAt();
    await screen.findByText('Application Review');

    await userEvent.hover(pinFor('p1'));
    moveOverRegion('Peace', 9);

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
  });

  it('hides the polygons when the Layers menu unchecks them', async () => {
    renderAt();
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

  it('cycles the sheet through its three heights', async () => {
    renderAt();
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
    renderAt();
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
    renderAt();
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
    renderAt();
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
    renderAt();
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
    renderAt();
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
  it('fetches the comment period for the selected pin', async () => {
    commentPeriodResponders.set('p1', async () =>
      jsonResponse([{ _id: 'cp1', dateStarted: '2026-01-01', dateCompleted: '2099-01-01' }]),
    );
    renderAt();
    await screen.findByText('Application Review');

    await userEvent.click(pinFor('p1'));

    const popup = await screen.findByTestId('map-popup');
    expect(await within(popup).findByText('Open for comment')).toBeInTheDocument();
    expect(requests).toContain(
      '/api/commentperiod?project=p1&sortBy=-dateStarted&fields=project|dateStarted|dateCompleted|instructions|isMet|metURL|informationLabel',
    );
  });

  it('expands the clamped description', async () => {
    renderAt();
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

  it('ignores the in-flight comment period once another pin is selected', async () => {
    let releaseFirst: (() => void) | undefined;
    commentPeriodResponders.set('p1', async () => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      return jsonResponse([{ _id: 'cp1', dateStarted: '2020-01-01', dateCompleted: '2020-06-01' }]);
    });
    commentPeriodResponders.set('p2', async () =>
      jsonResponse([{ _id: 'cp2', dateStarted: '2026-01-01', dateCompleted: '2099-01-01' }]),
    );

    renderAt();
    await screen.findByText('Application Review');

    await userEvent.click(pinFor('p1'));
    await userEvent.click(pinFor('p2'));

    const popup = await screen.findByTestId('map-popup');
    expect(
      within(popup).getByRole('heading', { name: 'Fir Transmission Line' }),
    ).toBeInTheDocument();
    expect(await within(popup).findByText('Open for comment')).toBeInTheDocument();

    // The first project's closed period lands late; it must not overwrite the second project's chip.
    await act(async () => {
      releaseFirst?.();
      await Promise.resolve();
    });
    expect(within(popup).getByText('Open for comment')).toBeInTheDocument();
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
