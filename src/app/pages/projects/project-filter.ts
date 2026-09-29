import type { Project } from 'app/models/project';
import { gridCollator } from 'app/components/display-grid/grid-helpers';
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
  return PROJECT_TYPES.find((option) => option.code === code)?.name ?? code;
}

export function projectMatchesFilters(
  project: Project,
  filters: FilterCriteria,
  regions: { _id?: string; name?: string }[],
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

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** 0: name starts with the query, 1: a word in the name does, 2: any other match. */
function nameMatchTier(name: string, query: string): number {
  if (name.startsWith(query)) return 0;
  for (let at = name.indexOf(query); at > 0; at = name.indexOf(query, at + 1)) {
    if (!WORD_CHAR.test(name[at - 1])) return 1;
  }
  return 2;
}

/**
 * Orders projects by how well their name matches a typed query, then by name. An empty query
 * keeps the input order (the server's).
 */
export function rankByName(projects: Project[], query: string | null): Project[] {
  const q = query?.trim().toLowerCase();
  if (!q) return projects;
  return projects
    .map((project) => {
      const name = project.name ?? '';
      return { project, name, tier: nameMatchTier(name.toLowerCase(), q) };
    })
    .sort((a, b) => a.tier - b.tier || gridCollator.compare(a.name, b.name))
    .map(({ project }) => project);
}

export function filterProjects(
  projects: Project[],
  filters: FilterCriteria,
  regions: { _id?: string; name?: string }[],
): Project[] {
  const matches = projects.filter((project) => projectMatchesFilters(project, filters, regions));
  return rankByName(matches, filters.applicant);
}
