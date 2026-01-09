import { Component, OnInit, OnDestroy, ElementRef, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DateTime } from 'luxon';
import { CustomMultiSelectComponent } from '../../shared/components/custom-multi-select/custom-multi-select.component';

import { Constants } from '../../shared/utils/constants';
import { ConfigService } from '../../services/config.service';
import { FilterStateService } from '../../services/filter-state.service';

@Component({
  selector: 'app-projlist-filters',
  templateUrl: './projlist-filters.component.html',
  styleUrls: ['./projlist-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CustomMultiSelectComponent],
  standalone: true
})
export class ProjlistFiltersComponent implements OnInit, OnDestroy {
  private configService = inject(ConfigService);
  private filterState = inject(FilterStateService);
  private elementRef = inject(ElementRef);

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
  }

  /**
   * Clear all filters
   */
  public clearAllFilters(): void {
    this.filterState.clearAll();
    this.syncFromService();
  }

  public clearSearch(): void {
    this.applicant.set('');
    this.applyFilters();
  }

  public toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  public toggleSearchMobile(): void {
    this.showSearchMobile.set(!this.showSearchMobile());
  }


}
