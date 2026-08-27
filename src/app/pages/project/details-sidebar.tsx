import { useEffect, useRef } from 'react';
import { track } from 'app/analytics/analytics';
import { getBaseLayerName, setBaseLayerName } from 'app/config/config';
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

const BASE_LAYERS: { name: string; url: string; maxZoom: number; attribution: string }[] = [
  {
    name: 'Ocean Base',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 13,
    attribution:
      'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri'
  },
  {
    name: 'Nat Geo World Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution:
      'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC'
  },
  {
    name: 'World Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution:
      'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
  },
  {
    name: 'World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 17,
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }
];

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

/** Adds the "reset view" button that recentres the map on the project marker. */
function resetViewControl(onReset: () => void): any {
  const Control = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const element = L.DomUtil.create('i', 'material-icons leaflet-bar leaflet-control leaflet-control-custom');
      element.title = 'Reset view';
      element.innerText = 'refresh';
      element.style.width = '34px';
      element.style.height = '20%';
      element.style.lineHeight = '30px';
      element.style.textAlign = 'center';
      element.style.cursor = 'pointer';
      element.style.backgroundColor = '#fff';
      element.style.color = '#333';
      element.onmouseover = () => (element.style.backgroundColor = '#f4f4f4');
      element.onmouseout = () => (element.style.backgroundColor = '#fff');
      element.onclick = onReset;
      L.DomEvent.disableClickPropagation(element);
      L.DomEvent.disableScrollPropagation(element);
      return element;
    }
  });
  return new Control();
}

export function DetailsSidebar({ project, loading = false, open, onToggle }: DetailsSidebarProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const hasMap = project?.centroid?.length === 2;

  useEffect(() => {
    const element = mapElement.current;
    if (!element || !project || project.centroid?.length !== 2) {
      return;
    }

    const [longitude, latitude] = project.centroid;
    const centre: [number, number] = [latitude, longitude];

    const map = L.map(element, {
      zoomControl: false,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      zoomSnap: 0.1,
      attributionControl: false
    });

    map.addControl(
      resetViewControl(() => {
        track('Map Reset View Clicked', { project_id: project._id, project_name: project.name });
        map.setView(centre, MARKER_ZOOM);
      })
    );
    L.control.zoom({ position: 'topleft' }).addTo(map);

    const layers = Object.fromEntries(
      BASE_LAYERS.map(layer => [
        layer.name,
        L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: layer.maxZoom, noWrap: true })
      ])
    );
    L.control.layers(layers).addTo(map);
    layers[getBaseLayerName()]?.addTo(map);

    map.on('baselayerchange', (event: any) => {
      setBaseLayerName(event.name);
      track('Map Base Layer Changed', { project_id: project._id, project_name: project.name, layer_name: event.name });
    });
    map.scrollWheelZoom.disable();

    const marker = L.marker(L.latLng(latitude, longitude), {
      title: `${project.name}\n${project.sector}\n${project.location}\n`
    }).setIcon(
      L.icon({
        iconUrl: 'assets/images/marker-icon-yellow.svg',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        tooltipAnchor: [16, -28]
      })
    );
    marker.on('click', () =>
      track('Map Marker Clicked', { project_id: project._id, project_name: project.name, map_zoom_level: map.getZoom() })
    );
    map.addLayer(marker);
    map.setView(centre, MARKER_ZOOM);

    // The sidebar animates open and closed, so the container's size changes without a window
    // resize; Leaflet needs telling either way.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(element);

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [project]);

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
              ) : hasMap ? (
                <div className="map-container">
                  <div className="map" id="map" ref={mapElement}></div>
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
