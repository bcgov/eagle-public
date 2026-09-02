import { useRef } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import { track } from 'app/analytics/analytics';
import { Basemaps, EMPTY_STYLE, MapControls, WORKER_URL, flyOptions } from 'app/map/basemaps';
import type { Project } from 'app/models/project';

const MARKER_ZOOM = 8;

interface DetailsMapProps {
  /** Caller only renders this once `project.centroid` has two entries. */
  project: Project;
}

export function DetailsMap({ project }: DetailsMapProps) {
  const mapRef = useRef<MapRef>(null);
  const centroid = project.centroid as [number, number];

  return (
    <div className="map">
      <Map
        key={project._id}
        ref={mapRef}
        initialViewState={{ longitude: centroid[0], latitude: centroid[1], zoom: MARKER_ZOOM }}
        mapStyle={EMPTY_STYLE}
        workerUrl={WORKER_URL}
        scrollZoom={false}
        // A one-finger drag on a map this small traps the page scroll; pinch and
        // the zoom buttons still move it.
        dragPan={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Basemaps />
        <MapControls
          onReset={() =>
            mapRef.current?.flyTo({
              center: [centroid[0], centroid[1]],
              zoom: MARKER_ZOOM,
              ...flyOptions()
            })
          }
          trackContext={{ project_id: project._id, project_name: project.name }}
        />
        <Marker
          longitude={centroid[0]}
          latitude={centroid[1]}
          anchor="bottom"
          onClick={() =>
            track('Map Marker Clicked', {
              project_id: project._id,
              project_name: project.name,
              map_zoom_level: mapRef.current?.getZoom()
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
