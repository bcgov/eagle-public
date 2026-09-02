/* eslint-disable react-refresh/only-export-components -- test double: the fake map and the
   components that expose it are one unit. */
import { createContext, useContext, useEffect, useImperativeHandle, type ReactNode, type Ref } from 'react';
import { vi } from 'vitest';
import type { Feature, FeatureCollection, Point } from 'geojson';

/**
 * Stand-in for `@vis.gl/react-maplibre` under jsdom, which has no WebGL. Specs mock the module
 * at the top level, where `vi.mock` is hoisted:
 *
 *   vi.mock('@vis.gl/react-maplibre', async () =>
 *     (await import('app/pages/projects/maplibre-test-stub')).mapLibreStub());
 */

export interface BoundsBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** The whole of BC, so every fixture centroid is in view until a spec narrows it. */
const BC_BOX: BoundsBox = { north: 60, south: 48, east: -114, west: -139 };

let box: BoundsBox = { ...BC_BOX };
let zoom = 6;
let sourceLoaded = true;
/** Set by a spec to drive clusters; otherwise the rendered `<Source data>` supplies the features. */
let override: Feature<Point>[] | null = null;
// A plain record, not a `Map`: the stub's own `Map` component shadows the built-in in this module.
let sourceData: Record<string, FeatureCollection> = {};
/** The mounted map's `render` handler; the real map repaints whenever anything below changes. */
let notifyRender: (() => void) | null = null;
const fireRender = () => notifyRender?.();

export const fakeMap = {
  getBounds: vi.fn(() => ({
    getNorth: () => box.north,
    getSouth: () => box.south,
    getEast: () => box.east,
    getWest: () => box.west
  })),
  getZoom: vi.fn(() => zoom),
  fitBounds: vi.fn(),
  flyTo: vi.fn(),
  easeTo: vi.fn(),
  getClusterExpansionZoom: vi.fn(async (_clusterId: number) => 11),
  isSourceLoaded: vi.fn((_sourceId: string) => sourceLoaded),
  querySourceFeatures: vi.fn((sourceId: string) => override ?? sourceData[sourceId]?.features ?? []),
  // Same features either way: the fake map has no tiles, so "in the source" and "on screen" match.
  queryRenderedFeatures: vi.fn(() => override ?? sourceData['projects']?.features ?? []),
  getLayer: vi.fn((id: string) => ({ id })),
  getSource: vi.fn(() => ({ getClusterExpansionZoom: fakeMap.getClusterExpansionZoom })),
  setFeatureState: vi.fn(),

  setBounds(next: BoundsBox): void {
    box = next;
  },
  setZoom(next: number): void {
    zoom = next;
  },
  /** False stands in for a source still being clustered, when a repaint must change nothing. */
  setSourceLoaded(next: boolean): void {
    sourceLoaded = next;
  },
  setFeatures(features: Feature<Point>[] | null): void {
    override = features;
    notifyRender?.();
  },
  reset(): void {
    box = { ...BC_BOX };
    zoom = 6;
    sourceLoaded = true;
    override = null;
    sourceData = {};
    notifyRender = null;
    mapProps = null;
    for (const value of Object.values(fakeMap)) {
      if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
    }
  }
};

export type FakeMap = typeof fakeMap;

const RenderContext = createContext<(() => void) | undefined>(undefined);

/** The parts of a MapLibre pointer event a spec has to supply. */
export interface FakeMouseEvent {
  features?: Feature[];
  point: { x: number; y: number };
}

interface MapProps {
  children?: ReactNode;
  onLoad?: () => void;
  onRender?: () => void;
  onMouseMove?: (event: FakeMouseEvent) => void;
  onMouseLeave?: (event?: FakeMouseEvent) => void;
  ref?: Ref<FakeMap>;
  [key: string]: unknown;
}

/** The mounted map's props, so a spec can fire a handler the real map only fires from a pointer. */
export let mapProps: MapProps | null = null;

function Map(props: MapProps) {
  const { children, onLoad, onRender, ref } = props;
  useImperativeHandle(ref, () => fakeMap, []);
  // After commit, so a spec never fires a handler from a render that was thrown away.
  useEffect(() => {
    mapProps = props;
  });
  // Once, on mount: the real map fires `load` when its style and canvas are ready, then repaints.
  useEffect(() => {
    notifyRender = () => onRender?.();
    onLoad?.();
    notifyRender();
    return () => {
      notifyRender = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RenderContext value={fireRender}>
      <div data-testid="map">{children}</div>
    </RenderContext>
  );
}

interface SourceProps {
  children?: ReactNode;
  id?: string;
  data?: FeatureCollection;
}

function Source({ children, id, data }: SourceProps) {
  const notify = useContext(RenderContext);
  // A real source re-tiles when its data changes, and the map repaints once it has.
  useEffect(() => {
    if (!data || !id) return;
    sourceData[id] = data;
    notify?.();
  }, [data, id, notify]);

  return <>{children}</>;
}

interface MarkerProps {
  children?: ReactNode;
  longitude: number;
  latitude: number;
  onClick?: () => void;
}

function Marker({ children, longitude, latitude, onClick }: MarkerProps) {
  return (
    <div data-testid="marker" data-lng={longitude} data-lat={latitude} onClick={onClick}>
      {children}
    </div>
  );
}

interface LayerProps {
  id?: string;
  filter?: unknown;
  layout?: { visibility?: string };
}

/** Rendered, not dropped: specs assert on a layer's filter and visibility. */
function Layer({ id, filter, layout }: LayerProps) {
  return (
    <div
      data-testid="layer"
      data-id={id}
      data-filter={JSON.stringify(filter ?? null)}
      data-visibility={layout?.visibility ?? 'visible'}
    />
  );
}

function Nothing() {
  return null;
}

export function mapLibreStub() {
  return {
    Map,
    Source,
    Layer,
    Marker,
    NavigationControl: Nothing,
    ScaleControl: Nothing,
    AttributionControl: Nothing,
    useMap: () => ({ current: fakeMap })
  };
}
