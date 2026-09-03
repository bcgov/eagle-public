import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
// Aliased: `Map` would shadow the built-in used for the id lookup below.
import { Layer, Map as MapGL, Marker, Source } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre';
import type { FilterSpecification, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { Project } from 'app/models/project';
import { track } from 'app/analytics/analytics';
import { logger } from 'app/config/logging';
import { mapBounds, regionsVisible } from 'app/state/map-ui';
import { useStore } from 'app/state/store';
import {
  BC_BOUNDS,
  BC_CENTER,
  Basemaps,
  DEFAULT_ZOOM,
  EMPTY_STYLE,
  MapControls,
  WORKER_URL,
  flyOptions,
  hasValidCentroid,
} from 'app/map/basemaps';
import { ProjDetailPopup } from './proj-detail-popup';
import './projlist-map.css';

export interface ProjlistMapProps {
  projects: Project[];
  loading: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (project: Project | null) => void;
  onHover: (id: string | null) => void;
  /** EAO region polygons to draw; empty means all of them. */
  regionNames: string[];
  /** Mobile shows the selected project in the page's bottom sheet, so the map renders no card. */
  mobile: boolean;
}

const CLUSTER_MAX_ZOOM = 9;
const SOURCE_ID = 'projects';
const REGION_SOURCE_ID = 'eao-regions';
const REGION_HIT_LAYERS = ['eao-regions-fill'];
const FIT_PADDING = 48;
const REGION_COLOUR = '#003366';
/** Pointer offset for the region tip, so the cursor never sits on top of the label. */
const TIP_OFFSET = 12;
/** How long a tapped region keeps its name on screen. */
const TIP_LINGER_MS = 1500;

interface RegionHover {
  name: string;
  x: number;
  y: number;
}

interface MapFeature {
  key: string;
  lng: number;
  lat: number;
  /** null for a single project pin. */
  clusterId: number | null;
  count: number;
  id: string;
  name: string;
}

/** Polygon rings and MultiPolygon members both bottom out in `[lng, lat]`, so recurse to the pairs. */
function eachPosition(coordinates: unknown, visit: (lng: number, lat: number) => void): void {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === 'number') visit(coordinates[0] as number, coordinates[1] as number);
  else for (const part of coordinates) eachPosition(part, visit);
}

type Bbox = [number, number, number, number];

function regionsBbox(shapes: FeatureCollection, names: string[]): Bbox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const feature of shapes.features) {
    if (!names.includes(String(feature.properties?.['regionName']))) continue;
    eachPosition((feature.geometry as { coordinates?: unknown }).coordinates, (lng, lat) => {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    });
  }
  return west === Infinity ? null : [west, south, east, north];
}

function clusterSize(count: number): string {
  if (count < 10) return 's';
  if (count < 100) return 'm';
  return 'l';
}

export function ProjlistMap({
  projects,
  loading,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  regionNames,
  mobile,
}: ProjlistMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [hoverRegion, setHoverRegion] = useState<RegionHover | null>(null);
  const hoverRegionId = useRef<string | number | null>(null);
  const signatureRef = useRef('');
  /** Set by a pin click so the card-selection flyTo does not fight the marker the visitor just hit. */
  const lastMarkerSelectId = useRef<string | null>(null);

  const overlayVisible = useStore(regionsVisible);
  const { data: regionShapes } = useQuery({
    queryKey: ['geojson', 'eao-regions'],
    queryFn: async (): Promise<FeatureCollection> =>
      (await fetch('/assets/geojson/eao-regions.geojson')).json(),
    staleTime: Infinity,
  });
  const regionFilter: FilterSpecification = regionNames.length
    ? ['in', ['get', 'regionName'], ['literal', regionNames]]
    : true;
  const regionLayout = { visibility: overlayVisible ? ('visible' as const) : ('none' as const) };

  const valid = useMemo(() => projects.filter(hasValidCentroid), [projects]);

  const byId = useMemo(() => new Map(valid.map((project) => [project._id, project])), [valid]);

  const fc = useMemo<FeatureCollection<Point, { id: string; name: string }>>(
    () => ({
      type: 'FeatureCollection',
      features: valid.map((project) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [project.centroid[0], project.centroid[1]] },
        properties: { id: project._id, name: project.name },
      })),
    }),
    [valid],
  );

  const bbox = useMemo<Bbox | null>(() => {
    if (valid.length === 0) return null;
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const project of valid) {
      const [lng, lat] = project.centroid;
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    return [west, south, east, north];
  }, [valid]);

  // Filtering by region frames the whole regions, not just the projects left inside them.
  const regionBbox = useMemo(
    () => (regionShapes && regionNames.length ? regionsBbox(regionShapes, regionNames) : null),
    [regionShapes, regionNames],
  );
  const fitBox = regionBbox ?? bbox;
  const fitKey = fitBox ? fitBox.join(',') : '';

  // Callbacks outlive the render that created them, so they read the current props through this ref.
  const latest = useRef({ byId, onSelect, selectedId });
  useEffect(() => {
    latest.current = { byId, onSelect, selectedId };
  });

  const publishBounds = useCallback((map: MapRef) => {
    const bounds = map.getBounds();
    const next = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };
    // Publish only a view that actually moved. The store compares by identity, so a fresh object
    // from every `moveend` — fired for programmatic pans too — re-renders the page, which can pan
    // the map again.
    const current = mapBounds.get();
    const same =
      current &&
      current.north === next.north &&
      current.south === next.south &&
      current.east === next.east &&
      current.west === next.west;
    if (!same) mapBounds.set(next);
  }, []);

  /** Only the polygon under the pointer carries `hover`, so the paint expression lights just it. */
  const setRegionHover = useCallback((id: string | number | null) => {
    const map = mapRef.current;
    if (!map || hoverRegionId.current === id) return;
    if (hoverRegionId.current !== null) {
      map.setFeatureState(
        { source: REGION_SOURCE_ID, id: hoverRegionId.current },
        { hover: false },
      );
    }
    hoverRegionId.current = id;
    if (id !== null) map.setFeatureState({ source: REGION_SOURCE_ID, id }, { hover: true });
  }, []);

  // The canonical HTML-cluster refresh: every frame, once the clustering worker has caught up with
  // the view. `sourcedata` and `moveend` both fire mid-animation, leaving stale clusters on screen.
  const refreshFeatures = useCallback(() => {
    const map = mapRef.current;
    // `isSourceLoaded` throws for a source the style has not got yet, and the first frames render
    // before React has added it.
    if (!map || !map.getSource(SOURCE_ID) || !map.isSourceLoaded(SOURCE_ID)) return;

    const seen = new Set<string>();
    const next: MapFeature[] = [];
    for (const feature of map.querySourceFeatures(SOURCE_ID)) {
      if (feature.geometry.type !== 'Point') continue;
      const properties = feature.properties;
      const clusterId = properties['cluster'] ? (properties['cluster_id'] as number) : null;
      const id = clusterId === null ? String(properties['id']) : '';
      const key = clusterId === null ? `p${id}` : `c${clusterId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [lng, lat] = feature.geometry.coordinates;
      next.push({
        key,
        lng,
        lat,
        clusterId,
        count: clusterId === null ? 1 : (properties['point_count'] as number),
        id,
        name: clusterId === null ? String(properties['name'] ?? '') : '',
      });
    }

    // Most frames draw the same markers, so only a changed set costs a React render.
    const signature = next
      .map(
        (feature) =>
          `${feature.key}@${feature.lng.toFixed(4)},${feature.lat.toFixed(4)}x${feature.count}`,
      )
      .join('|');
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setFeatures(next);
  }, []);

  // The ref is only guaranteed after commit, so `load` sets a flag and this effect does the work.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    publishBounds(map);
  }, [loaded, publishBounds]);

  useEffect(() => () => mapBounds.set(null), []);

  // Refit whenever the extent to frame changes, unless a project is selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !fitBox || latest.current.selectedId !== null) return;
    map.fitBounds(fitBox, { padding: FIT_PADDING, maxZoom: 10, ...flyOptions() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, loaded]);

  // Fly to a project the visitor picked from the list; a pin click already centred itself.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const project = selectedId ? latest.current.byId.get(selectedId) : undefined;
    if (project && lastMarkerSelectId.current !== selectedId) {
      map.flyTo({
        center: [project.centroid[0], project.centroid[1]],
        // One past the cluster ceiling, so the selected pin is drawn on its own.
        zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1),
        ...flyOptions(),
      });
    }
    lastMarkerSelectId.current = null;
  }, [selectedId, loaded]);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const cardProject = !mobile && selected ? selected : null;

  // Touch has no hover, so a tap names the region for a moment instead of holding the tip open.
  useEffect(() => {
    if (!hoverRegion || !mobile) return;
    const timer = setTimeout(() => setHoverRegion(null), TIP_LINGER_MS);
    return () => clearTimeout(timer);
  }, [hoverRegion, mobile]);

  /** Names the region under the pointer, or clears the tip when there is no region there. */
  function showRegionTip(
    feature: MapGeoJSONFeature | undefined,
    point: { x: number; y: number },
  ): void {
    const name = feature?.properties?.['regionName'];
    setHoverRegion(name ? { name: String(name), x: point.x, y: point.y } : null);
    setRegionHover(name ? (feature?.id ?? null) : null);
  }

  async function expandCluster(feature: MapFeature): Promise<void> {
    const map = mapRef.current;
    if (!map || feature.clusterId === null) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    try {
      const zoom = await source.getClusterExpansionZoom(feature.clusterId);
      map.easeTo({ center: [feature.lng, feature.lat], zoom, ...flyOptions() });
    } catch (error) {
      logger.error('Failed to expand cluster', 'ProjlistMap', error);
    }
  }

  function selectPin(feature: MapFeature): void {
    const project = byId.get(feature.id);
    if (!project) return;
    lastMarkerSelectId.current = project._id;
    onSelect(project);
    track('Map Marker Clicked', {
      project_id: project._id,
      project_name: project.name,
      map_zoom_level: mapRef.current?.getZoom(),
    });
  }

  return (
    <div
      className={`app-map${loading ? ' is-loading' : ''}`}
      data-testid="project-map"
      role="region"
      aria-label="Map of B.C. showing environmental assessment projects"
    >
      <MapGL
        ref={mapRef}
        initialViewState={{ bounds: BC_BOUNDS, fitBoundsOptions: { padding: FIT_PADDING } }}
        mapStyle={EMPTY_STYLE}
        workerUrl={WORKER_URL}
        minZoom={4}
        maxZoom={17}
        attributionControl={false}
        cooperativeGestures={false}
        style={{ width: '100%', height: '100%' }}
        onLoad={() => setLoaded(true)}
        onRender={refreshFeatures}
        // Not `moveend`: a touch tap ends a zero-length move after the click that set the tip.
        onMoveStart={() => setHoverRegion(null)}
        onMoveEnd={() => {
          const map = mapRef.current;
          if (map) publishBounds(map);
        }}
        interactiveLayerIds={REGION_HIT_LAYERS}
        // Touch synthesises mouse events around every tap, which would wipe the tip the tap set.
        onMouseMove={
          mobile
            ? undefined
            : (event: MapLayerMouseEvent) =>
                // A hovered pin already names its project; two labels at one pointer read as noise.
                showRegionTip(hoveredId ? undefined : event.features?.[0], event.point)
        }
        onMouseLeave={mobile ? undefined : () => showRegionTip(undefined, { x: 0, y: 0 })}
        onClick={(event: MapLayerMouseEvent) => {
          // Marker buttons live inside the canvas container, so their clicks reach the map too.
          if ((event.originalEvent.target as Element).closest('.maplibregl-marker')) return;
          onSelect(null);
          showRegionTip(event.features?.[0], event.point);
        }}
      >
        <Basemaps />
        <MapControls
          overlays
          onReset={() =>
            mapRef.current?.flyTo({ center: BC_CENTER, zoom: DEFAULT_ZOOM, ...flyOptions() })
          }
        />

        {/* Before the projects source, so the pins and their hit layer draw above the polygons. */}
        {regionShapes && (
          <Source id={REGION_SOURCE_ID} type="geojson" data={regionShapes} promoteId="regionNumber">
            <Layer
              id="eao-regions-fill"
              type="fill"
              filter={regionFilter}
              layout={regionLayout}
              paint={{
                'fill-color': REGION_COLOUR,
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.18,
                  0.08,
                ],
              }}
            />
            <Layer
              id="eao-regions-line"
              type="line"
              filter={regionFilter}
              layout={regionLayout}
              paint={{ 'line-color': REGION_COLOUR, 'line-width': 1, 'line-opacity': 0.5 }}
            />
          </Source>
        )}

        <Source
          id={SOURCE_ID}
          type="geojson"
          data={fc}
          cluster
          clusterRadius={60}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
        >
          {/* Nothing renders this layer, but a source with no layer is never tiled and so has no features to query. */}
          <Layer
            id="projects-hit"
            type="circle"
            paint={{ 'circle-opacity': 0, 'circle-radius': 1 }}
          />
        </Source>

        {features.map((feature) =>
          feature.clusterId === null ? (
            <Marker
              key={feature.key}
              longitude={feature.lng}
              latitude={feature.lat}
              anchor="bottom"
            >
              <button
                type="button"
                className={`map-pin${feature.id === hoveredId ? ' is-hovered' : ''}${
                  feature.id === selectedId ? ' is-selected' : ''
                }`}
                data-testid="map-marker"
                data-project-id={feature.id}
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => selectPin(feature)}
                // The label is a hover affordance; on touch the synthesised enter leaves it stuck on.
                onMouseEnter={mobile ? undefined : () => onHover(feature.id)}
                onMouseLeave={mobile ? undefined : () => onHover(null)}
              >
                <span className="map-pin__label">{feature.name}</span>
              </button>
            </Marker>
          ) : (
            <Marker
              key={feature.key}
              longitude={feature.lng}
              latitude={feature.lat}
              anchor="center"
            >
              <button
                type="button"
                className="map-cluster"
                data-testid="map-cluster"
                data-size={clusterSize(feature.count)}
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => void expandCluster(feature)}
              >
                {feature.count}
              </button>
            </Marker>
          ),
        )}
      </MapGL>

      {loading && <div className="app-map__shimmer placeholder-wave" aria-hidden="true" />}

      {hoverRegion && (
        <div
          className="map-region-tip"
          data-testid="map-region-tip"
          role="status"
          aria-live="polite"
          style={{ left: hoverRegion.x + TIP_OFFSET, top: hoverRegion.y + TIP_OFFSET }}
        >
          {hoverRegion.name}
        </div>
      )}

      {/* Outside the MapLibre container: the card is a page overlay, not anchored to the pin. */}
      {cardProject && (
        <div
          className="map-info"
          data-testid="map-popup"
          role="dialog"
          aria-label={cardProject.name}
        >
          <ProjDetailPopup project={cardProject} onClose={() => onSelect(null)} />
        </div>
      )}
    </div>
  );
}
