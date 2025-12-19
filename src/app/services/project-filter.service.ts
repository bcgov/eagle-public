import { Injectable, computed, inject } from '@angular/core';
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

    // Phase filter - match by phase ID
    if (filters.phases.length > 0) {
      const currentPhaseId = project.currentPhaseName?._id;
      if (!currentPhaseId || !filters.phases.includes(currentPhaseId)) {
        return false;
      }
    }

    // Type filter - match by type code
    if (filters.types.length > 0) {
      // Assuming project.type is the type name, need to match against filter codes
      const typeMatch = filters.types.some(typeCode => {
        // For simplicity, check if type matches
        return project.type === typeCode || project.type?.toString().toLowerCase().includes(typeCode.toLowerCase());
      });
      if (!typeMatch) {
        return false;
      }
    }

    // Applicant filter (case-insensitive substring match)
    if (filters.applicant) {
      const applicantName = project.proponent?.name?.toLowerCase() || '';
      if (!applicantName.includes(filters.applicant.toLowerCase())) {
        return false;
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

  /**
   * Create a computed signal that filters projects
   */
  createFilteredProjectsSignal(projectsSignal: () => Project[]) {
    return computed(() => {
      const projects = projectsSignal();
      const filters = this.filterState.allFilters();
      return projects.filter(project => this.projectMatchesFilters(project, filters));
    });
  }

  /**
   * Create a computed signal for map-visible projects
   */
  createVisibleProjectsSignal(projectsSignal: () => Project[]) {
    return computed(() => {
      const projects = projectsSignal();
      const filters = this.filterState.allFilters();
      const bounds = this.mapState.currentBounds();
      
      if (!bounds) {
        return [];
      }

      return projects.filter(project => {
        // Must match filters
        if (!this.projectMatchesFilters(project, filters)) {
          return false;
        }
        
        // Must be in map bounds
        return this.mapState.isProjectInBounds(project);
      });
    });
  }
}
