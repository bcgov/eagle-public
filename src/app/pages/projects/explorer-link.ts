import type { Project } from 'app/models/project';
import { EMPTY_FILTERS, filtersToParams } from './filter-state';

/** The explorer selects this project on arrival. A one-time hint, not a filter. */
export const SELECTED_PARAM = 'selected';

/**
 * The map explorer opened on one project: its name in the search box and the project selected.
 * With no record yet, or one without an id, the plain explorer.
 */
export function explorerLink(project: Pick<Project, '_id' | 'name'> | null | undefined): string {
  if (!project?._id) return '/projects';
  const params = filtersToParams({ ...EMPTY_FILTERS, applicant: project.name || null });
  params.set(SELECTED_PARAM, project._id);
  return `/projects?${params}`;
}
