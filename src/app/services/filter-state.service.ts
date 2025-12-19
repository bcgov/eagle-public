import { Injectable, signal, computed, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface FilterCriteria {
  regions: string[];
  phases: string[];
  types: string[];
  applicant: string | null;
  clFile: string | null;
  dispId: string | null;
  purpose: string | null;
  publishFrom: Date | null;
  publishTo: Date | null;
}

/**
 * Central state management for project filters.
 * Handles filter state and URL synchronization.
 */
@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  // Filter state
  private regions = signal<string[]>([]);
  private phases = signal<string[]>([]);
  private types = signal<string[]>([]);
  private applicant = signal<string | null>(null);
  private clFile = signal<string | null>(null);
  private dispId = signal<string | null>(null);
  private purpose = signal<string | null>(null);
  private publishFrom = signal<Date | null>(null);
  private publishTo = signal<Date | null>(null);

  // Public readonly signals
  public readonly selectedRegions = this.regions.asReadonly();
  public readonly selectedPhases = this.phases.asReadonly();
  public readonly selectedTypes = this.types.asReadonly();
  public readonly applicantFilter = this.applicant.asReadonly();
  public readonly clFileFilter = this.clFile.asReadonly();
  public readonly dispIdFilter = this.dispId.asReadonly();
  public readonly purposeFilter = this.purpose.asReadonly();
  public readonly publishFromFilter = this.publishFrom.asReadonly();
  public readonly publishToFilter = this.publishTo.asReadonly();

  // Computed: Check if any filters are active
  public readonly hasActiveFilters = computed(() => {
    return (
      this.regions().length > 0 ||
      this.phases().length > 0 ||
      this.types().length > 0 ||
      this.applicant() !== null ||
      this.clFile() !== null ||
      this.dispId() !== null ||
      this.purpose() !== null ||
      this.publishFrom() !== null ||
      this.publishTo() !== null
    );
  });

  // Computed: Get all filters as a single object
  public readonly allFilters = computed<FilterCriteria>(() => ({
    regions: this.regions(),
    phases: this.phases(),
    types: this.types(),
    applicant: this.applicant(),
    clFile: this.clFile(),
    dispId: this.dispId(),
    purpose: this.purpose(),
    publishFrom: this.publishFrom(),
    publishTo: this.publishTo()
  }));

  constructor() {
    // Initialize from URL parameters on service creation
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe(params => {
        this.loadFromUrlParams(params);
      });
  }

  /**
   * Load filter state from URL parameters
   */
  private loadFromUrlParams(params: any): void {
    // Parse array filters
    const regionsParam = params.get('regions');
    if (regionsParam) {
      this.regions.set(regionsParam.split(',').filter((r: string) => r));
    }

    const phasesParam = params.get('phases');
    if (phasesParam) {
      this.phases.set(phasesParam.split(',').filter((p: string) => p));
    }

    const typesParam = params.get('types');
    if (typesParam) {
      this.types.set(typesParam.split(',').filter((t: string) => t));
    }

    // Parse string filters
    this.applicant.set(params.get('applicant') || null);
    this.clFile.set(params.get('clFile') || null);
    this.dispId.set(params.get('dispId') || null);
    this.purpose.set(params.get('purpose') || null);

    // Parse date filters
    const fromParam = params.get('publishFrom');
    if (fromParam) {
      this.publishFrom.set(new Date(fromParam));
    }

    const toParam = params.get('publishTo');
    if (toParam) {
      this.publishTo.set(new Date(toParam));
    }
  }

  /**
   * Update URL to reflect current filter state
   */
  private syncToUrl(): void {
    const params: any = {};

    if (this.regions().length > 0) {
      params.regions = this.regions().join(',');
    }
    if (this.phases().length > 0) {
      params.phases = this.phases().join(',');
    }
    if (this.types().length > 0) {
      params.types = this.types().join(',');
    }
    if (this.applicant()) {
      params.applicant = this.applicant();
    }
    if (this.clFile()) {
      params.clFile = this.clFile();
    }
    if (this.dispId()) {
      params.dispId = this.dispId();
    }
    if (this.purpose()) {
      params.purpose = this.purpose();
    }
    if (this.publishFrom()) {
      params.publishFrom = this.publishFrom()!.toISOString().split('T')[0];
    }
    if (this.publishTo()) {
      params.publishTo = this.publishTo()!.toISOString().split('T')[0];
    }

    // Update URL without navigation
    const urlTree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: params
    });
    this.location.replaceState(urlTree.toString());
  }

  // Setters for each filter type
  setRegions(regions: string[]): void {
    this.regions.set(regions);
    this.syncToUrl();
  }

  setPhases(phases: string[]): void {
    this.phases.set(phases);
    this.syncToUrl();
  }

  setTypes(types: string[]): void {
    this.types.set(types);
    this.syncToUrl();
  }

  setApplicant(applicant: string | null): void {
    this.applicant.set(applicant);
    this.syncToUrl();
  }

  setClFile(clFile: string | null): void {
    this.clFile.set(clFile);
    this.syncToUrl();
  }

  setDispId(dispId: string | null): void {
    this.dispId.set(dispId);
    this.syncToUrl();
  }

  setPurpose(purpose: string | null): void {
    this.purpose.set(purpose);
    this.syncToUrl();
  }

  setPublishFrom(date: Date | null): void {
    this.publishFrom.set(date);
    this.syncToUrl();
  }

  setPublishTo(date: Date | null): void {
    this.publishTo.set(date);
    this.syncToUrl();
  }

  /**
   * Clear all filters
   */
  clearAll(): void {
    this.regions.set([]);
    this.phases.set([]);
    this.types.set([]);
    this.applicant.set(null);
    this.clFile.set(null);
    this.dispId.set(null);
    this.purpose.set(null);
    this.publishFrom.set(null);
    this.publishTo.set(null);
    this.syncToUrl();
  }

  /**
   * Batch update multiple filters at once
   */
  updateFilters(filters: Partial<FilterCriteria>): void {
    if (filters.regions !== undefined) this.regions.set(filters.regions);
    if (filters.phases !== undefined) this.phases.set(filters.phases);
    if (filters.types !== undefined) this.types.set(filters.types);
    if (filters.applicant !== undefined) this.applicant.set(filters.applicant);
    if (filters.clFile !== undefined) this.clFile.set(filters.clFile);
    if (filters.dispId !== undefined) this.dispId.set(filters.dispId);
    if (filters.purpose !== undefined) this.purpose.set(filters.purpose);
    if (filters.publishFrom !== undefined) this.publishFrom.set(filters.publishFrom);
    if (filters.publishTo !== undefined) this.publishTo.set(filters.publishTo);
    
    this.syncToUrl();
  }
}
