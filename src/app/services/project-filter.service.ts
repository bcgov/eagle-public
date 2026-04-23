import { Injectable, inject } from '@angular/core';
import { Project } from '../models/project';
import { FilterStateService, FilterCriteria } from './filter-state.service';
import { MapStateService } from './map-state.service';
import { ConfigService } from './config.service';

/**
 * Service to apply filters to projects and determine visibility.
 * Uses signals for reactive filtering without object mutations.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectFilterService {
  private filterState = inject(FilterStateService);
  private mapState = inject(MapStateService);
  private configService = inject(ConfigService);

  // Cache metadata for filter matching
  private regionMetadata: any[] = [];
  private phaseMetadata: any[] = [];
  private typeMetadata: any[] = [];

  constructor() {
    // Load metadata when available
    this.configService.lists.subscribe(list => {
      list.forEach((item: any) => {
        switch (item.type) {
          case 'region':
            this.regionMetadata.push(item);
            break;
          case 'projectPhase':
            this.phaseMetadata.push(item);
            break;
        }
      });
    });
  }

  /**
   * Check if a project matches the current filter criteria
   */
  projectMatchesFilters(project: Project, filters: FilterCriteria): boolean {
    // Region filter - match by comparing region IDs or names
    if (filters.regions.length > 0) {
      const regionMatch = filters.regions.some(regionId => {
        const region = this.regionMetadata.find(r => r._id === regionId);
        return region && (region.name === project.region || region._id === project.region);
      });
      if (!regionMatch) {
        return false;
      }
    }

    // Phase filter - match by phase ID (MongoDB) or phase name resolved via metadata (Typesense)
    if (filters.phases.length > 0) {
      const currentPhaseMongoId = project.currentPhaseName?._id;
      const currentPhaseName = project.currentPhaseName?.name;
      const phaseMatch = filters.phases.some(filterId => {
        if (currentPhaseMongoId === filterId) return true;
        // Typesense: currentPhaseName has no _id — match by name via metadata
        const meta = this.phaseMetadata.find(p => p._id === filterId);
        return !!meta && meta.name === currentPhaseName;
      });
      if (!phaseMatch) {
        return false;
      }
    }

    // Type filter - match by type code
    if (filters.types.length > 0) {
      const projectType = project.type?.toString().toLowerCase() || '';
      const typeMatch = filters.types.some(typeCode => 
        projectType === typeCode.toLowerCase() || projectType.includes(typeCode.toLowerCase())
      );
      if (!typeMatch) {
        return false;
      }
    }

    // Applicant / name filter.
    // When Typesense suggestion IDs are available, use them (fuzzy-accurate).
    // Fallback: substring match for non-Typesense environments or URL-loaded filters.
    if (filters.applicant) {
      const suggestionIds = this.filterState.typesenseSuggestionIdsFilter();
      if (suggestionIds !== null) {
        // Typesense did the fuzzy match — trust its results
        if (!suggestionIds.includes(project._id)) return false;
      } else {
        const projectName = project.name?.toLowerCase() || '';
        const query = filters.applicant.toLowerCase();
        const nameNoSpaces = projectName.replace(/\s+/g, '');
        const queryNoSpaces = query.replace(/\s+/g, '');
        if (!projectName.includes(query) && !nameNoSpaces.includes(queryNoSpaces)) {
          return false;
        }
      }
    }

    // CL File filter
    if (filters.clFile) {
      const clFile = project.code?.toString() || '';
      if (!clFile.includes(filters.clFile)) {
        return false;
      }
    }

    // Display ID filter
    if (filters.dispId) {
      const dispId = project.epicProjectID?.toString() || '';
      if (!dispId.includes(filters.dispId)) {
        return false;
      }
    }

    // Purpose filter (case-insensitive substring match)
    if (filters.purpose) {
      const description = project.description?.toLowerCase() || '';
      if (!description.includes(filters.purpose.toLowerCase())) {
        return false;
      }
    }

    // Date range filters
    if (filters.publishFrom || filters.publishTo) {
      const projectDate = project.dateAdded ? new Date(project.dateAdded as string) : null;
      
      if (projectDate) {
        if (filters.publishFrom && projectDate < filters.publishFrom) {
          return false;
        }
        if (filters.publishTo && projectDate > filters.publishTo) {
          return false;
        }
      } else {
        // If project has no date and date filters are active, exclude it
        return false;
      }
    }

    return true;
  }

  /**
   * Filter projects based on current filter criteria
   * Returns a new array without mutating the original
   */
  filterProjects(projects: Project[]): Project[] {
    const filters = this.filterState.allFilters();
    return projects.filter(project => this.projectMatchesFilters(project, filters));
  }

  /**
   * Get projects that match filters AND are visible on map
   */
  getVisibleProjects(projects: Project[]): Project[] {
    const filtered = this.filterProjects(projects);
    return filtered.filter(project => this.mapState.isProjectInBounds(project));
  }
}
