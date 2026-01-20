import {
  Component,
  AfterViewInit,
  OnDestroy,
  input,
  output,
  effect,
  untracked,
  ElementRef,
  Injector,
  ViewContainerRef,
  ViewChild,
  inject,
  computed
} from '@angular/core';
import { Subject } from 'rxjs';


import { Project } from '../../models/project';
import { ConfigService } from '../../services/config.service';
import { MapStateService } from '../../services/map-state.service';
import { LoggingService } from '../../services/logging.service';
import { LoadingStateService } from '../../services/loading-state.service';
import { FilterStateService } from '../../services/filter-state.service';
import { ProjDetailPopupComponent } from '../proj-detail-popup/proj-detail-popup.component';

const markerIconYellow = L.icon({
  iconUrl: 'assets/images/marker-icon-yellow.svg',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  tooltipAnchor: [16, -28],
  className: 'marker-icon-transition'
});

const markerIconYellowLg = L.icon({
  iconUrl: 'assets/images/marker-icon-yellow-lg.svg',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  className: 'marker-icon-transition'
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
  reloadApps = output<void>();

  private elementRef = inject(ElementRef);
  public configService = inject(ConfigService);
  private mapStateService = inject(MapStateService);
  private filterState = inject(FilterStateService);
  private injector = inject(Injector);
  private viewContainerRef = inject(ViewContainerRef);
  private logger = inject(LoggingService);
  private loadingState = inject(LoadingStateService);

  private map: any = null;
  private markerClusterGroup!: any;
  // Map loading state - observes loading states from services that make API calls
  // - storage-preload: StorageService background preload
  // - projects-full-page-1: ProjectService.getAllFull() when cache not available
  public loading = computed(() =>
    this.loadingState.getOperationState('storage-preload')() ||
    this.loadingState.getOperationState('projects-full-page-1')()
  );
  // Constants
  private readonly MOBILE_BREAKPOINT = 768;
  private readonly VISIBILITY_UPDATE_DEBOUNCE_MS = 100;

  private destroy$ = new Subject<void>();
  private resizeObserver?: ResizeObserver;
  private isPopupOpening = false; // Guard against concurrent popup creation
  private recentlyClosedProjectId: string | null = null; // Track manual closes to prevent immediate reopen
  private recentlyClosedTimeout?: ReturnType<typeof setTimeout>;
  private autoSelectInProgress = false; // Guard against multiple auto-select calls
  private lastAutoSelectedProjectId: string | null = null; // Track last auto-selected project

  // Popup component instance for reuse
  private popupComponentRef: any = null;

  /**
   * Check if current viewport is mobile size
   */
  private isMobile(): boolean {
    return window.innerWidth <= this.MOBILE_BREAKPOINT;
  }

  /**
   * Get filter bar height for layout calculations
   */
  private getFilterHeight(): number {
    const appfiltersValue = this.appfilters();
    return appfiltersValue?.clientHeight || 0;
  }

  /**
   * Calculate padding values for map bounds fitting
   */
  private calculateFitBoundsPadding(): { top: number; side: number; expansion: number } {
    const isMobile = this.isMobile();
    const filterHeight = this.getFilterHeight();

    return {
      top: isMobile ? 50 : filterHeight + 175,
      side: isMobile ? 20 : 50,
      expansion: isMobile ? 0.05 : 0.1
    };
  }

  /**
   * Calculate vertical offset for centering markers with popups
   */
  private calculatePopupOffset(): number {
    const filterHeight = this.getFilterHeight();
    return (filterHeight / 2) + 180;
  }

  constructor() {
    // Watch for filter changes to reset auto-select tracking
    effect(() => {
      // Track any filter change
      this.filterState.applicantFilter();
      this.filterState.selectedRegions();
      this.filterState.selectedPhases();
      this.filterState.selectedTypes();
      
      untracked(() => {
        // Reset auto-select tracking when filters change to allow new auto-select
        this.lastAutoSelectedProjectId = null;
        this.autoSelectInProgress = false;
      });
    });

    // Watch for project changes and update markers
    effect(() => {
      const currentProjects = this.projects();

      if (!this.map || !this.markerClusterGroup) {
        return;
      }

      untracked(() => {
        this.updateMarkers(currentProjects);

        const hasActivePopup = this.mapStateService.activePopupProject();
        const singleVisible = this.mapStateService.singleVisibleProject();

        // Don't auto-fit if popup is open OR we're about to auto-open one
        if (!hasActivePopup && !singleVisible) {
          const bounds = this.markerClusterGroup.getBounds();
          if (bounds.isValid()) {
            this.fitBounds(bounds);
          }
        }
      });
    });

    // Watch for active popup changes to highlight marker
    effect(() => {
      const activeProjectId = this.mapStateService.activePopupProject();

      untracked(() => {
        this.highlightMarker(activeProjectId);
      });
    });

    // Auto-select marker when exactly one is visible
    effect(() => {
      const shouldAutoOpen = this.mapStateService.shouldAutoOpenPopup();
      const singleVisible = this.mapStateService.singleVisibleProject();

      if (shouldAutoOpen && singleVisible) {
        untracked(() => {
          // Prevent multiple auto-select calls for the same project
          if (this.autoSelectInProgress || this.lastAutoSelectedProjectId === singleVisible.projectId) {
            return;
          }

          this.autoSelectMarker();
        });
      }
    });
  }

  ngAfterViewInit(): void {
    // Wait for container to have dimensions before initializing
    this.waitForContainer();
  }

  /**
   * Incrementally update markers based on project changes.
   * Reuses existing markers when possible instead of full redraw.
   */
  private updateMarkers(projects: Project[]): void {
    if (!this.map || !this.markerClusterGroup) {
      return;
    }

    const currentMarkers = this.mapStateService.getAllMarkers();
    const projectIds = new Set(projects.filter(p => this.hasValidCentroid(p)).map(p => p._id));

    // Batch marker operations
    const markersToRemove: any[] = [];
    const markersToAdd: any[] = [];

    // Collect markers to remove
    currentMarkers.forEach((markerState, projectId) => {
      if (!projectIds.has(projectId)) {
        markersToRemove.push(markerState.marker);
        this.mapStateService.removeMarker(projectId);
      }
    });

    // Collect markers to add or update
    projects.forEach(project => {
      if (this.hasValidCentroid(project)) {
        const existingMarker = this.mapStateService.getMarker(project._id);

        if (!existingMarker) {
          const marker = this.createMarker(project);
          this.mapStateService.setMarker(project._id, marker, true);
          markersToAdd.push(marker);
        } else {
          const newLatLng = L.latLng(project.centroid[1], project.centroid[0]);
          if (!existingMarker.getLatLng().equals(newLatLng)) {
            existingMarker.setLatLng(newLatLng);
          }
        }
      }
    });

    // Apply batch operations
    if (markersToRemove.length > 0) {
      this.markerClusterGroup.removeLayers(markersToRemove);
    }
    if (markersToAdd.length > 0) {
      this.markerClusterGroup.addLayers(markersToAdd);
    }

    this.updateVisibleProjects();
  }

  /**
   * Check if project has valid centroid coordinates
   */
  private hasValidCentroid(project: Project): boolean {
    return project.centroid?.length === 2;
  }

  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]);
  // Center of BC coordinates
  readonly bcCenter: any = [55.5, -125.5];
  readonly defaultZoom = 5.7;

  /**
   * Wait for map container to have dimensions before initializing
   * This prevents Leaflet from initializing with height: 0
   * Ref: https://github.com/Leaflet/Leaflet/issues/4835
   */
  private waitForContainer(): void {
    const container = this.mapContainer?.nativeElement;
    if (!container) {
      this.logger.error('Map container not found', 'ProjlistMapComponent');
      return;
    }

    // Check if container has dimensions
    const rect = container.getBoundingClientRect();
    if (rect.height > 0 && rect.width > 0) {
      this.initializeMap();
    } else {
      // Wait a bit and try again
      setTimeout(() => this.waitForContainer(), 50);
    }
  }

  private initializeMap(): void {
    const mapElement = this.mapContainer?.nativeElement;
    if (!mapElement) {
      this.logger.error('Map container not found', 'ProjlistMapComponent');
      return;
    }

    // Create fresh marker cluster group
    this.markerClusterGroup = L.markerClusterGroup({
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

    // eslint-disable-next-line @typescript-eslint/no-this-alias
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

    // Store map reference in state service
    if (this.map) {
      this.mapStateService.setMap(this.map);

      // Add event listeners
      this.map.on('moveend', () => {
        if (this.map) {
          this.mapStateService.updateBounds(this.map.getBounds());
        }
        this.updateVisibleProjects();
      });

      this.map.on('baselayerchange', (e: any) => {
        this.configService.baseLayerName = e.name;
        this.mapStateService.setBaseLayer(e.name);
      });

      // Add marker cluster group
      this.map.addLayer(this.markerClusterGroup);

      // Add default base layer
      const savedLayerName = this.configService.baseLayerName;
      const defaultLayer = baseLayers[savedLayerName] || baseLayers['World Topographic'];
      this.map.addLayer(defaultLayer);
      this.mapStateService.setBaseLayer(savedLayerName || 'World Topographic');

      // Add map controls
      L.control.scale({ position: 'bottomleft' }).addTo(this.map);
      L.control.layers(baseLayers, undefined, { position: 'bottomleft' }).addTo(this.map);
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.map.addControl(new resetViewControl());

      // Initialize bounds
      this.mapStateService.updateBounds(this.map.getBounds());

      // Use whenReady to ensure map is fully initialized before adding markers
      this.map.whenReady(() => {
        if (this.map) {
          this.map.invalidateSize(true);
        }

        // Trigger marker update now that map is ready
        const currentProjects = this.projects();
        this.updateMarkers(currentProjects);

        // Auto-reposition after markers are added
        setTimeout(() => {
          if (this.markerClusterGroup) {
            const bounds = this.markerClusterGroup.getBounds();
            if (bounds.isValid()) {
              this.fitBounds(bounds);
            }
          }
        }, 100);
      });
    }
  }

  private createBaseLayers(): Record<string, any> {
    return {
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

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined' || !this.mapContainer?.nativeElement) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      if (this.map) {
        this.map.invalidateSize(true);
      }
    });

    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private resetView(): void {
    if (this.map) {
      this.map.setView(this.bcCenter, this.defaultZoom);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.visibilityUpdateTimeout);
    clearTimeout(this.recentlyClosedTimeout);
    this.resizeObserver?.disconnect();

    // Clean up popup component
    if (this.popupComponentRef) {
      this.popupComponentRef.destroy();
      this.popupComponentRef = null;
    }

    // Clear marker cluster group
    this.markerClusterGroup?.clearLayers();

    // Clean up map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Reset service state for clean initialization next time
    this.mapStateService.reset();

    this.destroy$.next();
    this.destroy$.complete();
  }

  private visibilityUpdateTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Debounced version to update which projects are visible in the current map bounds
   */
  private updateVisibleProjects = (): void => {
    // Skip updates during auto-select to prevent state changes during pan animation
    if (this.autoSelectInProgress) {
      return;
    }
    
    clearTimeout(this.visibilityUpdateTimeout);
    this.visibilityUpdateTimeout = setTimeout(() => this.updateProjectVisibility(), this.VISIBILITY_UPDATE_DEBOUNCE_MS);
  };

  /**
   * Update which projects are visible in the current map bounds.
   * Uses MapStateService to track visibility without mutating Project objects.
   */
  private updateProjectVisibility(): void {
    if (!this.map) return;

    const mapBounds = this.map.getBounds();
    const projectsList = this.projects();
    const markers = this.mapStateService.getAllMarkers();

    // Create Map for O(1) lookups
    const projectsMap = new Map(projectsList.map(p => [p._id, p]));

    markers.forEach((markerState, projectId) => {
      const project = projectsMap.get(projectId);
      if (project) {
        const isVisible = mapBounds.contains(markerState.marker.getLatLng());
        this.mapStateService.setMarkerVisibility(projectId, isVisible);
      }
    });
  }

  private fitBounds(bounds: any = null, animate = false): void {
    if (!this.map) return;

    const padding = this.calculateFitBoundsPadding();

    // Expand bounds to ensure markers don't appear at edges
    let boundsToFit = bounds || this.defaultBounds;
    if (bounds && bounds.isValid()) {
      boundsToFit = this.expandBounds(bounds, padding.expansion);
    }

    const fitBoundsOptions = {
      paddingTopLeft: (L as any).point(padding.side, padding.top),
      paddingBottomRight: (L as any).point(padding.side, padding.side),
      animate: animate,
      duration: animate ? 0.5 : undefined,
      maxZoom: 10 // Prevent over-zooming when fitting to single marker or tight bounds
    };

    this.map.fitBounds(boundsToFit, fitBoundsOptions);
  }

  /**
   * Expand map bounds by a percentage to add buffer around markers
   */
  private expandBounds(bounds: any, expansionPercent: number): any {
    const latDiff = bounds.getNorth() - bounds.getSouth();
    const lngDiff = bounds.getEast() - bounds.getWest();
    const expandLat = latDiff * expansionPercent;
    const expandLng = lngDiff * expansionPercent;

    return L.latLngBounds(
      L.latLng(bounds.getSouth() - expandLat, bounds.getWest() - expandLng),
      L.latLng(bounds.getNorth() + expandLat, bounds.getEast() + expandLng)
    );
  }

  /**
   * Create a Leaflet marker for a project
   */
  private createMarker(project: Project): any {
    const title = `${project.name}\n${project.sector}\n${project.location}`;
    const marker = L.marker(
      L.latLng(project.centroid[1], project.centroid[0]),
      { title }
    )
      .setIcon(markerIconYellow)
      .on('click', (e: any) => this.onMarkerClick(project, e));

    (marker as any).projectId = project._id;
    return marker;
  }

  /**
   * Handle marker click event
   */
  private onMarkerClick(project: Project, event: any): void {
    this.selectMarker(project, event.target, false);
  }

  /**
   * Auto-select marker when exactly one is visible in map bounds
   * Reuses existing selectMarker logic but checks against recent manual closes
   */
  private autoSelectMarker(): void {
    const singleVisible = this.mapStateService.singleVisibleProject();
    if (!singleVisible) return;

    // Prevent duplicate auto-select or reopening recently closed popups
    if (this.autoSelectInProgress || 
        this.lastAutoSelectedProjectId === singleVisible.projectId ||
        this.recentlyClosedProjectId === singleVisible.projectId) {
      return;
    }

    const project = this.projects().find(p => p._id === singleVisible.projectId);
    if (!project) {
      this.logger.warn(
        `Could not find project data for auto-select: ${singleVisible.projectId}`,
        'ProjlistMapComponent'
      );
      return;
    }

    this.autoSelectInProgress = true;
    this.lastAutoSelectedProjectId = singleVisible.projectId;

    this.logger.debug(`Auto-selecting marker for project: ${project.name}`, 'ProjlistMapComponent');
    this.selectMarker(project, singleVisible.marker, true);
  }

  /**
   * Handle marker selection - opens popup and centers map
   * @param isAutoSelect - true for auto-select on page load, false for manual clicks
   */
  private selectMarker(project: Project, marker: any, isAutoSelect = false): void {
    const isMobile = this.isMobile();
    
    if (isMobile) {
      const hasActiveSearch = !!this.filterState.applicantFilter();
      if (!isAutoSelect || !hasActiveSearch) {
        this.closeMobileSearchIfOpen();
      }
    }

    this.centerMapOnMarker(marker);
    
    if (isAutoSelect) {
      setTimeout(() => this.createProjectPopup(project, marker), 300);
    } else {
      this.createProjectPopup(project, marker);
    }
  }

  /**
   * Close mobile search panel if it's open
   * @returns true if search panel was open and closed, false otherwise
   */
  private closeMobileSearchIfOpen(): boolean {
    const filters = this.appfilters();
    if (filters && typeof filters.toggleSearchMobile === 'function' && filters.showSearchMobile()) {
      filters.toggleSearchMobile();
      return true;
    }
    return false;
  }

  /**
   * Center map on a specific marker with appropriate offset for popups
   */
  private centerMapOnMarker(marker: any): void {
    if (!this.map) return;

    const isMobile = this.isMobile();
    // Apply offset for both mobile and desktop to prevent popup cutoff
    // Mobile needs more offset due to the popup card appearing above the marker
    const offset = isMobile ? 150 : this.calculatePopupOffset();
    const markerPoint = this.map.latLngToContainerPoint(marker.getLatLng());
    const targetPoint = L.point(markerPoint.x, markerPoint.y - offset);
    const targetLatLng = this.map.containerPointToLatLng(targetPoint);

    this.map.panTo(targetLatLng, { animate: true, duration: 0.25 });
  }

  /**
   * Create and display a popup for a project marker.
   * Reuses a single popup component instance for better performance.
   */
  private createProjectPopup(project: Project, marker: any): void {
    if (this.isPopupOpening) {
      this.logger.warn('Popup creation already in progress', 'ProjlistMapComponent');
      return;
    }

    if (!this.map || !marker || !this.markerClusterGroup.hasLayer(marker)) {
      this.logger.error('Cannot create popup: map or marker not ready', 'ProjlistMapComponent');
      return;
    }

    // Close any open popups on other markers first
    this.map.closePopup();

    const existingPopup = marker.getPopup();

    // If this marker's popup is already open, close it
    if (existingPopup?.isOpen()) {
      marker.closePopup();
      this.isPopupOpening = false;
      return;
    }

    try {
      this.isPopupOpening = true;

      // Update state - this will trigger marker highlighting via effect
      this.mapStateService.openPopup(project._id);
      this.applist()?.toggleCurrentApp(project);

      // Adjust popup size for narrow viewports
      const viewportWidth = window.innerWidth;
      const isNarrow = viewportWidth < 400;
      const maxWidth = isNarrow ? Math.min(viewportWidth - 40, 280) : 300;
      const minWidth = isNarrow ? Math.min(viewportWidth - 60, 220) : 250;
      
      const popupOptions = {
        className: 'map-popup-content',
        autoPan: false,
        offset: L.point(0, -30),
        closeButton: true,
        maxWidth,
        minWidth
      };

      // Create or reuse popup component
      if (!this.popupComponentRef) {
        this.popupComponentRef = this.viewContainerRef.createComponent(
          ProjDetailPopupComponent,
          { injector: this.injector }
        );
      }

      // Update component with project data
      this.popupComponentRef.instance.proj = project;
      this.popupComponentRef.changeDetectorRef.detectChanges();

      // Create new popup instance with fresh content reference
      const popup = L.popup(popupOptions)
        .setLatLng(marker.getLatLng())
        .setContent(this.popupComponentRef.location.nativeElement)
        .on('remove', () => {
          this.applist()?.toggleCurrentApp(project);
          this.mapStateService.closePopup();
          
          // Prevent auto-reopen for this project
          this.recentlyClosedProjectId = project._id;
          clearTimeout(this.recentlyClosedTimeout);
          this.recentlyClosedTimeout = setTimeout(() => {
            this.recentlyClosedProjectId = null;
          }, 500);
        });

      // Unbind old popup if exists, then bind new one
      if (existingPopup) {
        marker.unbindPopup();
      }

      marker.bindPopup(popup).openPopup();

      // Reset flags and update visibility
      this.isPopupOpening = false;
      this.autoSelectInProgress = false;
      this.updateProjectVisibility();

    } catch (error) {
      this.logger.error('Failed to create popup', 'ProjlistMapComponent', error);
      this.mapStateService.closePopup();
      this.isPopupOpening = false;
      this.autoSelectInProgress = false;
    }
  }

  /**
   * Highlight marker for active popup, reset all others to normal size
   */
  private highlightMarker(activeProjectId: string | null): void {
    const markers = this.mapStateService.getAllMarkers();

    markers.forEach((markerState, id) => {
      if (activeProjectId && id === activeProjectId) {
        markerState.marker.setIcon(markerIconYellowLg);
      } else {
        markerState.marker.setIcon(markerIconYellow);
      }
    });
  }

  /**
   * Reset map to default bounds
   */
  resetMap(): void {
    this.fitBounds();
  }


}
