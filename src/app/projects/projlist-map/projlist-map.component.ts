import {
  Component,
  AfterViewInit,
  OnDestroy,
  input,
  output,
  signal,
  effect,
  untracked,
  ElementRef,
  Injector,
  ViewContainerRef,
  ViewChild,
  inject
} from '@angular/core';
import { Subject } from 'rxjs';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { Project } from '../../models/project';
import { ProjectService } from '../../services/project.service';
import { ConfigService } from '../../services/config.service';
import { ProjDetailPopupComponent } from '../proj-detail-popup/proj-detail-popup.component';

declare module 'leaflet' {
  export interface FeatureGroup<P = any> {
    projectId: string;
  }
  export interface Marker<P = any> {
    projectId: string;
  }
}

const markerIconYellow = L.icon({
  iconUrl: 'assets/images/marker-icon-yellow.svg',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  tooltipAnchor: [16, -28]
});

const markerIconYellowLg = L.icon({
  iconUrl: 'assets/images/marker-icon-yellow-lg.svg',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
});

@Component({
  selector: 'app-projlist-map',
  templateUrl: './projlist-map.component.html',
  styleUrls: ['./projlist-map.component.css'],
  standalone: true
})
export class ProjlistMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  
  projects = input<Project[]>([]);
  applist = input<any>();
  appfilters = input<any>();
  updateVisible = output<void>();
  reloadApps = output<void>();

  private elementRef = inject(ElementRef);
  public configService = inject(ConfigService);
  private injector = inject(Injector);
  private viewContainerRef = inject(ViewContainerRef);

  private map: L.Map | null = null;
  private markerList: L.Marker[] = [];
  private currentMarker: L.Marker | null = null;
  private markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
  });
  public loading = signal(false);
  private destroy$ = new Subject<void>();
  private isInitialized = false;
  private hasAutoOpenedPopup = false;

  constructor() {
    // Watch for project changes and redraw all markers
    effect(() => {
      const currentProjects = this.projects();
      
      // Skip if map not initialized
      if (!this.isInitialized || !this.map) {
        return;
      }

      // Use untracked to prevent reactive cycles
      untracked(() => {
        this.redrawAllMarkers(currentProjects);
      });
    });
  }

  /**
   * Clear all markers and redraw from scratch
   */
  private redrawAllMarkers(projects: Project[]): void {
    // Clear existing markers
    this.markerClusterGroup.clearLayers();
    this.markerList = [];
    this.currentMarker = null;
    this.hasAutoOpenedPopup = false; // Reset auto-open flag when redrawing

    // Add markers for all projects
    projects.forEach(project => {
      if (project.centroid?.length === 2) {
        const marker = this.createMarker(project);
        this.markerList.push(marker);
        this.markerClusterGroup.addLayer(marker);
      }
    });

    this.updateVisibleProjects();
  }

  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]);
  readonly bcCenter: L.LatLngExpression = [54, -126.5];
  readonly defaultZoom = 6;

  ngAfterViewInit() {
    if (!this.mapContainer?.nativeElement) {
      console.error('Map container not found');
      return;
    }

    this.initializeMap();
  }

  private initializeMap(): void {
    const mapElement = this.mapContainer.nativeElement;
    const self = this;

    // Create reset view control
    const resetViewControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        const element = L.DomUtil.create('button');
        element.title = 'Reset view';
        element.innerText = 'refresh';
        element.onclick = () => self.resetView();
        element.className = 'material-icons map-reset-control';
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
        return element;
      },
    });

    // Define base layers
    const baseLayers = this.createBaseLayers();

    // Initialize map centered on BC
    this.map = L.map(mapElement, {
      center: this.bcCenter,
      zoom: this.defaultZoom,
      zoomControl: false,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      maxZoom: 17,
      minZoom: 4,
      zoomSnap: 0.1,
      attributionControl: false
    });

    // Add event listeners
    this.map.on('moveend', () => this.updateVisibleProjects());
    this.map.on('baselayerchange', (e: L.LayersControlEvent) => {
      this.configService.baseLayerName = e.name;
    });

    // Add marker cluster group
    this.map.addLayer(this.markerClusterGroup);

    // Add default base layer
    const defaultLayer = baseLayers[this.configService.baseLayerName] || baseLayers['World Topographic'];
    this.map.addLayer(defaultLayer);

    // Add map controls
    L.control.layers(baseLayers, undefined, { position: 'topright' }).addTo(this.map);
    L.control.attribution({ position: 'bottomright' }).addTo(this.map);
    L.control.scale({ position: 'bottomleft' }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.map.addControl(new resetViewControl());

    // Initialize map with proper sizing
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        this.fixMap();
      }
    }, 100);
  }

  private createBaseLayers(): { [key: string]: L.TileLayer } {
    return {
      'Ocean Base': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 13,
        noWrap: true
      }),
      'Nat Geo World Map': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 16,
        noWrap: true
      }),
      'World Topographic': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 16,
        noWrap: true
      }),
      'World Imagery': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 17,
        noWrap: true
      })
    };
  }

  private fixMap(): void {
    if (!this.elementRef.nativeElement.offsetParent) {
      setTimeout(() => this.fixMap(), 50);
      return;
    }

    if (this.map) {
      this.map.invalidateSize();
      this.isInitialized = true;
      this.redrawAllMarkers(this.projects());
    }
  }

  private resetView(): void {
    if (this.map) {
      this.map.setView(this.bcCenter, this.defaultZoom);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.visibilityUpdateTimeout);
    this.map?.remove();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private visibilityUpdateTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Debounced version to update which projects are visible in the current map bounds
   */
  private updateVisibleProjects = (): void => {
    clearTimeout(this.visibilityUpdateTimeout);
    this.visibilityUpdateTimeout = setTimeout(() => this.updateProjectVisibility(), 250);
  };

  /**
   * Update which projects are visible in the current map bounds
   */
  private updateProjectVisibility(): void {
    const mapBounds = this.map!.getBounds();
    const projectsList = this.projects();

    for (const marker of this.markerList) {
      const project = projectsList.find(p => p._id === (marker as any).projectId);
      if (project) {
        project.isVisible = mapBounds.contains(marker.getLatLng());

        // Auto-open popup if only one marker is visible (but only once)
        if (this.markerList.length === 1 && project.isVisible && !this.hasAutoOpenedPopup) {
          if (!marker.getPopup()) {
            this.createProjectPopup(project, marker);
          }
          marker.openPopup();
          this.hasAutoOpenedPopup = true;
        }
      }
    }

    // Notify parent component (wrapped in untracked to prevent reactive cycles)
    untracked(() => this.updateVisible.emit());
  }

  private fitBounds(bounds: L.LatLngBounds | null = null): void {
    if (!this.map) return;
    
    const appfiltersValue = this.appfilters();
    const fitBoundsOptions: L.FitBoundsOptions = {
      paddingTopLeft: L.point(0, appfiltersValue?.clientHeight || 0),
      animate: false,
      maxZoom: 13
    };

    if (bounds && bounds.isValid()) {
      this.map.fitBounds(bounds, fitBoundsOptions);
    } else {
      this.map.fitBounds(this.defaultBounds, fitBoundsOptions);
    }
  }

  /**
   * Create a Leaflet marker for a project
   */
  private createMarker(project: Project): L.Marker {
    const title = `${project.name}\n${project.sector}\n${project.location}`;
    const marker = L.marker(
      L.latLng(project.centroid[1], project.centroid[0]),
      { title }
    )
      .setIcon(markerIconYellow)
      .on('click', (e) => this.onMarkerClick(project, e));
    
    (marker as any).projectId = project._id;
    return marker;
  }

  /**
   * Handle marker click event
   */
  private onMarkerClick(project: Project, event: L.LeafletMouseEvent): void {
    this.createProjectPopup(project, event.target as L.Marker);
  }

  /**
   * Create and display a popup for a project marker
   */
  private createProjectPopup(project: Project, marker: L.Marker): void {
    // Close popup if already open
    const existingPopup = marker.getPopup();
    if (existingPopup?.isOpen()) {
      marker.closePopup();
      return;
    }

    // Update list selection
    this.applist()?.toggleCurrentApp(project);

    // Determine popup padding based on map size
    const mapHeight = this.map!.getSize().y;
    const popupOptions = {
      className: 'map-popup-content',
      autoPan: false, // Disable Leaflet's auto-pan, we'll handle centering manually
      offset: L.point(0, -35), // Offset popup upward to appear above marker
      autoPanPaddingTopLeft: L.point(mapHeight < 800 ? 2 : 80, mapHeight < 800 ? 100 : 200),
      autoPanPaddingBottomRight: L.point(mapHeight < 800 ? 2 : 80, 30)
    };

    // Create popup component
    this.viewContainerRef.clear();
    const compRef = this.viewContainerRef.createComponent(ProjDetailPopupComponent, { injector: this.injector });
    compRef.instance.proj = project;
    
    const popupElement = document.createElement('div');
    popupElement.appendChild(compRef.location.nativeElement);

    const popup = L.popup(popupOptions)
      .setLatLng(marker.getLatLng())
      .setContent(popupElement)
      .on('remove', () => {
        // Clear selection and reset marker icon
        this.applist()?.toggleCurrentApp(project);
        this.resetMarkerIcon(marker);
        marker.unbindPopup();
      });

    marker.bindPopup(popup).openPopup();

    // Center map on marker after popup opens
    setTimeout(() => this.centerMap(marker.getLatLng()), 0);
  }

  /**
   * Highlight or unhighlight a project marker
   */
  onHighlightProject(project: Project, show: boolean): void {
    // Reset previous marker
    this.resetMarkerIcon();

    // Highlight new marker
    if (show) {
      const marker = this.markerList.find(m => (m as any).projectId === project._id);
      if (marker) {
        this.currentMarker = marker;
        marker.setIcon(markerIconYellowLg);
      }
    }
  }

  /**
   * Reset marker icon to default
   */
  private resetMarkerIcon(marker?: L.Marker): void {
    const markerToReset = marker || this.currentMarker;
    if (markerToReset) {
      markerToReset.setIcon(markerIconYellow);
      if (!marker) {
        this.currentMarker = null;
      }
    }
  }

  /**
   * Reset map to default bounds
   */
  resetMap(): void {
    this.fitBounds();
  }

  /**
   * Center map on a location, accounting for UI overlays
   */
  centerMap(latlng: L.LatLng): void {
    if (!this.map) return;
    
    let point = this.map.latLngToLayerPoint(latlng);

    // Adjust for list panel if visible
    if (this.configService.isApplistListVisible) {
      const applistWidth = this.applist()?.clientWidth ?? 0;
      point = point.subtract([applistWidth / 2, 0]);
    }

    // Adjust for filter panel
    const filterHeight = this.appfilters()?.clientHeight ?? 0;
    point = point.subtract([0, filterHeight / 2]);

    this.map.panTo(this.map.layerPointToLatLng(point));
  }

  onLoadStart(): void {
    this.loading.set(true);
  }

  onLoadEnd(): void {
    this.loading.set(false);
  }
}
