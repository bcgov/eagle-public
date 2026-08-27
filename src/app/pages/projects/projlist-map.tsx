import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from 'app/models/project';
import { logger } from 'app/config/logging';
import { baseLayerName, mapBounds } from 'app/state/map-ui';
import { ProjDetailPopup } from './proj-detail-popup';
import './projlist-map.css';

interface ProjlistMapProps {
  projects: Project[];
  loading: boolean;
  /** The filter bar, measured to keep markers clear of it when fitting bounds. */
  filtersRef: React.RefObject<HTMLDivElement | null>;
  hasActiveSearch: boolean;
  showSearchMobile: boolean;
  onCloseSearchMobile: () => void;
  onToggleCurrentApp: (project: Project) => void;
}

const MOBILE_BREAKPOINT = 768;
const VISIBILITY_UPDATE_DEBOUNCE_MS = 100;
const BC_CENTER: [number, number] = [55.5, -125.5];
const DEFAULT_ZOOM = 5.7;

// Built on first use rather than at module load, because L is a CDN global.
let icons: { normal: any; large: any } | null = null;
function markerIcons(): { normal: any; large: any } {
  icons ??= {
    normal: L.icon({
      iconUrl: 'assets/images/marker-icon-yellow.svg',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      tooltipAnchor: [16, -28],
      className: 'marker-icon-transition'
    }),
    large: L.icon({
      iconUrl: 'assets/images/marker-icon-yellow-lg.svg',
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      className: 'marker-icon-transition'
    })
  };
  return icons;
}

function createBaseLayers(): Record<string, any> {
  return {
    'Nat Geo World Map': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 16, noWrap: true }
    ),
    'World Topographic': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 16, noWrap: true }
    ),
    'World Imagery': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 17, noWrap: true }
    )
  };
}

/** BC only: anything outside this box is bad data, not a project somewhere else. */
function hasValidCentroid(project: Project): boolean {
  if (!project.centroid || project.centroid.length !== 2) return false;

  const [lon, lat] = project.centroid;
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    logger.warn(`Invalid centroid type for project ${project._id}: [${typeof lon}, ${typeof lat}]`, 'ProjlistMap');
    return false;
  }
  if (isNaN(lon) || isNaN(lat)) {
    logger.warn(`NaN centroid for project ${project._id}`, 'ProjlistMap');
    return false;
  }
  if (lat < 48 || lat > 60 || lon < -139 || lon > -114) {
    logger.warn(`Out-of-range centroid for project ${project._id}: [${lon}, ${lat}]`, 'ProjlistMap');
    return false;
  }
  return true;
}

function expandBounds(bounds: any, percent: number): any {
  const expandLat = (bounds.getNorth() - bounds.getSouth()) * percent;
  const expandLng = (bounds.getEast() - bounds.getWest()) * percent;
  return L.latLngBounds(
    L.latLng(bounds.getSouth() - expandLat, bounds.getWest() - expandLng),
    L.latLng(bounds.getNorth() + expandLat, bounds.getEast() + expandLng)
  );
}

export function ProjlistMap({
  projects,
  loading,
  filtersRef,
  hasActiveSearch,
  showSearchMobile,
  onCloseSearchMobile,
  onToggleCurrentApp
}: ProjlistMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const markersRef = useRef(new Map<string, any>());
  const popupRef = useRef<any>(null);

  const visibilityTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoSelectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recentlyClosedTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recentlyClosedId = useRef<string | null>(null);
  const lastAutoSelectedId = useRef<string | null>(null);
  const autoSelectInProgress = useRef(false);
  const isPopupOpening = useRef(false);
  /** Set when a fit was asked for before the container had a size; the resize observer replays it. */
  const pendingFit = useRef(false);

  // The node Leaflet renders the popup into; React fills it through a portal.
  const [popupHost] = useState(() => {
    const host = document.createElement('div');
    host.className = 'app-proj-detail-popup';
    return host;
  });
  const [popupProject, setPopupProject] = useState<Project | null>(null);
  const [singleVisibleId, setSingleVisibleId] = useState<string | null>(null);

  // Leaflet callbacks outlive the render that created them, so they read props through this ref.
  const latest = useRef({
    projects,
    filtersRef,
    hasActiveSearch,
    showSearchMobile,
    onCloseSearchMobile,
    onToggleCurrentApp,
    popupProject,
    singleVisibleId
  });
  useEffect(() => {
    latest.current = {
      projects,
      filtersRef,
      hasActiveSearch,
      showSearchMobile,
      onCloseSearchMobile,
      onToggleCurrentApp,
      popupProject,
      singleVisibleId
    };
  });

  const isMobile = (): boolean => window.innerWidth <= MOBILE_BREAKPOINT;

  /** The filter bar's height, so fitted bounds and popups clear the card floating over the map. */
  function filterHeight(): number {
    return latest.current.filtersRef.current?.clientHeight ?? 0;
  }

  function fitBounds(bounds: any): void {
    const map = mapRef.current;
    if (!map || !bounds?.isValid()) return;
    if (map.getSize().x === 0 || map.getSize().y === 0) {
      pendingFit.current = true;
      return;
    }
    pendingFit.current = false;

    const mobile = isMobile();
    map.fitBounds(expandBounds(bounds, mobile ? 0.05 : 0.08), {
      paddingTopLeft: L.point(mobile ? 20 : 100, mobile ? 50 : filterHeight() + 80),
      paddingBottomRight: L.point(mobile ? 20 : 100, mobile ? 50 : 80),
      animate: false,
      maxZoom: 10
    });
  }

  function fitToMarkers(): void {
    const cluster = clusterRef.current;
    if (cluster) fitBounds(cluster.getBounds());
  }

  /** Exactly one marker in view is the trigger for auto-opening its popup; nothing else reads this. */
  function updateVisibility(): void {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    let visibleId: string | null = null;
    let count = 0;
    markersRef.current.forEach((marker, id) => {
      if (bounds.contains(marker.getLatLng())) {
        count += 1;
        visibleId = id;
      }
    });
    setSingleVisibleId(count === 1 ? visibleId : null);
  }

  function scheduleVisibilityUpdate(): void {
    if (autoSelectInProgress.current) return;
    clearTimeout(visibilityTimeout.current);
    visibilityTimeout.current = setTimeout(updateVisibility, VISIBILITY_UPDATE_DEBOUNCE_MS);
  }

  function centerMapOnMarker(marker: any): void {
    const map = mapRef.current;
    if (!map) return;
    const offset = isMobile() ? 150 : filterHeight() / 2 + 180;
    const point = map.latLngToContainerPoint(marker.getLatLng());
    map.panTo(map.containerPointToLatLng(L.point(point.x, point.y - offset)), { animate: true, duration: 0.25 });
  }

  function createProjectPopup(project: Project, marker: any): void {
    if (isPopupOpening.current) {
      logger.warn('Popup creation already in progress', 'ProjlistMap');
      return;
    }
    const map = mapRef.current;
    if (!map || !marker || !clusterRef.current?.hasLayer(marker)) {
      logger.error('Cannot create popup: map or marker not ready', 'ProjlistMap');
      return;
    }

    map.closePopup();

    const existingPopup = marker.getPopup();
    if (existingPopup?.isOpen()) {
      marker.closePopup();
      return;
    }

    try {
      isPopupOpening.current = true;
      setPopupProject(project);
      latest.current.onToggleCurrentApp(project);

      const viewportWidth = window.innerWidth;
      const isNarrow = viewportWidth < 400;
      const popup = L.popup({
        className: 'map-popup-content',
        autoPan: false,
        offset: L.point(0, -30),
        closeButton: true,
        maxWidth: isNarrow ? Math.min(viewportWidth - 40, 280) : 300,
        minWidth: isNarrow ? Math.min(viewportWidth - 60, 220) : 250
      })
        .setLatLng(marker.getLatLng())
        .setContent(popupHost)
        .on('remove', () => {
          latest.current.onToggleCurrentApp(project);
          setPopupProject(null);
          // Stops the auto-open effect from immediately reopening what was just dismissed.
          recentlyClosedId.current = project._id;
          clearTimeout(recentlyClosedTimeout.current);
          recentlyClosedTimeout.current = setTimeout(() => {
            recentlyClosedId.current = null;
          }, 500);
        });

      if (existingPopup) marker.unbindPopup();
      marker.bindPopup(popup).openPopup();
      popupRef.current = popup;

      isPopupOpening.current = false;
      autoSelectInProgress.current = false;
      updateVisibility();
    } catch (error) {
      logger.error('Failed to create popup', 'ProjlistMap', error);
      setPopupProject(null);
      isPopupOpening.current = false;
      autoSelectInProgress.current = false;
    }
  }

  function selectMarker(project: Project, marker: any, isAutoSelect = false): void {
    if (isMobile()) {
      // An auto-select while the visitor is mid-search should not close the search panel on them.
      if ((!isAutoSelect || !latest.current.hasActiveSearch) && latest.current.showSearchMobile) {
        latest.current.onCloseSearchMobile();
      }
    }

    centerMapOnMarker(marker);

    if (isAutoSelect) {
      clearTimeout(autoSelectTimeout.current);
      autoSelectTimeout.current = setTimeout(() => createProjectPopup(project, marker), 300);
    } else {
      createProjectPopup(project, marker);
    }
  }

  function createMarker(project: Project): any {
    const marker = L.marker(L.latLng(project.centroid[1], project.centroid[0]), {
      title: `${project.name}\n${project.sector}\n${project.location}`
    })
      .setIcon(markerIcons().normal)
      .on('click', () => selectMarker(project, marker, false));
    return marker;
  }

  /** Reuses the markers that survive a filter change instead of redrawing the whole layer. */
  function updateMarkers(nextProjects: Project[]): void {
    const cluster = clusterRef.current;
    if (!mapRef.current || !cluster) return;

    const valid = nextProjects.filter(hasValidCentroid);
    const ids = new Set(valid.map(project => project._id));

    const toRemove: any[] = [];
    markersRef.current.forEach((marker, id) => {
      if (!ids.has(id)) {
        toRemove.push(marker);
        markersRef.current.delete(id);
      }
    });

    const toAdd: any[] = [];
    for (const project of valid) {
      const existing = markersRef.current.get(project._id);
      if (!existing) {
        const marker = createMarker(project);
        markersRef.current.set(project._id, marker);
        toAdd.push(marker);
      } else {
        const latLng = L.latLng(project.centroid[1], project.centroid[0]);
        if (!existing.getLatLng().equals(latLng)) existing.setLatLng(latLng);
      }
    }

    if (toRemove.length > 0) cluster.removeLayers(toRemove);
    if (toAdd.length > 0) cluster.addLayers(toAdd);

    scheduleVisibilityUpdate();
  }

  // Create the map once. Everything else updates the instance in place.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      logger.error('Map container not found', 'ProjlistMap');
      return;
    }

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
      removeOutsideVisibleBounds: true,
      animate: true,
      animateAddingMarkers: false,
      spiderfyDistanceMultiplier: 1.5
    });
    clusterRef.current = cluster;

    const map = L.map(element, {
      center: BC_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      maxZoom: 17,
      minZoom: 4,
      zoomSnap: 0.1,
      attributionControl: false
    });
    mapRef.current = map;

    map.on('moveend', () => {
      const bounds = map.getBounds();
      const next = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };
      // Publish only a view that actually moved. The store compares by identity, so a fresh
      // object from every `moveend` — Leaflet fires one for programmatic pans too — re-renders
      // the page, which can pan the map again.
      const current = mapBounds.get();
      const same =
        current &&
        current.north === next.north &&
        current.south === next.south &&
        current.east === next.east &&
        current.west === next.west;
      if (!same) mapBounds.set(next);
      scheduleVisibilityUpdate();
    });
    map.on('baselayerchange', (event: any) => baseLayerName.set(event.name));

    map.addLayer(cluster);

    const baseLayers = createBaseLayers();
    map.addLayer(baseLayers[baseLayerName.get()] ?? baseLayers['World Topographic']);

    L.control.scale({ position: 'bottomleft' }).addTo(map);
    L.control.layers(baseLayers, undefined, { position: 'bottomleft' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const ResetViewControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: () => {
        const button = L.DomUtil.create('button');
        button.title = 'Reset view';
        button.innerText = 'refresh';
        button.onclick = () => map.setView(BC_CENTER, DEFAULT_ZOOM);
        button.className = 'material-icons map-reset-control';
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.disableScrollPropagation(button);
        return button;
      }
    });
    map.addControl(new ResetViewControl());

    const initialBounds = map.getBounds();
    mapBounds.set({
      north: initialBounds.getNorth(),
      south: initialBounds.getSouth(),
      east: initialBounds.getEast(),
      west: initialBounds.getWest()
    });

    // The map is created before the flex layout has given the container its height, so Leaflet
    // needs telling once it has one. This also replays a fit that was asked for too early.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            map.invalidateSize(true);
            if (pendingFit.current) fitToMarkers();
          });
    observer?.observe(element);

    const markers = markersRef.current;
    return () => {
      observer?.disconnect();
      clearTimeout(visibilityTimeout.current);
      clearTimeout(autoSelectTimeout.current);
      clearTimeout(recentlyClosedTimeout.current);
      cluster.clearLayers();
      markers.clear();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      popupRef.current = null;
      mapBounds.set(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers follow the filtered project list.
  useEffect(() => {
    if (!mapRef.current) return;
    // A new project list means new candidates for auto-select.
    lastAutoSelectedId.current = null;
    autoSelectInProgress.current = false;

    updateMarkers(projects);

    if (!latest.current.popupProject && !latest.current.singleVisibleId) {
      fitToMarkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  // Open the popup by itself once filtering has narrowed the map down to a single project.
  useEffect(() => {
    if (!singleVisibleId || popupProject) return;
    if (autoSelectInProgress.current) return;
    if (lastAutoSelectedId.current === singleVisibleId) return;
    if (recentlyClosedId.current === singleVisibleId) return;

    const project = projects.find(item => item._id === singleVisibleId);
    const marker = markersRef.current.get(singleVisibleId);
    if (!project || !marker) return;

    autoSelectInProgress.current = true;
    lastAutoSelectedId.current = singleVisibleId;
    selectMarker(project, marker, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleVisibleId, popupProject, projects]);

  // The project with the open popup gets the large marker; every other marker is reset.
  useEffect(() => {
    if (!mapRef.current) return;
    const { normal, large } = markerIcons();
    markersRef.current.forEach((marker, id) => {
      marker.setIcon(id === popupProject?._id ? large : normal);
    });
    // Leaflet sized the popup around an empty node, so re-measure now that React has filled it.
    popupRef.current?.update?.();
  }, [popupProject]);

  return (
    <div className="app-map">
      <div className={`map-container${loading ? ' loading' : ''}`}>
        <div ref={containerRef} id="map" aria-label="Map of B.C. that displays EAO Projects" />
      </div>
      {popupProject && createPortal(<ProjDetailPopup project={popupProject} />, popupHost)}
    </div>
  );
}
