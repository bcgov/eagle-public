import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { CORRIDORS } from '../fixtures/route-map-stub';
import { renderBlocks, SAMPLE_PAGE } from '../fixtures/blocks';
import type { ExtendedPage, RouteMapBlock } from '../types';

vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('../fixtures/route-map-stub')).routeMapLibreStub(),
);

const BLOCK: RouteMapBlock = {
  type: 'routeMap',
  id: 'route',
  heading: 'Where it goes',
  optionsHeading: 'Route options',
  facts: ['Runs along the shore.', 'Crosses the Library Act boundary.'],
};

const WITH_MAP: ExtendedPage = {
  ...SAMPLE_PAGE,
  map: {
    geojsonUrl: '/assets/geojson/harbour.geojson',
    label: 'Map of the harbour path',
    attribution: 'Drawn by the city.',
    places: [{ name: 'Harbour', coordinates: [-123, 49] }],
    lines: [{ id: 'north', label: 'North path', colour: 'line-1', width: 3, lengthKm: 12 }],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(CORRIDORS), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('route map block', () => {
  it('draws the page map with its caption and a tile per line, then the facts', async () => {
    renderBlocks([BLOCK], { content: WITH_MAP });

    const section = await screen.findByRole('region', { name: 'Where it goes' });
    expect(within(section).getByText('Map of the harbour path')).toBeInTheDocument();
    expect(within(section).getByRole('heading', { level: 3, name: 'Route options' })).toBeVisible();
    expect(within(section).getByText('North path · 12 km')).toBeInTheDocument();
    const facts = within(section).getAllByRole('listitem');
    expect(facts).toHaveLength(2);
    expect(facts[0]).toHaveTextContent(/^Runs along the shore\.$/);
    expect(facts[1]).toHaveTextContent(/^Crosses the Library Act.* boundary\.$/);
    // Running copy links the page's terms.
    expect(within(section).getByRole('link', { name: /^Library Act/ })).toHaveAttribute(
      'href',
      'https://example.org/library-act',
    );
  });

  it('keeps the heading and facts when the page has no map', async () => {
    renderBlocks([BLOCK]);

    const section = await screen.findByRole('region', { name: 'Where it goes' });
    expect(within(section).queryByRole('figure')).not.toBeInTheDocument();
    expect(within(section).queryByRole('heading', { name: 'Route options' })).toBeNull();
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
  });
});
