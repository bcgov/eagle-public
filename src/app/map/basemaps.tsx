/* eslint-disable react-refresh/only-export-components -- one map module: the components and the
   constants they share (style, bounds, basemap list) are the same unit of change. */
import { useEffect, useRef, useState } from 'react';
import {
  AttributionControl,
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
} from '@vis.gl/react-maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { track } from 'app/analytics/analytics';
import { logger } from 'app/config/logging';
import type { Project } from 'app/models/project';
import { baseLayerName, DEFAULT_BASEMAP, regionsVisible } from 'app/state/map-ui';
import { useStore } from 'app/state/store';
import 'maplibre-gl/dist/maplibre-gl.css';
import './basemaps.css';

/**
 * Pass to every `<Map workerUrl>`: maplibre-gl derives its worker URL from its own module URL, and
 * neither Vite's dep pre-bundle nor the built chunk has a sibling worker file there.
 */
export const WORKER_URL = mapWorkerUrl;

/** Module constant so `<Map mapStyle>` keeps one identity; the basemaps are added as sources instead. */
export const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

export const BC_CENTER: [number, number] = [-125.5, 55.5];
export const DEFAULT_ZOOM = 5.7;
export const BC_BOUNDS: [[number, number], [number, number]] = [
  [-139, 48],
  [-114, 60],
];

interface Basemap {
  /** Also the value stored in `baseLayerName`. */
  name: string;
  path: string;
  maxzoom: number;
  attribution: string;
}

const BASEMAPS: Basemap[] = [
  {
    name: 'Light Gray',
    path: 'Canvas/World_Light_Gray_Base',
    maxzoom: 16,
    attribution: 'Tiles &copy; Esri',
  },
  {
    name: 'World Topographic',
    path: 'World_Topo_Map',
    maxzoom: 16,
    attribution: 'Tiles &copy; Esri',
  },
  {
    name: 'World Imagery',
    path: 'World_Imagery',
    maxzoom: 17,
    attribution: 'Tiles &copy; Esri',
  },
];

function slug(basemap: Basemap): string {
  return `basemap-${basemap.name.toLowerCase().replace(/\s+/g, '-')}`;
}

function activeBasemapName(stored: string): string {
  return BASEMAPS.some((basemap) => basemap.name === stored) ? stored : DEFAULT_BASEMAP;
}

export function Basemaps() {
  const active = activeBasemapName(useStore(baseLayerName));

  return (
    <>
      {BASEMAPS.map((basemap) => (
        <Source
          key={basemap.name}
          id={slug(basemap)}
          type="raster"
          tiles={[
            `https://server.arcgisonline.com/ArcGIS/rest/services/${basemap.path}/MapServer/tile/{z}/{y}/{x}`,
          ]}
          tileSize={256}
          maxzoom={basemap.maxzoom}
          attribution={basemap.attribution}
        >
          <Layer
            id={`${slug(basemap)}-layer`}
            type="raster"
            layout={{ visibility: basemap.name === active ? 'visible' : 'none' }}
          />
        </Source>
      ))}
    </>
  );
}

interface MapControlsProps {
  onReset: () => void;
  /** Merged into the analytics payload of every control event. */
  trackContext?: Record<string, unknown>;
  /** Adds the Overlays section to the Layers menu; only the projects map has overlays. */
  overlays?: boolean;
}

export function MapControls({ onReset, trackContext, overlays }: MapControlsProps) {
  const active = activeBasemapName(useStore(baseLayerName));
  const regionsOn = useStore(regionsVisible);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!layersOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setLayersOpen(false);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!layersRef.current?.contains(event.target as Node)) setLayersOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [layersOpen]);

  return (
    <>
      <NavigationControl position="bottom-right" showCompass={false} />
      {/* Bottom-right with the zoom buttons: the project card owns the bottom-left corner. */}
      <ScaleControl position="bottom-right" />
      <AttributionControl position="bottom-right" />

      <div className="map-controls">
        <div className="map-controls__layers" ref={layersRef}>
          <button
            type="button"
            ref={toggleRef}
            className="map-control-btn"
            aria-label="Map layers"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen((open) => !open)}
          >
            <i className="material-icons" aria-hidden="true">
              layers
            </i>
          </button>

          {layersOpen && (
            <div className="map-layers-menu">
              <div role="group" aria-label="Base map">
                {BASEMAPS.map((basemap) => (
                  <label className="map-layers-menu__row" key={basemap.name}>
                    <input
                      type="radio"
                      name="basemap"
                      value={basemap.name}
                      checked={basemap.name === active}
                      onChange={() => {
                        baseLayerName.set(basemap.name);
                        track('Map Base Layer Changed', {
                          ...trackContext,
                          layer_name: basemap.name,
                        });
                      }}
                    />
                    <span>{basemap.name}</span>
                  </label>
                ))}
              </div>

              {overlays && (
                <div className="map-layers-menu__overlays" role="group" aria-label="Overlays">
                  <p className="map-layers-menu__heading" aria-hidden="true">
                    Overlays
                  </p>
                  <label className="map-layers-menu__row">
                    <input
                      type="checkbox"
                      checked={regionsOn}
                      onChange={(event) => {
                        regionsVisible.set(event.target.checked);
                        track('Map Overlay Toggled', {
                          ...trackContext,
                          layer_name: 'Regions',
                          visible: event.target.checked,
                        });
                      }}
                    />
                    <span>Regions</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="map-control-btn map-controls__reset"
          aria-label="Reset view"
          onClick={() => {
            track('Map Reset View Clicked', { ...trackContext });
            onReset();
          }}
        >
          <i className="material-icons" aria-hidden="true">
            refresh
          </i>
        </button>
      </div>
    </>
  );
}

/** BC only: anything outside this box is bad data, not a project somewhere else. */
export function hasValidCentroid(project: Project): boolean {
  if (!project.centroid || project.centroid.length !== 2) return false;

  const [lon, lat] = project.centroid;
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    logger.warn(
      `Invalid centroid type for project ${project._id}: [${typeof lon}, ${typeof lat}]`,
      'ProjlistMap',
    );
    return false;
  }
  if (isNaN(lon) || isNaN(lat)) {
    logger.warn(`NaN centroid for project ${project._id}`, 'ProjlistMap');
    return false;
  }
  const [[west, south], [east, north]] = BC_BOUNDS;
  if (lon < west || lon > east || lat < south || lat > north) {
    logger.warn(
      `Out-of-range centroid for project ${project._id}: [${lon}, ${lat}]`,
      'ProjlistMap',
    );
    return false;
  }
  return true;
}

export function flyOptions(): { duration?: number } {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? { duration: 0 } : {};
}
