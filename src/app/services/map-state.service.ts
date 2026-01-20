import { Injectable, signal, computed } from '@angular/core';

import { Project } from '../models/project';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MarkerState {
  projectId: string;
  marker: any;
  isVisible: boolean;
}

/**
 * Central state management for map-related data.
 * Uses Angular signals for reactive state management.
 */
@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  // Map instance reference
  private mapInstance = signal<any>(null);
  
  // Marker tracking
  private markers = signal<Map<string, MarkerState>>(new Map());
  
  // Current map bounds
  private bounds = signal<MapBounds | null>(null);
  
  // Active popup project (null = no popup open)
  private activePopupProjectId = signal<string | null>(null);
  
  // Base layer preference
  private baseLayer = signal<string>('World Topographic Map');
  
  // Public computed signals
  public readonly map = this.mapInstance.asReadonly();
  public readonly currentBounds = this.bounds.asReadonly();
  public readonly activePopupProject = this.activePopupProjectId.asReadonly();
  public readonly currentBaseLayer = this.baseLayer.asReadonly();
  public readonly isPopupOpen = computed(() => this.activePopupProjectId() !== null);
  
  // Get visible marker count
  public readonly visibleMarkerCount = computed(() => {
    let count = 0;
    this.markers().forEach(state => {
      if (state.isVisible) count++;
    });
    return count;
  });
  
  // Get single visible project (for auto-open)
  public readonly singleVisibleProject = computed<{projectId: string; marker: any} | null>(() => {
    if (this.visibleMarkerCount() !== 1) return null;
    
    let result: {projectId: string; marker: any} | null = null;
    this.markers().forEach(state => {
      if (state.isVisible) {
        result = { projectId: state.projectId, marker: state.marker };
      }
    });
    return result;
  });
  
  // Should auto-open popup (true when exactly 1 visible marker and no popup open)
  public readonly shouldAutoOpenPopup = computed(() => {
    return this.singleVisibleProject() !== null && this.activePopupProjectId() === null;
  });

  /**
   * Initialize map instance
   */
  setMap(map: any): void {
    this.mapInstance.set(map);
  }

  /**
   * Update map bounds
   */
  updateBounds(bounds: any): void {
    this.bounds.set({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    });
  }

  /**
   * Check if a project is within current map bounds
   */
  isProjectInBounds(project: Project): boolean {
    const currentBounds = this.bounds();
    if (!currentBounds || !project.centroid || project.centroid.length < 2) {
      return false;
    }

    const [lng, lat] = project.centroid;
    return (
      lat >= currentBounds.south &&
      lat <= currentBounds.north &&
      lng >= currentBounds.west &&
      lng <= currentBounds.east
    );
  }

  /**
   * Get or create marker for a project
   */
  getMarker(projectId: string): any {
    return this.markers().get(projectId)?.marker;
  }

  /**
   * Add or update a marker
   */
  setMarker(projectId: string, marker: any, isVisible = true): void {
    const currentMarkers = new Map(this.markers());
    currentMarkers.set(projectId, { projectId, marker, isVisible });
    this.markers.set(currentMarkers);
  }

  /**
   * Remove a marker
   */
  removeMarker(projectId: string): void {
    const currentMarkers = new Map(this.markers());
    const state = currentMarkers.get(projectId);
    if (state) {
      state.marker.remove();
      currentMarkers.delete(projectId);
      this.markers.set(currentMarkers);
    }
  }

  /**
   * Update marker visibility
   */
  setMarkerVisibility(projectId: string, isVisible: boolean): void {
    const currentMarkers = new Map(this.markers());
    const state = currentMarkers.get(projectId);
    if (state) {
      state.isVisible = isVisible;
      currentMarkers.set(projectId, state);
      this.markers.set(currentMarkers);
    }
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.markers().forEach(state => state.marker.remove());
    this.markers.set(new Map());
  }

  /**
   * Get all marker states
   */
  getAllMarkers(): Map<string, MarkerState> {
    return this.markers();
  }

  /**
   * Open popup for a project
   */
  openPopup(projectId: string): void {
    this.activePopupProjectId.set(projectId);
  }
  
  /**
   * Close any open popup
   */
  closePopup(): void {
    this.activePopupProjectId.set(null);
  }

  /**
   * Set base layer preference
   */
  setBaseLayer(layerName: string): void {
    this.baseLayer.set(layerName);
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.clearMarkers();
    this.activePopupProjectId.set(null);
    this.bounds.set(null);
  }
}
