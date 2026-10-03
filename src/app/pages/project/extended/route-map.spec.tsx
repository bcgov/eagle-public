import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fakeMap, mapProps } from 'app/pages/projects/maplibre-test-stub';
import { logger } from 'app/config/logging';
import { makeQueryClient } from '../../../../test-utils';
import { CORRIDORS, holdLoad } from './fixtures/route-map-stub';
import { RouteMap, RouteMapThumbnail } from './route-map';
import { RouteLineOptions } from './route-lines';
import { RouteMapBoundary } from './extended-shell';
import type { ExtendedMap, MapLine } from './types';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('./fixtures/route-map-stub')).routeMapLibreStub(),
);

const URL = '/assets/geojson/corridors.geojson';
const LABEL = 'Map of the two proposed corridors';
const TOWNS = [{ name: 'Hope', coordinates: [-121.4, 49.4] as [number, number] }];
const MAP: ExtendedMap = {
  geojsonUrl: URL,
  label: LABEL,
  attribution: '',
  places: TOWNS,
  lines: [
    { id: 'original', label: 'Original', colour: 'line-1', width: 4 },
    { id: 'optimized', label: 'Optimized', colour: 'line-2', width: 3, markers: true },
  ],
};

/** Three made-up lines; the third carries the terminal markers. */
const THREE_LINES: MapLine[] = [
  {
    id: 'north',
    label: 'North route',
    colour: 'line-2',
    width: 5,
    lengthKm: 1500,
    detail: 'Long.',
  },
  { id: 'coast', label: 'Coast route', colour: 'line-1', width: 2 },
  {
    id: 'valley',
    label: 'Valley route',
    colour: 'line-2',
    width: 6,
    markers: true,
    lengthKm: 980,
    detail: 'Short.',
  },
];

/** Three lines and a terminal, spanning lon -123 to -113 and lat 49 to 54. */
const THREE_LINE_DATA = {
  type: 'FeatureCollection',
  features: [
    ...THREE_LINES.map((line, index) => ({
      type: 'Feature',
      properties: { line: line.id },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-113, 53.8],
          [-118 + index, 54],
          [-123, 49.1],
        ],
      },
    })),
    {
      type: 'Feature',
      properties: { kind: 'terminal', name: 'Bruderheim' },
      geometry: { type: 'Point', coordinates: [-113, 49] },
    },
  ],
};

function layerPaint(id: string): Record<string, unknown> {
  const layer = screen.getAllByTestId('layer').find((each) => each.dataset['id'] === id);
  return JSON.parse(layer?.dataset['paint'] ?? 'null') as Record<string, unknown>;
}

/** Each line token reads back as its own name, so a colour says which token it came from. */
function stubLineTokens() {
  const original = CSSStyleDeclaration.prototype.getPropertyValue;
  vi.spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue').mockImplementation(function (
    this: CSSStyleDeclaration,
    name: string,
  ) {
    return name.startsWith('--extended-line-') ? `token(${name})` : original.call(this, name);
  });
}

/** Records the fill colour of every marker image the map draws. */
function recordMarkerFills(): string[] {
  const fills: string[] = [];
  const context = {
    fillStyle: '',
    beginPath: () => undefined,
    roundRect: () => undefined,
    fill() {
      fills.push(context.fillStyle);
    },
    getImageData: () => ({}),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  return fills;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function layerIds() {
  return screen.getAllByTestId('layer').map((layer) => layer.dataset['id']);
}

function stubFetch(answer: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(answer));
}

/** No retry delay, so the one retry the map asks for runs at once. */
function withClient(ui: ReactNode) {
  return render(
    <QueryClientProvider client={makeQueryClient({ retryDelay: 0 })}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  fakeMap.reset();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RouteMap', () => {
  it('says it is loading while the corridor data is on its way', () => {
    stubFetch(() => new Promise<Response>(() => undefined));

    withClient(<RouteMap map={MAP} />);

    expect(screen.getByText('Loading map').parentElement).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  });

  it('says the map could not be loaded when the corridor data fails', async () => {
    stubFetch(async () => json({}, 500));

    withClient(<RouteMap map={MAP} />);

    expect(await screen.findByText('The map could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('Loading map')).not.toBeInTheDocument();
  });

  it('says the map could not be loaded when the data holds nothing to frame', async () => {
    stubFetch(async () => json({ type: 'FeatureCollection', features: [] }));

    withClient(<RouteMap map={MAP} />);

    expect(await screen.findByText('The map could not be loaded.')).toBeInTheDocument();
  });

  it('draws the corridors before the basemap has loaded, and the labels once it has', async () => {
    const fireLoad = holdLoad();
    stubFetch(async () => json(CORRIDORS));

    withClient(<RouteMap map={MAP} />);
    await screen.findByTestId('map');

    expect(layerIds()).toEqual(
      expect.arrayContaining(['route-line-original', 'route-line-optimized']),
    );
    expect(layerIds()).not.toContain('route-towns-label');

    act(() => fireLoad());

    expect(layerIds()).toEqual(
      expect.arrayContaining(['route-towns-label', 'route-terminals-label']),
    );
  });

  it('waits for the new map to load before drawing labels when the data URL changes', async () => {
    stubFetch(async () => json(CORRIDORS));
    const client = makeQueryClient({ retryDelay: 0 });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <RouteMap map={MAP} />
      </QueryClientProvider>,
    );
    await screen.findByTestId('map');
    await vi.waitFor(() => expect(layerIds()).toContain('route-towns-label'));

    const fireLoad = holdLoad();
    rerender(
      <QueryClientProvider client={client}>
        <RouteMap map={{ ...MAP, geojsonUrl: '/assets/other.geojson' }} />
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/assets/other.geojson'));
    await screen.findByTestId('map');
    expect(layerIds()).not.toContain('route-towns-label');

    act(() => fireLoad());

    expect(layerIds()).toContain('route-towns-label');
  });

  it('waits for the map to load again when the data URL goes to another and back', async () => {
    stubFetch(async () => json(CORRIDORS));
    const client = makeQueryClient({ retryDelay: 0 });
    const ui = (geojsonUrl: string) => (
      <QueryClientProvider client={client}>
        <RouteMap map={{ ...MAP, geojsonUrl }} />
      </QueryClientProvider>
    );
    const { rerender } = render(ui(URL));
    await vi.waitFor(() => expect(layerIds()).toContain('route-towns-label'));

    holdLoad();
    rerender(ui('/assets/other.geojson'));
    await screen.findByTestId('map');
    const fireLoad = holdLoad();
    rerender(ui(URL));
    await screen.findByTestId('map');

    expect(layerIds()).not.toContain('route-towns-label');

    act(() => fireLoad());

    expect(layerIds()).toContain('route-towns-label');
  });

  it('frames a line with more vertices than a function call takes arguments', async () => {
    const coordinates = Array.from({ length: 300_000 }, (_, index) => [
      -123 + (index / 300_000) * 10,
      49 + (index / 300_000) * 5,
    ]);
    stubFetch(async () =>
      json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { line: 'original' },
            geometry: { type: 'LineString', coordinates },
          },
        ],
      }),
    );

    withClient(<RouteMap map={MAP} />);
    await screen.findByTestId('map');

    const [[west, south], [east, north]] = (
      mapProps?.['initialViewState'] as { bounds: [[number, number], [number, number]] }
    ).bounds;
    expect([west, south]).toEqual([-123, 49]);
    expect(east).toBeCloseTo(-113, 3);
    expect(north).toBeCloseTo(54, 3);
  });

  it.each([
    'https://example.com/lines.geojson',
    '//example.com/lines.geojson',
    '/\t/example.com/',
    '/\n/example.com/',
    '/\r/example.com/',
    'data:,{}',
  ])('never fetches map data from %s, which is not a site path', async (geojsonUrl) => {
    stubFetch(async () => json(CORRIDORS));

    withClient(<RouteMap map={{ ...MAP, geojsonUrl }} />);

    expect(await screen.findByText('The map could not be loaded.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    // Refused once: a retry would ask the same question and log the same warning again.
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('tries a failed fetch once more before saying the map could not be loaded', async () => {
    stubFetch(async () => json({}, 500));

    withClient(<RouteMap map={MAP} />);

    expect(await screen.findByText('The map could not be loaded.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('frames every geometry type, not only points and lines', async () => {
    stubFetch(async () =>
      json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'MultiPoint', coordinates: [[-130, 50]] },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiLineString',
              coordinates: [
                [
                  [-120, 45],
                  [-119, 46],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-118, 47],
                  [-117, 60],
                  [-118, 47],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'GeometryCollection',
              geometries: [
                {
                  type: 'MultiPolygon',
                  coordinates: [
                    [
                      [
                        [-110, 48],
                        [-111, 49],
                        [-110, 48],
                      ],
                    ],
                  ],
                },
              ],
            },
          },
        ],
      }),
    );

    withClient(<RouteMap map={MAP} />);
    await screen.findByTestId('map');

    expect((mapProps?.['initialViewState'] as { bounds: unknown }).bounds).toEqual([
      [-130, 45],
      [-110, 60],
    ]);
  });

  it('leaves the canvas its default name, since the figure caption already reads the label', async () => {
    stubFetch(async () => json(CORRIDORS));

    withClient(<RouteMap map={MAP} />);
    await screen.findByTestId('map');

    expect(mapProps?.['locale']).toBeUndefined();
  });

  it('opens framed on every corridor and terminal, with no button of its own', async () => {
    stubFetch(async () => json(CORRIDORS));

    withClient(<RouteMap map={MAP} />);
    await screen.findByTestId('map');

    expect(mapProps?.['initialViewState']).toEqual({
      bounds: [
        [-123, 49],
        [-113, 54],
      ],
      fitBoundsOptions: { padding: 48 },
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('RouteMapThumbnail', () => {
  it('is one named image with no controls', async () => {
    stubFetch(async () => json(CORRIDORS));

    withClient(<RouteMapThumbnail map={MAP} label={LABEL} />);

    expect(await screen.findByRole('img', { name: LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('RouteMap with three lines from data', () => {
  const map: ExtendedMap = { ...MAP, lines: THREE_LINES };

  it('draws one layer per line, each filtered to its line, in its own width and colour', async () => {
    stubLineTokens();
    stubFetch(async () => json(THREE_LINE_DATA));

    withClient(<RouteMap map={map} />);
    await screen.findByTestId('map');

    const lineLayers = screen
      .getAllByTestId('layer')
      .filter((layer) => layer.dataset['id']?.startsWith('route-line-'));
    expect(lineLayers.map((layer) => [layer.dataset['id'], layer.dataset['filter']])).toEqual([
      ['route-line-north', JSON.stringify(['==', ['get', 'line'], 'north'])],
      ['route-line-coast', JSON.stringify(['==', ['get', 'line'], 'coast'])],
      ['route-line-valley', JSON.stringify(['==', ['get', 'line'], 'valley'])],
    ]);
    expect(layerPaint('route-line-north')).toEqual({
      'line-color': 'token(--extended-line-2)',
      'line-width': 5,
    });
    expect(layerPaint('route-line-coast')).toEqual({
      'line-color': 'token(--extended-line-1)',
      'line-width': 2,
    });
    expect(layerPaint('route-line-valley')).toEqual({
      'line-color': 'token(--extended-line-2)',
      'line-width': 6,
    });
  });

  it('draws the thumbnail lines one pixel thinner', async () => {
    stubFetch(async () => json(THREE_LINE_DATA));

    withClient(<RouteMapThumbnail map={map} label={LABEL} />);
    await screen.findByTestId('map');

    expect(layerPaint('route-line-valley')['line-width']).toBe(5);
  });

  it('colours the terminal markers like the line flagged for markers', async () => {
    stubLineTokens();
    const fills = recordMarkerFills();
    stubFetch(async () => json(THREE_LINE_DATA));

    withClient(<RouteMap map={map} />);
    await screen.findByTestId('map');

    expect(fills).toContain('token(--extended-line-2)');
    expect(fills).not.toContain('token(--extended-line-1)');
  });
});

describe('RouteLineOptions', () => {
  it('gives each line a tile with its swatch colour, label, length and detail', () => {
    const { container } = render(<RouteLineOptions lines={THREE_LINES} />);

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'North route · 1,500 km',
      'Coast route',
      'Valley route · 980 km',
    ]);
    expect(screen.getAllByRole('definition').map((detail) => detail.textContent)).toEqual([
      'Long.',
      'Short.',
    ]);
    expect(
      [...container.querySelectorAll('.extended-route__swatch')].map(
        (swatch) => swatch.classList[1],
      ),
    ).toEqual([
      'extended-route__swatch--line-2',
      'extended-route__swatch--line-1',
      'extended-route__swatch--line-2',
    ]);
  });
});

describe('RouteMapBoundary', () => {
  function Broken(): ReactNode {
    throw new Error('chunk failed to load');
  }

  beforeEach(() => {
    // React reports the caught throw; the boundary logs it through the app logger.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  it('shows its fallback in place of a map that throws, and the page around it stays', () => {
    render(
      <>
        <p>Route facts</p>
        <RouteMapBoundary fallback={<p>The map could not be loaded.</p>}>
          <Broken />
        </RouteMapBoundary>
      </>,
    );

    expect(screen.getByText('The map could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('Route facts')).toBeInTheDocument();
  });

  it('shows nothing in place of a failed map when given no fallback', () => {
    const { container } = render(
      <div>
        <RouteMapBoundary>
          <Broken />
        </RouteMapBoundary>
      </div>,
    );

    expect(container.firstElementChild).toBeEmptyDOMElement();
  });

  it('renders its map when nothing throws', () => {
    render(
      <RouteMapBoundary fallback={<p>The map could not be loaded.</p>}>
        <p>map body</p>
      </RouteMapBoundary>,
    );

    expect(screen.getByText('map body')).toBeInTheDocument();
    expect(screen.queryByText('The map could not be loaded.')).not.toBeInTheDocument();
  });
});
