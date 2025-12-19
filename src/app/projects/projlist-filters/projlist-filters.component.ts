import { Component, OnInit, OnDestroy, ElementRef, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DateTime } from 'luxon';
import { NgSelectModule } from '@ng-select/ng-select';

import { Constants } from '../../shared/utils/constants';
import { ConfigService } from '../../services/config.service';
import { FilterStateService } from '../../services/filter-state.service';

@Component({
  selector: 'app-projlist-filters',
  templateUrl: './projlist-filters.component.html',
  styleUrls: ['./projlist-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgSelectModule],
  standalone: true
})
export class ProjlistFiltersComponent implements OnInit, OnDestroy {
  private configService = inject(ConfigService);
  private filterState = inject(FilterStateService);
  private elementRef = inject(ElementRef);

  public loading = signal(false);

  readonly minDate = DateTime.fromISO('2018-03-23').toJSDate();
  readonly maxDate = DateTime.now().toJSDate();

  // Metadata for dropdowns
  public projectTypes: Array<any> = [];
  public projectRegions: Array<any> = [];
  public projectPhases: Array<any> = [];

  // UI state
  public showFilters = false;
  public showSearchMobile = signal(false);
  
  // Local filter models bound to template
  public regions = signal<any[]>([]);
  public phases = signal<any[]>([]);
  public types = signal<any[]>([]);
  public applicant = signal<string>('');
  public clFile = signal<string>('');
  public dispId = signal<string>('');
  public publishFrom = signal<Date | null>(null);
  public publishTo = signal<Date | null>(null);

  private destroy$ = new Subject<void>();

  // Expose filter state service for template
  get filterCount(): number {
    const filters = this.filterState.allFilters();
    let count = 0;
    count += filters.regions.length;
    count += filters.phases.length;
    count += filters.types.length;
    if (filters.applicant) count++;
    if (filters.clFile) count++;
    if (filters.dispId) count++;
    if (filters.publishFrom) count++;
    if (filters.publishTo) count++;
    return count;
  }

  get clientHeight(): number {
    return this.elementRef.nativeElement.offsetTop + 
      this.elementRef.nativeElement.firstElementChild.firstElementChild.clientHeight;
  }

  public ngOnInit() {
    // Load metadata (regions, phases, types)
    this.configService.lists
      .pipe(
        takeUntil(this.destroy$)
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Sync local UI models from FilterStateService
   */
  private syncFromService(): void {
    const filters = this.filterState.allFilters();
    
    // Map filter IDs back to objects for ng-select
    this.regions.set(
      filters.regions
        .map(id => this.projectRegions.find(r => r._id === id))
        .filter(Boolean)
    );
    
    this.phases.set(
      filters.phases
        .map(id => this.projectPhases.find(p => p._id === id))
        .filter(Boolean)
    );
    
    this.types.set(
      filters.types
        .map(code => this.projectTypes.find(t => t.code === code))
        .filter(Boolean)
    );
    
    this.applicant.set(filters.applicant || '');
    this.clFile.set(filters.clFile || '');
    this.dispId.set(filters.dispId || '');
    this.publishFrom.set(filters.publishFrom);
    this.publishTo.set(filters.publishTo);
    
    // Show filters if any are active
    this.showFilters = this.filterState.hasActiveFilters();
  }

  /**
   * Apply current filter values to FilterStateService
   */
  public applyFilters(): void {
    this.filterState.updateFilters({
      regions: this.regions().map((r: any) => r._id),
      phases: this.phases().map((p: any) => p._id),
      types: this.types().map((t: any) => t.code),
      applicant: this.applicant().trim() || null,
      clFile: this.clFile().trim() || null,
      dispId: this.dispId().trim() || null,
      publishFrom: this.publishFrom(),
      publishTo: this.publishTo(),
      purpose: null // Not currently used
    });
  }

  /**
   * Clear all filters
   */
  public clearAllFilters(): void {
    this.regions.set([]);
    this.phases.set([]);
    this.types.set([]);
    this.applicant.set('');
    this.clFile.set('');
    this.dispId.set('');
    this.publishFrom.set(null);
    this.publishTo.set(null);
    
    this.filterState.clearAll();
  }

  /**
   * Clear specific filter types
   */
  public clearRegionFilters(): void {
    this.regions.set([]);
    this.applyFilters();
  }

  public clearPhaseFilters(): void {
    this.phases.set([]);
    this.applyFilters();
  }

  public clearTypeFilters(): void {
    this.types.set([]);
    this.applyFilters();
  }

  public clearSearch(): void {
    this.applicant.set('');
    this.applyFilters();
  }

  /**
   * UI toggle methods
   */
  public toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  public toggleSearchMobile(): void {
    this.showSearchMobile.set(!this.showSearchMobile());
  }

  public onShowHideClick(): void {
    this.configService.isApplistFiltersVisible = !this.configService.isApplistFiltersVisible;
  }

  /**
   * Loading state
   */
  public onLoadStart(): void {
    this.loading.set(true);
  }

  public onLoadEnd(): void {
    this.loading.set(false);
  }
}
