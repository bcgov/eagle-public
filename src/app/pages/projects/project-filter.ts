import type { Project } from 'app/models/project';
import type { Engagement } from 'app/api/commentperiod';
import { Constants } from 'app/utils/constants';
import type { FilterCriteria, ProjectSort } from './filter-state';

interface TypeOption {
  code: string;
  name: string;
}

const PROJECT_TYPES = Constants.PROJECT_TYPE_COLLECTION as TypeOption[];

/**
 * The type dropdown stores camelCase codes ("energyElectricity") while a project's `type` holds the
 * display name ("Energy-Electricity"), so comparing the two directly never matched. Resolve the
 * code to its name before comparing; the URL keeps the code.
 */
function typeNameForCode(code: string): string {
  return PROJECT_TYPES.find((option) => option.code === code)?.name ?? code;
}

/** `applicant` is not checked here: demi-search matches the search box text and ranks the results. */
export function projectMatchesFilters(
  project: Project,
  filters: FilterCriteria,
  regions: { _id?: string; name?: string }[],
  engagementStates?: ReadonlyMap<string, ReadonlySet<Engagement>>,
): boolean {
  if (filters.regions.length > 0) {
    const regionMatch = filters.regions.some((regionId) => {
      const region = regions.find((item) => item._id === regionId);
      return !!region && (region.name === project.region || region._id === project.region);
    });
    if (!regionMatch) return false;
  }

  if (filters.phases.length > 0) {
    const currentPhaseId = project.currentPhaseName?._id;
    if (!currentPhaseId || !filters.phases.includes(currentPhaseId)) return false;
  }

  if (filters.types.length > 0) {
    const projectType = project.type?.toString().toLowerCase() || '';
    const typeMatch = filters.types.some((code) => {
      const name = typeNameForCode(code).toLowerCase();
      return projectType === name || projectType.includes(name);
    });
    if (!typeMatch) return false;
  }

  if (filters.commentPeriod && !engagementStates?.get(project._id)?.has(filters.commentPeriod)) {
    return false;
  }

  if (filters.clFile) {
    const clFile = project.code?.toString() || '';
    if (!clFile.includes(filters.clFile)) return false;
  }

  if (filters.dispId) {
    const dispId = project.epicProjectID?.toString() || '';
    if (!dispId.includes(filters.dispId)) return false;
  }

  if (filters.purpose) {
    const description = project.description?.toLowerCase() || '';
    if (!description.includes(filters.purpose.toLowerCase())) return false;
  }

  if (filters.publishFrom || filters.publishTo) {
    // A project with no date cannot satisfy a date range, so it drops out.
    const projectDate = project.dateAdded ? new Date(project.dateAdded) : null;
    if (!projectDate) return false;
    if (filters.publishFrom && projectDate < filters.publishFrom) return false;
    if (filters.publishTo && projectDate > filters.publishTo) return false;
  }

  return true;
}

export function filterProjects(
  projects: Project[],
  filters: FilterCriteria,
  regions: { _id?: string; name?: string }[],
  engagementStates?: ReadonlyMap<string, ReadonlySet<Engagement>>,
): Project[] {
  return projects.filter((project) =>
    projectMatchesFilters(project, filters, regions, engagementStates),
  );
}

/** A project with no date sorts after every dated one. */
function updatedTime(project: Project): number {
  const time = project.dateUpdated ? new Date(project.dateUpdated).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Relevance keeps the order the projects came in: demi-search's ranking for a keyword search, and
 * its name order for the full list.
 */
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  if (sort === 'relevance') return projects;
  const compare: Record<Exclude<ProjectSort, 'relevance'>, (a: Project, b: Project) => number> = {
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    updated: (a, b) => updatedTime(b) - updatedTime(a),
  };
  return [...projects].sort(compare[sort]);
}
