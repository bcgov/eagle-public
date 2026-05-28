import { Component, ElementRef, signal, ChangeDetectionStrategy, inject, DestroyRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { DateTime } from 'luxon';
import { CustomMultiSelectComponent } from '../../shared/components/custom-multi-select/custom-multi-select.component';

import { Constants } from '../../shared/utils/constants';
import { ConfigService } from '../../services/config.service';
import { FilterStateService } from '../../services/filter-state.service';
import { AnalyticsService } from '../../services/analytics/analytics.service';
import { TypesenseService } from '../../services/typesense.service';

@Component({
  selector: 'app-projlist-filters',
  templateUrl: './projlist-filters.component.html',
  styleUrls: ['./projlist-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CustomMultiSelectComponent],
})
export class ProjlistFiltersComponent {
  private configService = inject(ConfigService);
  private filterState = inject(FilterStateService);
  private elementRef = inject(ElementRef);
  private analytics = inject(AnalyticsService);
  private typesenseService = inject(TypesenseService);
  private destroyRef = inject(DestroyRef);

  readonly minDate = DateTime.fromISO('2018-03-23').toJSDate();
  readonly maxDate = DateTime.now().toJSDate();

  // Metadata for dropdowns
  public projectTypes: any[] = [];
  public projectRegions: any[] = [];
  public projectPhases: any[] = [];

  // UI state
  public showFilters = false;
  public showSearchMobile = signal(false);

  // Autocomplete
  public suggestions = signal<{ id: string; name: string; highlighted: string }[]>([]);
  public showSuggestions = signal(false);
  private search$ = new Subject<string>();

  // Local filter models bound to template
  public regions = signal<any[]>([]);
  public phases = signal<any[]>([]);
  public types = signal<any[]>([]);
  public applicant = signal<string>('');
  public clFile = signal<string>('');
  public dispId = signal<string>('');
  public publishFrom = signal<Date | null>(null);
  public publishTo = signal<Date | null>(null);

  constructor() {
    // Autocomplete: debounce keystrokes and query Typesense for project name suggestions
    this.search$.pipe(
      debounceTime(120),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          return of([]);
        }
        return this.typesenseService.getProjectSuggestions(query).pipe(
          catchError(() => of([]))  // keep stream alive on network errors
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => {
      this.suggestions.set(results);
      this.showSuggestions.set(results.length > 0);
      // Drive marker filtering via Typesense IDs so fuzzy/prefix matching is respected.
      // null = no search active; [] = search active but no results; [...] = matched IDs.
      const activeSearch = this.applicant().trim().length >= 2;
      this.filterState.updateSuggestionIds(activeSearch ? results.map(r => r.id) : null);
    });

    // Load metadata (regions, phases, types)
    this.configService.lists
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(list => {
        list.forEach((item: any) => {
          switch (item.type) {
            case 'region':
              this.projectRegions.push({ ...item });
              break;
            case 'projectPhase':
              this.projectPhases.push({ ...item });
              break;
          }
        });

        this.projectTypes = Constants.PROJECT_TYPE_COLLECTION;

        // Initialize local models from FilterStateService
        this.syncFromService();
      });
  }

  get filterCount(): number {
    const filters = this.filterState.allFilters();
    return filters.regions.length + 
           filters.phases.length + 
           filters.types.length +
           (filters.applicant ? 1 : 0) +
           (filters.clFile ? 1 : 0) +
           (filters.dispId ? 1 : 0) +
           (filters.publishFrom ? 1 : 0) +
           (filters.publishTo ? 1 : 0);
  }

  get clientHeight(): number {
    return this.elementRef.nativeElement.offsetTop + 
      this.elementRef.nativeElement.firstElementChild.firstElementChild.clientHeight;
  }

  ngOnDestroy() {
    this.search$.complete();
  }

  /**
   * Sync local UI models from FilterStateService
   */
  private syncFromService(): void {
    const filters = this.filterState.allFilters();
    
    // Helper to map IDs to objects, filtering out any not found
    const mapToObjects = <T extends { _id?: string; code?: string }>(ids: string[], collection: T[], key: '_id' | 'code'): T[] => {
      return ids.map(id => collection.find(item => item[key] === id)).filter((item): item is T => !!item);
    };
    
    this.regions.set(mapToObjects(filters.regions, this.projectRegions, '_id'));
    this.phases.set(mapToObjects(filters.phases, this.projectPhases, '_id'));
    this.types.set(mapToObjects(filters.types, this.projectTypes, 'code'));
    
    this.applicant.set(filters.applicant || '');
    this.clFile.set(filters.clFile || '');
    this.dispId.set(filters.dispId || '');
    this.publishFrom.set(filters.publishFrom);
    this.publishTo.set(filters.publishTo);
    
    this.showFilters = this.filterState.hasActiveFilters();
  }

  /**
   * Apply current filter values to FilterStateService
   */
  public applyFilters(): void {
    const applicantValue = this.applicant().trim();
    const clFileValue = this.clFile().trim();
    const dispIdValue = this.dispId().trim();
    
    this.filterState.updateFilters({
      regions: this.regions().map((r: any) => r._id),
      phases: this.phases().map((p: any) => p._id),
      types: this.types().map((t: any) => t.code),
      applicant: applicantValue || null,
      clFile: clFileValue || null,
      dispId: dispIdValue || null,
      publishFrom: this.publishFrom(),
      publishTo: this.publishTo(),
      purpose: null
    });
    
    // Track filters applied
    this.analytics.track('Project Filters Applied', {
      regions_count: this.regions().length,
      phases_count: this.phases().length,
      types_count: this.types().length,
      has_applicant: !!applicantValue,
      has_cl_file: !!clFileValue,
      has_disp_id: !!dispIdValue,
      has_date_range: !!(this.publishFrom() || this.publishTo()),
      total_filters: this.filterCount
    });
  }

  /**
   * Clear all filters
   */
  public clearAllFilters(): void {
    const previousFilterCount = this.filterCount;
    
    this.filterState.clearAll();
    this.syncFromService();
    
    // Track filters cleared
    this.analytics.track('Project Filters Cleared', {
      previous_filter_count: previousFilterCount
    });
  }

  public clearSearch(): void {
    this.applicant.set('');
    this.filterState.updateSuggestionIds(null);
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.applyFilters();
  }

  public onSearchInput(value: string): void {
    this.search$.next(value);
    if (value.length >= 2) {
      this.showSuggestions.set(true);
    } else {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  public selectSuggestion(s: { id: string; name: string; highlighted: string }): void {
    this.applicant.set(s.name);
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.filterState.updateSuggestionIds([s.id]);
    this.applyFilters();
  }

  public hideSuggestions(): void {
    // Delay so mousedown on a suggestion item fires before the dropdown disappears
    setTimeout(() => this.showSuggestions.set(false), 150);
  }

  public toggleFilters(): void {
    this.showFilters = !this.showFilters;
    
    // Track filter panel toggle
    this.analytics.track('Project Filters Panel Toggled', {
      is_open: this.showFilters,
      current_filter_count: this.filterCount
    });
  }

  public toggleSearchMobile(): void {
    this.showSearchMobile.set(!this.showSearchMobile());
  }


}
