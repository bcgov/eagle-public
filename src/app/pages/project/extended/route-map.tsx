import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AttributionControl,
  Layer,
  Map as MapGL,
  NavigationControl,
  ScaleControl,
  Source,
} from '@vis.gl/react-maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { logger } from 'app/config/logging';
import { EMPTY_STYLE, LIGHT_GRAY_BASEMAP, WORKER_URL } from 'app/map/basemaps';
import { isSitePath } from 'app/utils/safe-url';
import {
  LINE_COLOURS,
  type ExtendedMap,
  type LineColour,
  type MapLine,
  type MapPlace,
} from './types';
import './route-lines.css';
import './route-map.css';

export interface RouteMapProps {
  map: ExtendedMap;
}

export interface RouteMapThumbnailProps {
  map: ExtendedMap;
  /** Accessible name of the thumbnail image. */
  label: string;
}

type Extent = [[number, number], [number, number]];

const TERMINAL_ICON = 'route-terminal';
const TOWN_ICON = 'route-town';
// No style `glyphs` URL, so maplibre draws labels locally with these as CSS font families; the
// weight comes from the first name ("Bold").
const REGULAR_FONT = ['BC Sans'];
const BOLD_FONT = ['BC Sans Bold', 'BC Sans'];

class RefusedUrlError extends Error {}

function useRouteData(url: string) {
  return useQuery({
    queryKey: ['geojson', url],
    queryFn: async (): Promise<FeatureCollection> => {
      try {
        // Map data ships with the site; content never sends the browser to another host for it.
        if (!isSitePath(url)) throw new RefusedUrlError('not a site path');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as FeatureCollection;
      } catch (error) {
        logger.warn(`Route map data failed to load: ${url}`, 'RouteMap', error);
        throw error;
      }
    },
    staleTime: Infinity,
    // One retry, so the error message shows within a couple of seconds; a refused URL stays refused.
    retry: (failures, error) => failures < 1 && !(error instanceof RefusedUrlError),
  });
}

/** Every position in a geometry, of any GeoJSON type. */
function positionsOf(geometry: Geometry | null): Position[] {
  switch (geometry?.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(positionsOf);
    default:
      return [];
  }
}

/** Bounding box of every position in the collection; null when it holds none. */
function extentOf(data: FeatureCollection): Extent | null {
  const positions = data.features.flatMap(({ geometry }) => positionsOf(geometry));
  if (positions.length === 0) return null;
  // A loop, not Math.min(...spread): a long line holds more vertices than a call takes arguments.
  let [west, south] = positions[0];
  let [east, north] = positions[0];
  for (const [lon, lat] of positions) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/** A custom property's colour, or the element's text colour when the property is unset. */
function tokenColour(element: Element, name: string): string {
  const style = getComputedStyle(element);
  return style.getPropertyValue(name).trim() || style.color;
}

/** A filled marker with a halo ring, drawn at 2x so it stays sharp on high-density screens. */
function markerImage(size: number, cornerRadius: number, fill: string, halo: string) {
  const ratio = 2;
  const ring = 1.5;
  const total = (size + ring * 2) * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = total;
  canvas.height = total;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = halo;
  context.beginPath();
  context.roundRect(0, 0, total, total, (cornerRadius + ring) * ratio);
  context.fill();
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(ring * ratio, ring * ratio, size * ratio, size * ratio, cornerRadius * ratio);
  context.fill();
  return context.getImageData(0, 0, total, total);
}

interface Palette {
  lines: Record<LineColour, string>;
  text: string;
  halo: string;
}

/** The line and label colours, all read from CSS custom properties. */
function readPalette(container: Element): Palette {
  return {
    lines: Object.fromEntries(
      LINE_COLOURS.map((colour) => [colour, tokenColour(container, `--extended-${colour}`)]),
    ) as Record<LineColour, string>,
    text: tokenColour(container, '--typography-color-primary'),
    halo: tokenColour(container, '--theme-gray-white'),
  };
}

/** Terminal markers take the colour of the line flagged `markers`, else the label colour. */
function terminalColour(palette: Palette, lines: MapLine[]): string {
  const line = lines.find((candidate) => candidate.markers);
  return line ? palette.lines[line.colour] : palette.text;
}

function addMarkerIcons(map: MapLibreMap, palette: Palette, lines: MapLine[]) {
  const icons = [
    [TERMINAL_ICON, markerImage(10, 2, terminalColour(palette, lines), palette.halo)],
    [
      TOWN_ICON,
      markerImage(7, 3.5, tokenColour(map.getContainer(), '--theme-gray-80'), palette.halo),
    ],
  ] as const;
  for (const [id, image] of icons) {
    if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
  }
}

/**
 * The terminal points, each labelled above or below itself, away from the middle of the extent:
 * the ends of a route sit at the frame edge, where a label beside them would be cut off.
 * Assumes the route runs mostly north-south; an east-west one would need left/right anchors.
 */
function terminalsCollection(data: FeatureCollection, extent: Extent): FeatureCollection {
  const middle = (extent[0][1] + extent[1][1]) / 2;
  return {
    type: 'FeatureCollection',
    features: data.features.flatMap((feature) =>
      feature.geometry?.type === 'Point' && feature.properties?.['kind'] === 'terminal'
        ? [
            {
              ...feature,
              properties: {
                ...feature.properties,
                anchor: feature.geometry.coordinates[1] >= middle ? 'bottom' : 'top',
              },
            },
          ]
        : [],
    ),
  };
}

function townsCollection(towns: MapPlace[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: towns.map((town, rank) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: town.coordinates },
      properties: { name: town.name, rank },
    })),
  };
}

interface LineMapProps {
  geojsonUrl: string;
  lines: MapLine[];
  label: string;
  /** Present on the full map only; the thumbnail draws no labels. */
  towns?: MapPlace[];
}

/** Callers key it by `geojsonUrl`: another url is a new map, with none of the last one's state. */
function LineMap({ geojsonUrl, lines, label, towns }: LineMapProps) {
  const full = towns !== undefined;
  const { data, isPending, isError } = useRouteData(geojsonUrl);
  const extent = useMemo(() => (data ? extentOf(data) : null), [data]);
  const places = useMemo(() => (towns ? townsCollection(towns) : null), [towns]);
  const terminals = useMemo(
    () => (full && data && extent ? terminalsCollection(data, extent) : null),
    [full, data, extent],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [markersReady, setMarkersReady] = useState(false);

  // Runs as the DOM is removed, before the map is, so no refit hits a detached node.
  useLayoutEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  // Reads the colours once the container mounts, so the lines do not wait for the map's `load`,
  // which waits for every basemap tile.
  useLayoutEffect(() => {
    if (containerRef.current) setPalette(readPalette(containerRef.current));
  }, [extent]);

  const className = `route-map route-map--${full ? 'full' : 'thumbnail'}`;

  if (isPending) {
    return (
      <div className={className} aria-busy="true">
        <Skeleton height="100%" />
        <span className="visually-hidden">Loading map</span>
      </div>
    );
  }

  if (isError || !extent) {
    return (
      <div className={`${className} route-map--message`}>
        <p>The map could not be loaded.</p>
      </div>
    );
  }

  const padding = full ? 48 : 14;
  const lineWidth = (width: number) => (full ? width : width - 1);

  return (
    <div
      ref={containerRef}
      className={className}
      // The thumbnail is a picture: its canvas and attribution are presentational under role="img".
      {...(full ? {} : { role: 'img', 'aria-label': label })}
    >
      <MapGL
        initialViewState={{ bounds: extent, fitBoundsOptions: { padding } }}
        mapStyle={EMPTY_STYLE}
        workerUrl={WORKER_URL}
        interactive={full}
        // One-finger drag scrolls the page on touch screens; two fingers move the map.
        cooperativeGestures={full}
        scrollZoom={false}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        onLoad={({ target: map }) => {
          if (full) {
            addMarkerIcons(map, readPalette(map.getContainer()), lines);
            setMarkersReady(true);
          } else map.getCanvas().removeAttribute('tabindex');
          resizeObserverRef.current?.disconnect();
          resizeObserverRef.current = null;
          if (typeof ResizeObserver === 'undefined' || !containerRef.current) return;
          const observer = new ResizeObserver(() => {
            if (!map.getContainer().isConnected) return;
            map.resize();
            map.fitBounds(extent, { padding, duration: 0 });
          });
          observer.observe(containerRef.current);
          resizeObserverRef.current = observer;
        }}
      >
        <Source
          id="route-basemap"
          type="raster"
          tiles={[LIGHT_GRAY_BASEMAP.tiles]}
          tileSize={256}
          maxzoom={LIGHT_GRAY_BASEMAP.maxzoom}
          attribution={LIGHT_GRAY_BASEMAP.attribution}
        >
          <Layer id="route-basemap-layer" type="raster" />
        </Source>

        {palette && (
          <Source id="route-lines" type="geojson" data={data}>
            {lines.map((line) => (
              <Layer
                key={line.id}
                id={`route-line-${line.id}`}
                type="line"
                filter={['==', ['get', 'line'], line.id]}
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{
                  'line-color': palette.lines[line.colour],
                  'line-width': lineWidth(line.width),
                }}
              />
            ))}
          </Source>
        )}

        {palette && markersReady && places && (
          <Source id="route-towns" type="geojson" data={places}>
            {/* One symbol: a town whose label finds no free side drops its dot too. */}
            <Layer
              id="route-towns-label"
              type="symbol"
              layout={{
                'symbol-sort-key': ['get', 'rank'],
                'icon-image': TOWN_ICON,
                'text-field': ['get', 'name'],
                'text-font': REGULAR_FONT,
                'text-size': 12,
                'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
                'text-radial-offset': 0.6,
                'text-justify': 'auto',
              }}
              paint={{
                'text-color': palette.text,
                'text-halo-color': palette.halo,
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {/* Above the towns, so it is placed first and the towns give way to it. */}
        {palette && markersReady && terminals && (
          <Source id="route-terminals" type="geojson" data={terminals}>
            <Layer
              id="route-terminals-label"
              type="symbol"
              layout={{
                'icon-image': TERMINAL_ICON,
                'icon-allow-overlap': true,
                'text-field': ['get', 'name'],
                'text-font': BOLD_FONT,
                'text-size': 13,
                'text-anchor': ['get', 'anchor'],
                'text-radial-offset': 0.7,
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': palette.text,
                'text-halo-color': palette.halo,
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {full && (
          <>
            {/* Before the zoom buttons: maplibre stacks each later bottom control above the last,
                so this one keeps the corner. */}
            <AttributionControl position="bottom-right" compact />
            <NavigationControl position="bottom-right" showCompass={false} />
            {/* Top-left: at bottom-left it covered the western terminal's label. */}
            <ScaleControl position="top-left" />
          </>
        )}
      </MapGL>
    </div>
  );
}

/** The interactive line map for the Overview Route card. Callers lazy-load it. */
export function RouteMap({ map }: RouteMapProps) {
  return (
    <LineMap
      key={map.geojsonUrl}
      geojsonUrl={map.geojsonUrl}
      lines={map.lines}
      towns={map.places}
      label={map.label}
    />
  );
}

/** The non-interactive line map thumbnail in the persistent panel. */
export function RouteMapThumbnail({ map, label }: RouteMapThumbnailProps) {
  return (
    <LineMap key={map.geojsonUrl} geojsonUrl={map.geojsonUrl} lines={map.lines} label={label} />
  );
}
