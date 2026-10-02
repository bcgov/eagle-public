import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Feature, Point } from 'geojson';
import { makeQueryClient } from '../../../test-utils';
import { fakeMap, mapProps } from './maplibre-test-stub';
import { ProjlistMap } from './projlist-map';

vi.mock('app/analytics/analytics', () => ({ track: vi.fn() }));
vi.mock('@vis.gl/react-maplibre', async () =>
  (await import('./maplibre-test-stub')).mapLibreStub(),
);

const DBLCLICK_WINDOW_MS = 300;

const REGION_SHAPES = {
  type: 'FeatureCollection',
  features: ['Peace', 'Omineca'].map((regionName, index) => ({
    type: 'Feature',
    properties: { regionName },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-122 + index, 55],
          [-119 + index, 55],
          [-119 + index, 58],
          [-122 + index, 55],
        ],
      ],
    },
  })),
};

/** A region fill feature as the map reports it; `promoteId` makes the name its id. */
function regionFeature(regionName: string): Feature<Point> {
  return {
    type: 'Feature',
    id: regionName,
    layer: { id: 'eao-regions-fill' },
    properties: { regionName },
    geometry: { type: 'Point', coordinates: [0, 0] },
  } as Feature<Point>;
}

function hoverAmount(regionName: string): unknown {
  const calls = fakeMap.setFeatureState.mock.calls.filter(
    ([target, state]) => target.id === regionName && 'hoverT' in state,
  );
  return calls.at(-1)?.[1]['hoverT'];
}

function mapElement(regionNames: string[], onRegionToggle: (name: string) => boolean) {
  return (
    <ProjlistMap
      projects={[]}
      loading={false}
      selectedId={null}
      hoveredId={null}
      onSelect={vi.fn()}
      onHover={vi.fn()}
      regionNames={regionNames}
      onRegionToggle={onRegionToggle}
      mobile={false}
      engagementById={undefined}
    />
  );
}

async function renderMap(regionNames: string[] = [], onRegionToggle = vi.fn(() => true)) {
  const queryClient = makeQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      {mapElement(regionNames, onRegionToggle)}
    </QueryClientProvider>,
  );
  // The region layers draw once the shapes have loaded.
  await waitFor(() =>
    expect(
      document.querySelector('[data-testid="layer"][data-id="eao-regions-fill"]'),
    ).not.toBeNull(),
  );
  return {
    rerender: (names: string[]) =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          {mapElement(names, onRegionToggle)}
        </QueryClientProvider>,
      ),
  };
}

function moveOverRegion(regionName: string, x = 40, y = 60): void {
  act(() => mapProps?.onMouseMove?.({ features: [regionFeature(regionName)], point: { x, y } }));
}

function endMove(): void {
  act(() => (mapProps?.['onMoveEnd'] as () => void)());
}

beforeEach(() => {
  fakeMap.reset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(REGION_SHAPES), { status: 200 })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ProjlistMap region tip after the map moves on its own', () => {
  it('names and lights the region now under a still pointer', async () => {
    await renderMap();
    moveOverRegion('Peace');
    await waitFor(() => expect(hoverAmount('Peace')).toBe(1));
    fakeMap.queryRenderedFeatures.mockReturnValue([regionFeature('Omineca')]);

    endMove();

    const tip = screen.getByTestId('map-region-tip');
    expect(tip).toHaveTextContent('Omineca');
    expect(tip).toHaveStyle({ left: '52px', top: '72px' });
    // Both ease, so wait for each to settle.
    await waitFor(() => expect(hoverAmount('Omineca')).toBe(1));
    await waitFor(() => expect(hoverAmount('Peace')).toBe(0));
  });

  it('shows no tip once the pointer has left the map', async () => {
    await renderMap();
    moveOverRegion('Peace');
    act(() => mapProps?.onMouseOut?.());
    fakeMap.queryRenderedFeatures.mockReturnValue([regionFeature('Omineca')]);

    endMove();

    expect(screen.queryByTestId('map-region-tip')).toBeNull();
  });
});

describe('ProjlistMap deferred region pick', () => {
  it('reads the Region filter when the pick runs, not when the click landed', async () => {
    const onRegionToggle = vi.fn(() => true);
    const map = await renderMap([], onRegionToggle);
    vi.useFakeTimers();

    act(() =>
      (mapProps?.['onClick'] as (event: unknown) => void)({
        features: [regionFeature('Peace')],
        point: { x: 40, y: 60 },
        originalEvent: { target: document.body },
      }),
    );
    // The panel picks Peace inside the double-click window, so the map click now drops it.
    map.rerender(['Peace']);
    await act(async () => {
      vi.advanceTimersByTime(DBLCLICK_WINDOW_MS);
    });

    expect(onRegionToggle).toHaveBeenCalledWith('Peace');
    expect(fakeMap.fitBounds).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ padding: 30 }),
    );
  });
});
