import type { Project } from 'app/models/project';
import { Constants } from 'app/utils/constants';
import type { FilterCriteria } from './filter-state';

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
  return PROJECT_TYPES.find(option => option.code === code)?.name ?? code;
}

export function projectMatchesFilters(
  project: Project,
  filters: FilterCriteria,
  regions: { _id?: string; name?: string }[]
): boolean {
  if (filters.regions.length > 0) {
    const regionMatch = filters.regions.some(regionId => {
      const region = regions.find(item => item._id === regionId);
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
    const typeMatch = filters.types.some(code => {
      const name = typeNameForCode(code).toLowerCase();
      return projectType === name || projectType.includes(name);
    });
    if (!typeMatch) return false;
  }

  if (filters.applicant) {
    const projectName = project.name?.toLowerCase() || '';
    if (!projectName.includes(filters.applicant.toLowerCase())) return false;
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
  regions: { _id?: string; name?: string }[]
): Project[] {
  return projects.filter(project => projectMatchesFilters(project, filters, regions));
}
