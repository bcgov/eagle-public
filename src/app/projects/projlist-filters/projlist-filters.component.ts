import { Component, OnInit, OnDestroy, ElementRef, input, output, effect, untracked, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, ParamMap, Params } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { DateTime } from 'luxon';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';

import { Constants } from '../../shared/utils/constants';
import { Project } from '../../models/project';
import { CommentPeriodService } from '../../services/commentperiod.service';
import { ConfigService } from '../../services/config.service';
import { inject } from '@angular/core';

export interface FiltersType {
  regionFilters: object;
  cpStatusFilters: object;
  appStatusFilters: object;
  applicantFilter: string;
  clFileFilter: string | null;
  dispIdFilter: string | null;
  purposeFilter: string;
  publishFromFilter: Date | undefined;
  publishToFilter: Date | undefined;
}

@Component({
  selector: 'app-projlist-filters',
  templateUrl: './projlist-filters.component.html',
  styleUrls: ['./projlist-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgSelectModule, NgbTypeaheadModule],
  standalone: true
})
export class ProjlistFiltersComponent implements OnInit, OnDestroy {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public commentPeriodService = inject(CommentPeriodService);
  private configService = inject(ConfigService);
  private elementRef = inject(ElementRef);

  // Inputs and Outputs using signals
  projects = input<Array<Project>>([]); // from projects component
  updateMatching = output(); // to projects component

  public loading = signal(false);

  readonly minDate = DateTime.fromISO('2018-03-23').toJSDate(); // first app created
  readonly maxDate = DateTime.now().toJSDate(); // today

  public projectTypes: Array<any> = [];
  public projectRegions: Array<any> = [];
  public projectPhases: Array<any> = [];

  public isFiltersCollapsed!: boolean;
  public isCpStatusCollapsed = true;
  public isAppStatusCollapsed = true;
  public showFilters = false;
  private paramMap: ParamMap | null = null;
  private destroy$ = new Subject<void>();
  private searchChange$ = new Subject<string>();

  // search keys for drop-down menus
  public regionKeys: Array<string> = [];
  public cpStatusKeys: Array<string> = [];
  public appStatusKeys: Array<string> = [];

  // search keys for text boxes
  private applicantKeys: Array<string> = [];
  private purposeKeys: Array<string> = [];

  public cpStatusFilters: any = {};

  public appStatusFilters: any = {};

  public applicantFilter: string | null = null;

  public regionFilter: any = [];

  public typeFilter: Array<any> = [];

  public phaseFilter: Array<any> = [];

  public clFileFilter: number | null = null;

  public dispIdFilter: number | null = null;

  public purposeFilter: string | null = null;

  public publishFromFilter: Date | null = null;
  public publishToFilter: Date | null = null;

  //
  // (arrow) functions to return type-ahead results
  // ref: https://ng-bootstrap.github.io/#/components/typeahead/api
  //
  public applicantSearch = (text$: Observable<string>) =>
    text$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        map(term => term.length < 1 ? []
          : this.applicantKeys.filter(key => this.applicantFilter && key.indexOf(this.applicantFilter.toUpperCase()) > -1)
        )
      );

  public purposeSearch = (text$: Observable<string>) =>
    text$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        map(term => term.length < 1 ? []
          : this.purposeKeys.filter(key => this.purposeFilter && key.indexOf(this.purposeFilter.toUpperCase()) > -1)
        )
      );

  // full height = top of app-applist-filters.app-filters + height of div.app-filters__header
  get clientHeight(): number {
    return this.elementRef.nativeElement.offsetTop + this.elementRef.nativeElement.firstElementChild.firstElementChild.clientHeight;
  }

  public ngOnInit() {
    // Set up instant search with debounce
    this.searchChange$
      .pipe(
        debounceTime(150),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.internalApplyAllFilters(true);
      });

    this.configService.lists
    .pipe(
      switchMap(list => {
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

        return this.route.queryParamMap;
      }),
      takeUntil(this.destroy$)
    )
    .subscribe(paramMap => {
        this.paramMap = paramMap;
        
        // Check if there are any filters in the URL
        const hasFilters = paramMap.keys.length > 0;
        this.showFilters = hasFilters;
        
        this.internalResetAllFilters(false);
      });

    // Build purpose keys
    Object.keys(Constants.subpurposes).forEach(purpose => {
      (Constants.subpurposes as any)[purpose].forEach((subpurpose: any) => {
        this.purposeKeys.push(`${purpose.toUpperCase()} / ${subpurpose.toUpperCase()}`);
      });
    });
  }

  public onSearchChange(searchText: string) {
    this.searchChange$.next(searchText);
  }

  public clearSearch() {
    this.applicantFilter = null;
    this.onSearchChange('');
  }

  constructor() {
    // Watch for project changes using effect
    let isFirstRun = true;
    let previousProjectIds: string[] = [];
    
    effect(() => {
      const currentProjects = this.projects();
      if (isFirstRun || currentProjects.length === 0) {
        isFirstRun = false;
        previousProjectIds = currentProjects.map(p => p._id);
        return;
      }

      // Check if the actual projects changed (not just array reference)
      const currentProjectIds = currentProjects.map(p => p._id);
      const hasActualChanges = 
        currentProjectIds.length !== previousProjectIds.length ||
        currentProjectIds.some((id, index) => id !== previousProjectIds[index]);
      
      if (!hasActualChanges) {
        return; // Skip if only array reference changed
      }

      untracked(() => {
        const names = currentProjects
          .map(app => app.name?.toUpperCase())
          .filter((name): name is string => name != null)
          .sort();
        
        this.applicantKeys = Array.from(new Set(names));
        this.internalApplyAllFilters(false);
        previousProjectIds = currentProjectIds;
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // FOR FUTURE USE
  public getFilters(): FiltersType {
    return {
      regionFilters: this.regionFilter,
      cpStatusFilters: this.cpStatusFilters,
      appStatusFilters: this.appStatusFilters,
      applicantFilter: this.applicantFilter ? this.applicantFilter.trim() : '',
      clFileFilter: this.clFileFilter ? this.clFileFilter.toString() : null,
      dispIdFilter: this.dispIdFilter ? this.dispIdFilter.toString() : null,
      purposeFilter: this.purposeFilter ? this.purposeFilter.trim() : '',
      publishFromFilter: this.publishFromFilter || undefined,
      publishToFilter: this.publishToFilter || undefined
    };
  }

  //
  // The following apply filters immediately
  //
  public applyRegionFilters() {
    this.internalApplyAllFilters(true);
  }

  public applyCpStatusFilters() {
    this.internalApplyAllFilters(true);
    this.isCpStatusCollapsed = true;
  }

  public applyAppStatusFilters() {
    this.internalApplyAllFilters(true);
    this.isAppStatusCollapsed = true;
  }

  public applyClFileFilter() {
    this.internalApplyAllFilters(true);
  }

  public applyAllFilters() {
    this.internalApplyAllFilters(true);
  }

  private internalApplyAllFilters(doSave: boolean) {
    const currentProjects = this.projects();
    currentProjects.forEach(app => app.isMatches = this.showThisApp(app));

    // notify map component
    this.updateMatching.emit();

    // if called from UI, save new filters
    // otherwise this is part of init or change event
    if (doSave) {
      this.saveFilters();
    }
  }

  // returns 'true' if all filters match
  private showThisApp(item: Project): boolean {
    // Region filter
    const regionMatch = !this.regionFilter.length || 
      this.regionFilter.some((region: any) => region.name === item.region);

    // Phase filter
    const phaseMatch = !this.phaseFilter.length || 
      this.phaseFilter.some(phase => phase._id === item.currentPhaseName?._id);

    // Type filter
    const typeMatch = !this.typeFilter.length || 
      this.typeFilter.some(type => type.name === item.type);

    // Applicant/Project name filter
    const applicantFilter = this.applicantFilter?.trim().toUpperCase();
    const projectName = item.name?.toUpperCase();
    const applicantMatch = !applicantFilter || 
      (projectName && projectName.includes(applicantFilter));

    // Disposition ID filter
    const dispIdMatch = !this.dispIdFilter || 
      (item._id && item._id.toString().includes(this.dispIdFilter.toString()));

    return regionMatch && phaseMatch && typeMatch && applicantMatch && dispIdMatch;
  }

  private saveFilters() {
    const params: Params = {};

    // Helper to build comma-separated param
    const addArrayParam = (key: string, values: any[], getValue: (v: any) => string) => {
      const filtered = values.filter(Boolean);
      if (filtered.length) {
        params[key] = filtered.map(getValue).join(',');
      }
    };

    // Region filters
    if (this.regionFilter?.length) {
      addArrayParam('regions', this.regionFilter, (r) => r._id);
    }

    // Type filters
    if (this.typeFilter?.length) {
      addArrayParam('types', this.typeFilter, (t) => encodeURIComponent(t.code));
    }

    // Phase filters
    if (this.phaseFilter?.length) {
      addArrayParam('phases', this.phaseFilter, (p) => p._id);
    }

    // Text filters
    const applicantFilter = this.applicantFilter?.trim();
    if (applicantFilter) {
      params['applicant'] = applicantFilter;
    }

    if (this.clFileFilter?.toString().length) {
      params['clFile'] = this.clFileFilter;
    }

    if (this.dispIdFilter?.toString().length) {
      params['dispId'] = this.dispIdFilter;
    }

    const purposeFilter = this.purposeFilter?.trim();
    if (purposeFilter) {
      params['purpose'] = purposeFilter;
    }

    // Date filters
    if (this.publishFromFilter) {
      params['publishFrom'] = DateTime.fromJSDate(this.publishFromFilter).toFormat('yyyy-MM-dd');
    }

    if (this.publishToFilter) {
      params['publishTo'] = DateTime.fromJSDate(this.publishToFilter).toFormat('yyyy-MM-dd');
    }

    // Update browser URL without reloading
    this.location.go(
      this.router.createUrlTree([], { relativeTo: this.route, queryParams: params }).toString()
    );
  }

  public resetAllFilters() {
    this.internalResetAllFilters(true);
  }

  // (re)sets all filters from current param map
  private internalResetAllFilters(doApply: boolean) {
    if (this.paramMap) {
      // set region filters according to current param options
      const regions = (this.paramMap.get('regions') || '').split(',');
      this.regionKeys.forEach(key => {
        this.regionFilter[key] = regions.includes(key);
      });

      // set cpStatus filters according to current param options
      const cpStatuses = (this.paramMap.get('cpStatuses') || '').split(',');
      this.cpStatusKeys.forEach(key => {
        this.cpStatusFilters[key] = cpStatuses.includes(key);
      });

      // set appStatus filters according to current param options
      const appStatuses = (this.paramMap.get('appStatuses') || '').split(',');
      this.appStatusKeys.forEach(key => {
        this.appStatusFilters[key] = appStatuses.includes(key);
      });

      this.applicantFilter = this.paramMap.get('applicant');
      this.clFileFilter = this.paramMap.get('clFile') ? +this.paramMap.get('clFile')! : null;
      this.dispIdFilter = this.paramMap.get('dispId') ? +this.paramMap.get('dispId')! : null;
      this.purposeFilter = this.paramMap.get('purpose');
      this.publishFromFilter = this.paramMap.get('publishFrom') ? DateTime.fromISO(this.paramMap.get('publishFrom')!).toJSDate() : null;
      this.publishToFilter = this.paramMap.get('publishTo') ? DateTime.fromISO(this.paramMap.get('publishTo')!).toJSDate() : null;

      // Handle filters.
      const setRegions = this.paramMap.get('regions');
      const setPhases = this.paramMap.get('phases');
      const setTypes = this.paramMap.get('types');
      let regionIds = setRegions ? setRegions.split(',') : null;
      let phaseIds = setPhases ? setPhases.split(',') : null;
      let typeIds = setTypes ? setTypes.split(',') : null;

      // Map to List objects.
      if (regionIds) {
        regionIds.forEach(regionId => {
          this.regionFilter.push(this.projectRegions.find(region => region._id === regionId));
        });
      }

      if (phaseIds) {
        phaseIds.forEach(phaseId => {
          this.phaseFilter.push(this.projectPhases.find(phase => phase._id === phaseId));
        });
      }

      if (typeIds) {
        typeIds.forEach(typeCode => {
          this.typeFilter.push(this.projectTypes.find(type => type.code === typeCode));
        });
      }
    }

    // if called from UI, apply new filters
    // otherwise this was called internally (eg, init)
    if (doApply) {
      this.internalApplyAllFilters(true);
    }
  }

  //
  // The following are to "Clear" the filters.
  //
  public clearRegionFilters() {
    this.regionKeys.forEach(key => {
      this.regionFilter[key] = false;
    });
    this.applyRegionFilters();
  }

  public clearCpStatusFilters() {
    this.cpStatusKeys.forEach(key => {
      this.cpStatusFilters[key] = false;
    });
    this.applyCpStatusFilters();
  }

  public clearAppStatusFilters() {
    this.appStatusKeys.forEach(key => {
      this.appStatusFilters[key] = false;
    });
    this.applyAppStatusFilters();
  }

  public clearAllFilters() {
    this.clearRegionFilters();
    this.clearCpStatusFilters();
    this.clearAppStatusFilters();
    this.applicantFilter = null;
    this.clFileFilter = null;
    this.dispIdFilter = null;
    this.purposeFilter = null;
    this.publishFromFilter = null;
    this.publishToFilter = null;

    this.applyAllFilters();
  }

  public regionCount(): number {
    return this.regionKeys.filter(key => this.regionFilter[key]).length;
  }

  public cpStatusCount(): number {
    return this.cpStatusKeys.filter(key => this.cpStatusFilters[key]).length;
  }

  public appStatusCount(): number {
    return this.appStatusKeys.filter(key => this.appStatusFilters[key]).length;
  }

  private applicantFilterCount(): number {
    return this.applicantFilter?.trim() ? 1 : 0;
  }

  private clFileFilterCount(): number {
    return this.clFileFilter?.toString().length ? 1 : 0;
  }

  private dispIdFilterCount(): number {
    return this.dispIdFilter?.toString().length ? 1 : 0;
  }

  private purposeFilterCount(): number {
    return this.purposeFilter?.trim() ? 1 : 0;
  }

  private publishFilterCount(): number {
    return (this.publishFromFilter || this.publishToFilter) ? 1 : 0;
  }

  public filterCount(): number {
    return this.regionCount()
      + this.cpStatusCount()
      + this.appStatusCount()
      + this.applicantFilterCount()
      + this.clFileFilterCount()
      + this.dispIdFilterCount()
      + this.purposeFilterCount()
      + this.publishFilterCount();
  }


  public onShowHideClick() {
    this.configService.isApplistFiltersVisible = !this.isFiltersCollapsed;
  }

  public onLoadStart(): void {
    this.loading.set(true);
  }

  public onLoadEnd(): void {
    this.loading.set(false);
  }

  public toggleFilters() {
    this.showFilters = !this.showFilters;
  }
}
