import { useEffect, useRef } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import { track } from 'app/analytics/analytics';
import { Basemaps, EMPTY_STYLE, WORKER_URL } from 'app/map/basemaps';
import type { Project } from 'app/models/project';

// Shows the towns and highways around the pin in a ~12rem map, not just the site.
const START_ZOOM = 6;
// The pin's tip marks the spot, so its body sits above it. 36px of top padding (the `.map-pin`
// height in basemaps.css) moves the centre 18px, putting the pin's middle at the map's middle.
const PIN_CENTRE_PADDING = { top: 36, bottom: 0, left: 0, right: 0 };

interface DetailsMapProps {
  /** Caller only renders this once `project.centroid` has two entries. */
  project: Project;
}

export function DetailsMap({ project }: DetailsMapProps) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const centroid = project.centroid as [number, number];

  useEffect(() => {
    return () => resizeObserverRef.current?.disconnect();
  }, [project._id]);

  return (
    <div className="map" ref={containerRef}>
      <Map
        key={project._id}
        ref={mapRef}
        initialViewState={{
          longitude: centroid[0],
          latitude: centroid[1],
          zoom: START_ZOOM,
          padding: PIN_CENTRE_PADDING,
        }}
        mapStyle={EMPTY_STYLE}
        workerUrl={WORKER_URL}
        // Ctrl or Cmd + scroll zooms and two fingers pan, so the page still scrolls past the map.
        cooperativeGestures
        dragRotate={false}
        touchPitch={false}
        locale={{ 'Map.Title': `Map of ${project.name} location` }}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        onLoad={({ target: map }) => {
          // `dragRotate` covers the mouse only; a two-finger twist still rotates.
          map.touchZoomRotate.disableRotation();
          if (typeof ResizeObserver === 'undefined' || !containerRef.current) return;
          const observer = new ResizeObserver(() => mapRef.current?.resize());
          observer.observe(containerRef.current);
          resizeObserverRef.current = observer;
        }}
      >
        <Basemaps />
        <Marker
          longitude={centroid[0]}
          latitude={centroid[1]}
          anchor="bottom"
          onClick={() =>
            track('Map Marker Clicked', {
              project_id: project._id,
              project_name: project.name,
              map_zoom_level: mapRef.current?.getZoom(),
            })
          }
        >
          <button type="button" className="map-pin" aria-hidden="true" tabIndex={-1}>
            <span className="map-pin__label">{project.name}</span>
          </button>
        </Marker>
      </Map>
    </div>
  );
}
