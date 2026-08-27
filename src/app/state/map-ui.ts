import type { Project } from 'app/models/project';
import { createStore } from './store';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** How many list cards the projects page reveals per "Load More". */
export const LIST_PAGE_SIZE = 10;

/** Whether the project list panel is open over the map. Outlives the page, as ConfigService did. */
export const applistVisible = createStore(false);

/** Name of the selected Esri base layer, remembered across visits to the map. */
export const baseLayerName = createStore('World Topographic');

/** Bounds of the current map view; null before the map exists. */
export const mapBounds = createStore<MapBounds | null>(null);

export function isProjectInBounds(project: Project, bounds: MapBounds | null): boolean {
  if (!bounds || !project.centroid || project.centroid.length < 2) {
    return false;
  }
  const [lng, lat] = project.centroid;
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}
