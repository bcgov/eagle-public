import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter, SimpleChanges, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, ParamMap, Params } from '@angular/router';
import { Location } from '@angular/common';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/operator/distinctUntilChanged';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/takeUntil';
import * as _ from 'lodash';
import * as moment from 'moment';

import { Constants } from 'app/shared/utils/constants';
import { Project } from 'app/models/project';
import { CommentPeriodService } from 'app/services/commentperiod.service';
import { ConfigService } from 'app/services/config.service';

export interface FiltersType {
  regionFilters: object;
  cpStatusFilters: object;
  appStatusFilters: object;
  applicantFilter: string;
  clFileFilter: string;
  dispIdFilter: string;
  purposeFilter: string;
  publishFromFilter: Date;
  publishToFilter: Date;
}

@Component({
  selector: 'app-projlist-filters',
  templateUrl: './projlist-filters.component.html',
  styleUrls: ['./projlist-filters.component.scss']
})

export class ProjlistFiltersComponent implements OnInit, OnChanges, OnDestroy {
  // NB: this component is bound to the same list of apps as the other components
  @Input() projects: Array<Project> = []; // from projects component
  @Output() updateMatching = new EventEmitter(); // to projects component

  readonly minDate = moment('2018-03-23').toDate(); // first app created
  readonly maxDate = moment().toDate(); // today

  public projectTypes: Array<any> = [];
  public projectRegions: Array<any> = [];
  public projectPhases: Array<any> = [];

  public isFiltersCollapsed: boolean;
  public isCpStatusCollapsed = true;
  public isAppStatusCollapsed = true;
  public loading = false;
  public showFilters = false;
  private paramMap: ParamMap = null;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  // search keys for drop-down menus
  public regionKeys: Array<string> = [];
  public cpStatusKeys: Array<string> = [];
  public appStatusKeys: Array<string> = [];

  // search keys for text boxes
  private applicantKeys: Array<string> = [];
  private purposeKeys: Array<string> = [];

  public cpStatusFilters: Array<any> = []; // array-like object
  public _cpStatusFilters: Array<any> = []; // temporary filters for Cancel feature

  public appStatusFilters: Array<any> = []; // array-like object
  public _appStatusFilters: Array<any> = []; // temporary filters for Cancel feature

  public applicantFilter: string = null;
  public _applicantFilter: string = null; // temporary filters for Cancel feature

  public regionFilter: Array<any> = [];
  public _regionFilter: Array<any> = [];

  public typeFilter: Array<any> = [];
  public _typeFilter: Array<any> = [];

  public phaseFilter: Array<any> = [];
  public _phaseFilter: Array<any> = [];

  public clFileFilter: number = null;
  public _clFileFilter: number = null; // temporary filters for Cancel feature

  public dispIdFilter: number = null;
  public _dispIdFilter: number = null; // temporary filters for Cancel feature

  public purposeFilter: string = null;
  public _purposeFilter: string = null; // temporary filters for Cancel feature

  public publishFromFilter: Date = null;
  public publishToFilter: Date = null;
  public _publishFromFilter: Date = null; // temporary filters for Cancel feature
  public _publishToFilter: Date = null; // temporary filters for Cancel feature

  //
  // (arrow) functions to return type-ahead results
  // ref: https://ng-bootstrap.github.io/#/components/typeahead/api
  //
  public applicantSearch = (text$: Observable<string>) =>
    text$
      .debounceTime(200)
      .distinctUntilChanged()
      .map(term => term.length < 1 ? []
        : this.applicantKeys.filter(key => key.indexOf(this._applicantFilter.toUpperCase()) > -1) // .slice(0, 10)
      );

  public purposeSearch = (text$: Observable<string>) =>
    text$
      .debounceTime(200)
      .distinctUntilChanged()
      .map(term => term.length < 1 ? []
        : this.purposeKeys.filter(key => key.indexOf(this._purposeFilter.toUpperCase()) > -1) // .slice(0, 10)
      );

  constructor(
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    public commentPeriodService: CommentPeriodService, // also used in template
    private configService: ConfigService,
    private elementRef: ElementRef
  ) {
  }

  // full height = top of app-applist-filters.app-filters + height of div.app-filters__header
  get clientHeight(): number {
    return this.elementRef.nativeElement.offsetTop + this.elementRef.nativeElement.firstElementChild.firstElementChild.clientHeight;
  }

  public ngOnInit() {
    this.configService.lists
    .switchMap(list => {
      list.forEach(item => {
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
    })
    .subscribe(paramMap => {
        this.paramMap = paramMap;

        // set filters according to paramMap
        this.internalResetAllFilters(false);
      });

    // load this list just once as it doesn't change
    Object.getOwnPropertyNames(Constants.subpurposes).forEach(purpose => {
      Constants.subpurposes[purpose].forEach(subpurpose => {
        this.purposeKeys.push(purpose.toUpperCase() + ' / ' + subpurpose.toUpperCase());
      });
    });
  }

  // called when apps list changes
  public ngOnChanges(changes: SimpleChanges) {
    if (changes.projects && !changes.projects.firstChange && changes.projects.currentValue) {

      this.applicantKeys = _.sortedUniq(_.compact(this.projects.map(app => app.name ? app.name.toUpperCase() : null)).sort());

      // (re)apply filtering
      this.internalApplyAllFilters(false);
    }
  }

  public ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  // FOR FUTURE USE
  public getFilters(): FiltersType {
    return {
      regionFilters: this.regionFilter,
      cpStatusFilters: this.cpStatusFilters,
      appStatusFilters: this.appStatusFilters,
      applicantFilter: this.applicantFilter && this.applicantFilter.trim(),
      clFileFilter: this.clFileFilter ? this.clFileFilter.toString() : null,
      dispIdFilter: this.dispIdFilter ? this.dispIdFilter.toString() : null,
      purposeFilter: this.purposeFilter && this.purposeFilter.trim(),
      publishFromFilter: this.publishFromFilter,
      publishToFilter: this.publishToFilter
    };
  }

  //
  // The following are to "Apply" the temporary filters: copy the temporary values to the actual variables, etc.
  //
  public applyRegionFilters() {
    this.regionFilter = { ...this._regionFilter };
    this.internalApplyAllFilters(true);
    // this.isRegionCollapsed = true; // FUTURE
  }

  public applyCpStatusFilters() {
    this.cpStatusFilters = { ...this._cpStatusFilters };
    this.internalApplyAllFilters(true);
    this.isCpStatusCollapsed = true;
  }

  public applyAppStatusFilters() {
    this.appStatusFilters = { ...this._appStatusFilters };
    this.internalApplyAllFilters(true);
    this.isAppStatusCollapsed = true;
  }

  public applyClFileFilter() {
    this.clFileFilter = this._clFileFilter;
    this.internalApplyAllFilters(true);
  }

  public applyAllFilters() {
    this.cpStatusFilters = { ...this._cpStatusFilters };
    this.appStatusFilters = { ...this._appStatusFilters };
    this.applicantFilter = this._applicantFilter;
    this.clFileFilter = this._clFileFilter;
    this.dispIdFilter = this._dispIdFilter;
    this.purposeFilter = this._purposeFilter;
    this.publishFromFilter = this._publishFromFilter;
    this.publishToFilter = this._publishToFilter;

    this.typeFilter = this._typeFilter;
    this.phaseFilter = this._phaseFilter;
    this.regionFilter = this._regionFilter;

    this.internalApplyAllFilters(true);
  }

  private internalApplyAllFilters(doSave: boolean) {
    this.projects.forEach(app => app.isMatches = this.showThisApp(app));

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
    let retVal = true; // for short-circuiting checks

    let regionMatch = true;
    if (this.regionFilter.length) {
      regionMatch = this.regionFilter.some(region => region.name === item.region);
    }

    let phaseMatch = true;
    if (this.phaseFilter.length) {
      phaseMatch = this.phaseFilter.some(phase => {
        if (item.currentPhaseName && item.currentPhaseName._id && phase._id === item.currentPhaseName._id) {
          return true;
        }

        return false;
      });
    }

    let typeMatch = true;
    if (this.typeFilter.length) {
      typeMatch = this.typeFilter.some(type => type.name === item.type);
    }

    // check for matching Applicant
    const applicantFilter = this.applicantFilter && this.applicantFilter.trim(); // returns null or empty
    retVal = retVal && (
      !this.applicantFilter || !item.name ||
      item.name.toUpperCase().indexOf(applicantFilter.toUpperCase()) > -1
    );

    // check for matching Disposition ID
    retVal = retVal && (
      !this.dispIdFilter || !item._id ||
      item._id.toString().indexOf(this.dispIdFilter.toString()) > -1
    );

    // Check matching filters
    retVal = retVal && (regionMatch && phaseMatch && typeMatch);

    return retVal;
  }

  private saveFilters() {
    const params: Params = {}; // array-like object

    this.regionKeys.forEach(key => {
      if (this.regionFilter[key]) {
        if (!params['regions']) {
          params['regions'] = key;
        } else {
          params['regions'] += ',' + key;
        }
      }
    });

    this.cpStatusKeys.forEach(key => {
      if (this.cpStatusFilters[key]) {
        if (!params['cpStatuses']) {
          params['cpStatuses'] = key;
        } else {
          params['cpStatuses'] += ',' + key;
        }
      }
    });

    this.appStatusKeys.forEach(key => {
      if (this.appStatusFilters[key]) {
        if (!params['appStatuses']) {
          params['appStatuses'] = key;
        } else {
          params['appStatuses'] += ',' + key;
        }
      }
    });

    if (this.regionFilter && Array.isArray(this.regionFilter)) {
      this.regionFilter.forEach(region => {
        if (!params['regions']) {
          params['regions'] = region._id;
        } else {
          params['regions'] += ',' + region._id;
        }
      });
    }

    if (this.typeFilter && Array.isArray(this.typeFilter)) {
      this.typeFilter.forEach(type => {
        if (!params['types']) {
          params['types'] = encodeURIComponent(type.code);
        } else {
          params['types'] += ',' + encodeURIComponent(type.code);
        }
      });
    }

    if (this.phaseFilter && Array.isArray(this.phaseFilter)) {
      this.phaseFilter.forEach(phase => {
        if (!params['phases']) {
          params['phases'] = phase._id;
        } else {
          params['phases'] += ',' + phase._id;
        }
      });
    }

    const applicantFilter = this.applicantFilter && this.applicantFilter.trim(); // returns null or empty
    if (applicantFilter) {
      params['applicant'] = applicantFilter;
    }

    // check length in case user entered then deleted value
    if (this.clFileFilter && this.clFileFilter.toString().length > 0) {
      params['clFile'] = this.clFileFilter;
    }

    // check length in case user entered then deleted value
    if (this.dispIdFilter && this.dispIdFilter.toString().length > 0) {
      params['dispId'] = this.dispIdFilter;
    }

    const purposeFilter = this.purposeFilter && this.purposeFilter.trim(); // returns null or empty
    if (purposeFilter) {
      params['purpose'] = purposeFilter;
    }

    if (this.publishFromFilter) {
      params['publishFrom'] = moment(this.publishFromFilter).format('YYYY-MM-DD');
    }

    if (this.publishToFilter) {
      params['publishTo'] = moment(this.publishToFilter).format('YYYY-MM-DD');
    }

    // change browser URL without reloading page (so any query params are saved in history)
    this.location.go(this.router.createUrlTree([], { relativeTo: this.route, queryParams: params }).toString());
  }

  //
  // The following are to "Cancel" the temporary filters: just reset the values.
  //
  public cancelRegionFilters() {
    this._regionFilter = { ...this.regionFilter };
    // this.isRegionCollapsed = true; // FUTURE
  }

  public cancelCpStatusFilters() {
    this._cpStatusFilters = { ...this.cpStatusFilters };
    this.isCpStatusCollapsed = true;
  }

  public cancelAppStatusFilters() {
    this._appStatusFilters = { ...this.appStatusFilters };
    this.isAppStatusCollapsed = true;
  }

  public cancelAllFilters() {
    this._regionFilter = { ...this.regionFilter };
    this._cpStatusFilters = { ...this.cpStatusFilters };
    this._appStatusFilters = { ...this.appStatusFilters };
    this._applicantFilter = this.applicantFilter;
    this._regionFilter = this.regionFilter;
    this._phaseFilter = this.phaseFilter;
    this._typeFilter = this.typeFilter;
    this._clFileFilter = this.clFileFilter;
    this._dispIdFilter = this.dispIdFilter;
    this._purposeFilter = this.purposeFilter;
    this._publishFromFilter = this.publishFromFilter;
    this._publishToFilter = this.publishToFilter;
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
      this.clFileFilter = this.paramMap.get('clFile') ? +this.paramMap.get('clFile') : null;
      this.dispIdFilter = this.paramMap.get('dispId') ? +this.paramMap.get('dispId') : null;
      this.purposeFilter = this.paramMap.get('purpose');
      this.publishFromFilter = this.paramMap.get('publishFrom') ? moment(this.paramMap.get('publishFrom')).toDate() : null;
      this.publishToFilter = this.paramMap.get('publishTo') ? moment(this.paramMap.get('publishTo')).toDate() : null;

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

      // copy all data from actual to temporary properties
      this._regionFilter = { ...this.regionFilter };
      this._cpStatusFilters = { ...this.cpStatusFilters };
      this._appStatusFilters = { ...this.appStatusFilters };
      this._applicantFilter = this.applicantFilter;
      this._clFileFilter = this.clFileFilter;
      this._dispIdFilter = this.dispIdFilter;
      this._purposeFilter = this.purposeFilter;
      this._publishFromFilter = this.publishFromFilter;
      this._publishToFilter = this.publishToFilter;
      this._regionFilter = this.regionFilter;
      this._typeFilter = this.typeFilter;
      this._phaseFilter = this.phaseFilter;
    }

    // if called from UI, apply new filters
    // otherwise this was called internally (eg, init)
    if (doApply) {
      this.internalApplyAllFilters(true);
    }
  }

  //
  // The following are to "Clear" the temporary filters.
  //
  public clearRegionFilters() {
    this.regionKeys.forEach(key => {
      this._regionFilter[key] = false;
    });
    this.applyRegionFilters();
  }

  public clearCpStatusFilters() {
    this.cpStatusKeys.forEach(key => {
      this._cpStatusFilters[key] = false;
    });
    this.applyCpStatusFilters();
  }

  public clearAppStatusFilters() {
    this.appStatusKeys.forEach(key => {
      this._appStatusFilters[key] = false;
    });
    this.applyAppStatusFilters();
  }

  public clearAllFilters() {
    this.clearRegionFilters();
    this.clearCpStatusFilters();
    this.clearAppStatusFilters();
    this._applicantFilter = null;
    this._clFileFilter = null;
    this._dispIdFilter = null;
    this._purposeFilter = null;
    this._publishFromFilter = null;
    this._publishToFilter = null;

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
    const applicantFilter = this.applicantFilter && this.applicantFilter.trim(); // returns null or empty
    return applicantFilter ? 1 : 0;
  }

  private clFileFilterCount(): number {
    return (this.clFileFilter && this.clFileFilter.toString().length > 0) ? 1 : 0;
  }

  private dispIdFilterCount(): number {
    return (this.dispIdFilter && this.dispIdFilter.toString().length > 0) ? 1 : 0;
  }

  private purposeFilterCount(): number {
    const purposeFilter = this.purposeFilter && this.purposeFilter.trim();  // returns null or empty
    return purposeFilter ? 1 : 0;
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

  public regionHasChanges(): boolean {
    return !_.isEqual(this._regionFilter, this.regionFilter);
  }

  public cpStatusHasChanges(): boolean {
    return !_.isEqual(this._cpStatusFilters, this.cpStatusFilters);
  }

  public appStatusHasChanges(): boolean {
    return !_.isEqual(this._appStatusFilters, this.appStatusFilters);
  }

  public onShowHideClick() {
    this.configService.isApplistFiltersVisible = !this.isFiltersCollapsed;
  }

  public onLoadStart() { this.loading = true; }

  public onLoadEnd() { this.loading = false; }

  public toggleFilters() {
    this.showFilters = !this.showFilters;
  }

}
