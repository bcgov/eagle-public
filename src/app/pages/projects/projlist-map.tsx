import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
// Aliased: `Map` would shadow the built-in used for the id lookup below.
import { Layer, Map as MapGL, Marker, Source } from '@vis.gl/react-maplibre';
import type { MapLayerMouseEvent, MapRef } from '@vis.gl/react-maplibre';
import type { GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { Project } from 'app/models/project';
import { ENGAGEMENT_LABEL, type Engagement, type ProjectEngagement } from 'app/api/commentperiod';
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
import { createHoverTween } from './region-hover-tween';
import { regionFillOpacity, regionLineOpacity, regionLineWidth } from './region-paint';
import './projlist-map.css';

interface ProjlistMapProps {
  projects: Project[];
  loading: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (project: Project | null) => void;
  onHover: (id: string | null) => void;
  /** EAO region polygons the Region filter holds; every polygon draws, these ones picked. */
  regionNames: string[];
  /** Adds or drops a region polygon from the Region filter; false when it names no known region. */
  onRegionToggle: (regionName: string) => boolean;
  /** Mobile shows the selected project in the page's bottom sheet, so the map renders no card. */
  mobile: boolean;
  /** Open or upcoming comment period per project id; undefined while loading, drawn as no state. */
  engagementById: ReadonlyMap<string, ProjectEngagement> | undefined;
}

const CLUSTER_MAX_ZOOM = 9;
const SOURCE_ID = 'projects';
const REGION_SOURCE_ID = 'eao-regions';
const REGION_HIT_LAYERS = ['eao-regions-fill'];
const FIT_PADDING = 48;
const REGION_COLOUR = '#003366';
/**
 * How long a region click waits for a second click. MapLibre exports no double-click timing (its
 * `clickTolerance` is in pixels), so this sits inside the usual desktop double-click window.
 */
const DBLCLICK_WINDOW_MS = 300;
/** Framing one region picked on the map. */
const REGION_FIT = { padding: 30, maxZoom: 9 };
/** Pointer offset for the region tip, so the cursor never sits on top of the label. */
const TIP_OFFSET = 12;
/** How long a tapped region keeps its name on screen. */
const TIP_LINGER_MS = 1500;

/** Clustering drops member properties, so each cluster counts its open and upcoming members. */
const CLUSTER_PROPERTIES = {
  openCount: ['+', ['case', ['==', ['get', 'engagement'], 'open'], 1, 0]],
  upcomingCount: ['+', ['case', ['==', ['get', 'engagement'], 'upcoming'], 1, 0]],
};

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
  engagement: Engagement | undefined;
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

/** A pin carries its own state; a cluster carries its members' counts from `CLUSTER_PROPERTIES`. */
function featureEngagement(properties: Record<string, unknown>): Engagement | undefined {
  if (!properties['cluster']) {
    const own = properties['engagement'];
    return own === 'open' || own === 'upcoming' ? own : undefined;
  }
  if (Number(properties['openCount']) > 0) return 'open';
  if (Number(properties['upcomingCount']) > 0) return 'upcoming';
  return undefined;
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
  onRegionToggle,
  mobile,
  engagementById,
}: ProjlistMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [hoverRegion, setHoverRegion] = useState<RegionHover | null>(null);
  const hoverRegionId = useRef<string | number | null>(null);
  const signatureRef = useRef('');
  /** Set by a pin click so the card-selection flyTo does not fight the marker the visitor just hit. */
  const lastMarkerSelectId = useRef<string | null>(null);
  /** Set by a region click, which frames the map itself, so the filter-driven refit stands down. */
  const skipNextFit = useRef(false);
  /** A region click waiting out the double-click window; a double-click zooms instead. */
  const pendingPick = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overlayVisible = useStore(regionsVisible);
  const { data: regionShapes } = useQuery({
    queryKey: ['geojson', 'eao-regions'],
    queryFn: async (): Promise<FeatureCollection> =>
      (await fetch('/assets/geojson/eao-regions.geojson')).json(),
    staleTime: Infinity,
  });
  const hasRegionPick = regionNames.length > 0;
  const regionLayout = { visibility: overlayVisible ? ('visible' as const) : ('none' as const) };

  const valid = useMemo(() => projects.filter(hasValidCentroid), [projects]);

  const byId = useMemo(() => new Map(valid.map((project) => [project._id, project])), [valid]);

  const fc = useMemo<
    FeatureCollection<Point, { id: string; name: string; engagement: Engagement | undefined }>
  >(
    () => ({
      type: 'FeatureCollection',
      features: valid.map((project) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [project.centroid[0], project.centroid[1]] },
        properties: {
          id: project._id,
          name: project.name,
          engagement: engagementById?.get(project._id)?.state,
        },
      })),
    }),
    [valid, engagementById],
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

  // The picked polygons, as feature state, so one paint expression draws every look a polygon has.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !regionShapes || !map.getSource(REGION_SOURCE_ID)) return;
    for (const feature of regionShapes.features) {
      const name = String(feature.properties?.['regionName'] ?? '');
      if (!name) continue;
      map.setFeatureState(
        { source: REGION_SOURCE_ID, id: name },
        { selected: regionNames.includes(name) },
      );
    }
  }, [loaded, regionShapes, regionNames]);

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

  /** Eases `hoverT` up on the polygon under the pointer and back down on the one it left. */
  const hoverTween = useRef<ReturnType<typeof createHoverTween> | null>(null);
  useEffect(() => {
    const tween = createHoverTween((id, t) =>
      mapRef.current?.setFeatureState({ source: REGION_SOURCE_ID, id }, { hoverT: t }),
    );
    hoverTween.current = tween;
    return () => {
      tween.dispose();
      hoverTween.current = null;
    };
  }, []);

  const setRegionHover = useCallback((id: string | number | null) => {
    const map = mapRef.current;
    if (!map || hoverRegionId.current === id) return;
    if (hoverRegionId.current !== null) hoverTween.current?.to(hoverRegionId.current, 0);
    hoverRegionId.current = id;
    if (id !== null) hoverTween.current?.to(id, 1);
    // A polygon is a button: clicking it picks the region.
    map.getCanvas().style.cursor = id !== null ? 'pointer' : '';
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
        engagement: featureEngagement(properties),
      });
    }

    // Most frames draw the same markers, so only a changed set costs a React render.
    const signature = next
      .map(
        (feature) =>
          `${feature.key}@${feature.lng.toFixed(4)},${feature.lat.toFixed(4)}x${feature.count}${
            feature.engagement ?? ''
          }`,
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
    if (skipNextFit.current) {
      skipNextFit.current = false;
      return;
    }
    if (!loaded || !map || !fitBox || latest.current.selectedId !== null) return;
    map.fitBounds(fitBox, { padding: FIT_PADDING, maxZoom: 10, ...flyOptions() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, loaded]);

  // After the effect above: a region click only speaks for the render its own change lands in.
  const regionKey = regionNames.join('|');
  useEffect(() => {
    skipNextFit.current = false;
  }, [regionKey]);

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

  // A switch between the phone and desktop layouts drops a tip and highlight the other one set,
  // since the phone's linger timer no longer runs and no pointer is there to clear them.
  const [tipLayout, setTipLayout] = useState(mobile);
  if (tipLayout !== mobile) {
    setTipLayout(mobile);
    setHoverRegion(null);
  }
  useEffect(() => setRegionHover(null), [mobile, setRegionHover]);

  // Touch has no hover, so a tap names and lights the region for a moment instead of holding on.
  useEffect(() => {
    if (!hoverRegion || !mobile) return;
    const timer = setTimeout(() => {
      setHoverRegion(null);
      setRegionHover(null);
    }, TIP_LINGER_MS);
    return () => clearTimeout(timer);
  }, [hoverRegion, mobile, setRegionHover]);

  /** Names the region under the pointer, or clears the tip when there is no region there. */
  function showRegionTip(
    feature: MapGeoJSONFeature | undefined,
    point: { x: number; y: number },
  ): void {
    const name = feature?.properties?.['regionName'];
    setHoverRegion(name ? { name: String(name), x: point.x, y: point.y } : null);
    setRegionHover(name ? (feature?.id ?? null) : null);
  }

  /**
   * A polygon click toggles its region in the Region filter, and frames it when it was picked.
   * The Region multi-select in the Filters panel is the keyboard and screen reader route to the
   * same filter; the map adds a pointer shortcut, not a new control.
   */
  function toggleRegion(name: string): void {
    const picking = !regionNames.includes(name);
    skipNextFit.current = onRegionToggle(name);
    if (!skipNextFit.current || !picking || !regionShapes) return;
    const box = regionsBbox(regionShapes, [name]);
    if (box) mapRef.current?.fitBounds(box, { ...REGION_FIT, ...flyOptions() });
  }

  function cancelPendingPick(): void {
    if (pendingPick.current === null) return;
    clearTimeout(pendingPick.current);
    pendingPick.current = null;
  }

  useEffect(() => cancelPendingPick, []);

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
        // Only a visitor's drag or zoom; the fit a region tap starts must leave its tip to linger.
        onMoveStart={(event: { originalEvent?: unknown }) => {
          if (!event.originalEvent) return;
          setHoverRegion(null);
          setRegionHover(null);
        }}
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
        // Leaving the canvas fires no layer leave when the pointer exits straight off a polygon.
        onMouseOut={mobile ? undefined : () => showRegionTip(undefined, { x: 0, y: 0 })}
        onDblClick={cancelPendingPick}
        onClick={(event: MapLayerMouseEvent) => {
          // Marker buttons live inside the canvas container, so their clicks reach the map too.
          if ((event.originalEvent.target as Element).closest('.maplibregl-marker')) return;
          const region = event.features?.[0];
          showRegionTip(region, event.point);
          // A polygon click picks the region and nothing else, so an open project card stays.
          const name = region?.properties?.['regionName'];
          if (region && REGION_HIT_LAYERS.includes(region.layer?.id) && name) {
            // Touch zooms with a double tap, which fires no `dblclick`, so a tap picks at once.
            if (mobile) {
              toggleRegion(String(name));
              return;
            }
            // Held until the double-click window passes, so a double-click only zooms.
            cancelPendingPick();
            pendingPick.current = setTimeout(() => {
              pendingPick.current = null;
              toggleRegion(String(name));
            }, DBLCLICK_WINDOW_MS);
            return;
          }
          onSelect(null);
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
          // Keyed by name, which is what the Region filter and the feature state both hold.
          <Source id={REGION_SOURCE_ID} type="geojson" data={regionShapes} promoteId="regionName">
            <Layer
              id="eao-regions-fill"
              type="fill"
              layout={regionLayout}
              paint={{
                'fill-color': REGION_COLOUR,
                'fill-opacity': regionFillOpacity(hasRegionPick),
              }}
            />
            <Layer
              id="eao-regions-line"
              type="line"
              layout={regionLayout}
              paint={{
                'line-color': REGION_COLOUR,
                'line-width': regionLineWidth(hasRegionPick),
                'line-opacity': regionLineOpacity(hasRegionPick),
              }}
            />
          </Source>
        )}

        <Source
          id={SOURCE_ID}
          type="geojson"
          data={fc}
          cluster
          clusterProperties={CLUSTER_PROPERTIES}
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
                }${feature.engagement ? ` is-${feature.engagement}` : ''}`}
                data-testid="map-marker"
                data-project-id={feature.id}
                data-engagement={feature.engagement}
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => selectPin(feature)}
                // The label is a hover affordance; on touch the synthesised enter leaves it stuck on.
                onMouseEnter={mobile ? undefined : () => onHover(feature.id)}
                onMouseLeave={mobile ? undefined : () => onHover(null)}
              >
                <span className="map-pin__label">
                  {feature.name}
                  {/* Said in the label too, so the state is never carried by colour alone. */}
                  {feature.engagement && `, ${ENGAGEMENT_LABEL[feature.engagement]}`}
                </span>
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
                data-engagement={feature.engagement}
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
          <ProjDetailPopup
            project={cardProject}
            engagement={engagementById?.get(cardProject._id)}
            onClose={() => onSelect(null)}
          />
        </div>
      )}
    </div>
  );
}
