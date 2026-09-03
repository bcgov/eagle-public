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

/** How far the mobile list sheet is pulled up over the map. */
export type SheetState = 'peek' | 'half' | 'full';
export const sheetState = createStore<SheetState>('peek');

/** A drag shorter than this reads as a tap, so the sheet keeps the state it started in. */
export const SHEET_DRAG_THRESHOLD = 40;

/** How far each stop translates the sheet down, in px, for a sheet `height` tall showing `peek`. */
function sheetOffsets(height: number, peek: number): Record<SheetState, number> {
  return { peek: height - peek, half: height / 2, full: 0 };
}

/**
 * The stop a drag of `dy` px from `from` lands on: the nearest one the drag headed towards, so a
 * deliberate drag always moves the sheet rather than rubber-banding back to where it started.
 */
export function snapSheet(from: SheetState, dy: number, height: number, peek: number): SheetState {
  if (Math.abs(dy) < SHEET_DRAG_THRESHOLD) return from;
  const offsets = sheetOffsets(height, peek);
  const target = offsets[from] + dy;
  const ahead = (Object.keys(offsets) as SheetState[]).filter((state) =>
    dy < 0 ? offsets[state] < offsets[from] : offsets[state] > offsets[from],
  );
  if (ahead.length === 0) return from;
  return ahead.reduce((best, state) =>
    Math.abs(offsets[state] - target) < Math.abs(offsets[best] - target) ? state : best,
  );
}

/** Name of the selected Esri base layer, remembered across visits to the map. */
export const DEFAULT_BASEMAP = 'World Topographic';
export const baseLayerName = createStore(DEFAULT_BASEMAP);

/** Whether the EAO region polygons draw on the projects map. */
export const regionsVisible = createStore(true);

/** Bounds of the current map view; null before the map exists. */
export const mapBounds = createStore<MapBounds | null>(null);

export function isProjectInBounds(project: Project, bounds: MapBounds | null): boolean {
  if (!bounds || !project.centroid || project.centroid.length < 2) {
    return false;
  }
  const [lng, lat] = project.centroid;
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}
