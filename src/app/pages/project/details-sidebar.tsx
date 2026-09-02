import { useRef } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import { track } from 'app/analytics/analytics';
import { Basemaps, EMPTY_STYLE, MapControls, WORKER_URL, flyOptions } from 'app/map/basemaps';
import type { Project } from 'app/models/project';
import { Constants } from 'app/utils/constants';
import './details-sidebar.css';

interface DetailsSidebarProps {
  project: Project | null;
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
}

const MARKER_ZOOM = 8;

function legislationLink(project: Project | null): string {
  const legislation = project?.legislation ?? '';
  if (legislation.includes('2002')) {
    return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2002_LINK;
  }
  if (legislation.includes('1996')) {
    return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_1996_LINK;
  }
  return Constants.legislationLinks.ENVIRONMENTAL_ASSESSMENT_ACT_2018_LINK;
}

export function DetailsSidebar({ project, loading = false, open, onToggle }: DetailsSidebarProps) {
  const mapRef = useRef<MapRef>(null);
  const centroid = project?.centroid?.length === 2 ? project.centroid : null;

  return (
    <div className="sidebar-wrapper">
      <aside className={`side-banner p-0${open ? '' : ' closed'}`}>
        <div className={`sidebar-content${loading ? ' placeholder-wave' : ''}`} aria-busy={loading || undefined}>
          {loading && <span className="visually-hidden">Loading project</span>}
          <h1 className="project-name">
            {loading ? <span className="placeholder col-9" aria-hidden="true"></span> : project?.name || '-'}
          </h1>

          <div className="info-section">
            <div className="info-block">
              <span className="info-label">Environmental Assessment</span>
              <p>
                {loading ? (
                  <span className="ea-decision placeholder col-7" aria-hidden="true">{'\u00a0'}</span>
                ) : (
                  <span className="ea-decision">{project?.eacDecision?.name || '-'}</span>
                )}
              </p>
            </div>

            <div className="info-block">
              <span className="info-label">Legislation</span>
              {loading ? (
                <p className="info-value">
                  <span className="placeholder col-10" aria-hidden="true"></span>
                </p>
              ) : (
                <a target="_blank" href={legislationLink(project)} className="info-link" rel="noreferrer">
                  <p className="info-value hyperlink">{project?.legislation || '-'}</p>
                </a>
              )}
            </div>

            <hr className="divider" />

            <div className="info-block">
              <span className="info-label">Region</span>
              <p className="info-value">
                {loading ? <span className="placeholder col-6" aria-hidden="true"></span> : project?.region || '-'}
              </p>
            </div>

            <div className="info-block">
              <span className="info-label">Location</span>
              <p className="info-value">
                {loading ? <span className="placeholder col-8" aria-hidden="true"></span> : project?.location || '-'}
              </p>
            </div>

            <div className="map-wrapper">
              {loading ? (
                <div className="map-container">
                  <span className="placeholder w-100 h-100" aria-hidden="true" />
                </div>
              ) : centroid && project ? (
                <div className="map-container">
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
                </div>
              ) : (
                <div className="map-placeholder">
                  <span>No map available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <button className="sidebar-toggle" onClick={onToggle} aria-label={open ? 'Close sidebar' : 'Open sidebar'}>
        <i className="material-icons">{open ? 'keyboard_arrow_left' : 'keyboard_arrow_right'}</i>
      </button>
    </div>
  );
}
