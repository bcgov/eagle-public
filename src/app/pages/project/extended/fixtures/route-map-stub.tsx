import type { ComponentProps } from 'react';
import { fakeMap, mapLibreStub } from 'app/pages/projects/maplibre-test-stub';

/**
 * The shared MapLibre stand-in, with `load` fired the way the real map fires it: an event whose
 * `target` is the map. The route map reads its marker colours off that target. Specs mock
 * the module at the top level:
 *
 *   vi.mock('@vis.gl/react-maplibre', async () =>
 *     (await import('./fixtures/route-map-stub')).routeMapLibreStub());
 */
let holdNextLoad = false;
let heldLoad: (() => void) | null = null;

/**
 * Holds the next map's `load`, like a real map waiting on slow basemap tiles. Returns the function
 * that fires it.
 */
export function holdLoad() {
  holdNextLoad = true;
  return () => {
    heldLoad?.();
    heldLoad = null;
  };
}

export function routeMapLibreStub() {
  const stub = mapLibreStub();
  const container = document.createElement('div');
  const target = {
    ...fakeMap,
    getContainer: () => container,
    hasImage: () => false,
    addImage: () => undefined,
  };
  type StubMapProps = ComponentProps<typeof stub.Map>;
  function Map(props: StubMapProps) {
    const onLoad = props.onLoad as ((event: { target: typeof target }) => void) | undefined;
    const fireLoad = () => onLoad?.({ target });
    return (
      <stub.Map
        {...props}
        onLoad={() => {
          if (!holdNextLoad) return fireLoad();
          holdNextLoad = false;
          heldLoad = fireLoad;
        }}
      />
    );
  }
  return { ...stub, Map };
}

/** Two lines and their terminal, spanning lon -123 to -113 and lat 49 to 54. */
export const CORRIDORS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { line: 'original', length_km: 1246 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-113, 53.8],
          [-118, 54],
          [-123, 49.1],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { line: 'optimized', length_km: 1211 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-113, 53.8],
          [-119, 49],
          [-123, 49.1],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'terminal', name: 'Bruderheim' },
      geometry: { type: 'Point', coordinates: [-113, 53.8] },
    },
  ],
};
