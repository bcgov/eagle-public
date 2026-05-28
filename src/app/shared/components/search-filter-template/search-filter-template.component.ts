import { ChangeDetectionStrategy, OnInit, OnDestroy, Component, input, output, inject, AfterViewInit, effect, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { takeWhile } from 'rxjs/operators';

import { FilterObject, FilterType } from './filter-object';
import { SubsetsObject } from './subset-object';
import { Utils } from 'app/shared/utils/utils';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { AutoCompleteMultiSelectComponent } from '../autocomplete-multi-select/autocomplete-multi-select.component';
import { AnalyticsService } from 'app/services/analytics/analytics.service';

/**
 * Common template component for NRPTI search filters. The default component will only include a keyword
 * search bar. You can extend the functionality of the search by adding additional options.
 *
 * You can add a keyword subset filter by adding a subset object, which will display a dropdown on
 * the left of the keyword search, allowing for subset searches. See the SubsetObject class for
 * further instructions on their setup and use
 *
 * You can add advanced filters by setting the advancedFilters option to true, and supplying
 * an array of FilterObjects. Filter objects include definitions for the advanced search
 * components, their source ID's, selectable options, and type. More informatin is
 * available in the FilterObject class.
 *
 * @export
 * @class SearchFilterTemplateComponent
 * @implements {OnInit}
 * @implements {OnDestroy}
 */
@Component({
  selector: 'search-filter-template',
  templateUrl: './search-filter-template.component.html',
  styleUrls: ['./search-filter-template.component.css'],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbTooltip,
    DatePickerComponent,
    AutoCompleteMultiSelectComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFilterTemplateComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);
  private analytics = inject(AnalyticsService);
  public utils = inject(Utils);

  // Inputs
  title = input<string>();
  tooltip = input<string>();
  keywordWatermark = input<string>();
  subsets = input<SubsetsObject | null>(null);
  advancedFilters = input(false);
  attachPanelToDiv = input<string | null>(null);
  advancedFilterTitle = input<string | null>(null);
  advancedFilterText = input<string | null>(null);
  showAdvancedFilters = input(false);
  searchOnFilterChange = input(true);
  filterItemPanelSize = input(4);
  filters = input<FilterObject[]>([]);
  keywordOverride = input('');
  searchHelpLinkArray = input<any[] | null>(null);
  searching = input(false);

  // Outputs and Emitters
  // searchEvent fires whenever a search is executed. The host component is responsible
  // for parsing the search package and handling as necessary
  searchEvent = output<any>();
  // resetControls fires when the filter form is reset
  resetControls = output<void>();
  // filterChange fires whenever a filter on the advanced filter form is changed
  filterChange = output<any>();
  // toggleFiltersPanelEvent fires when a User clicks the show/hide advanced filters button
  toggleFiltersPanelEvent = output<any>();

  // public vars
  public FilterType = FilterType; // enum access for the template html
  public keywordSearchWords = signal<string>('');
  public previousKeywords = '';
  public queryParams: Record<string, any> = {};
  public formGroup!: FormGroup; // Helper formGroup for grabbing values from controls
  public showFiltersPanel = signal(false);
  
  // Simple signal to track if any filters are active
  public hasActiveFilters = signal(false);

  private alive = true;
  private skipNextSearch = false;
  private valueChangesSubscription?: any;

  constructor() {
    // Initialize showFiltersPanel from input
    effect(() => {
      this.showFiltersPanel.set(this.showAdvancedFilters());
    });

    // Rebuild form when filters change
    effect(() => {
      const currentFilters = this.filters();
      if (currentFilters && currentFilters.length > 0 && this.advancedFilters()) {
        this.buildFormComponents();
      }
    });
  }

  ngOnDestroy(): void {
    this.alive = false;
  }

  ngOnInit() {
    const urlValues: Record<string, any> = {}; // Storage for the URL params

    // ensure we parse through values from the URL and preselect anything
    // that needs pre-selecting

    this.route.queryParamMap.pipe(takeWhile(() => this.alive)).subscribe(data => {
      const filterParams = { ...(data as any)['params'] };
      delete filterParams.currentPage;
      delete filterParams.pageSize;
      delete filterParams.sortBy;

      for (const key in filterParams) {
        // we know how to handle keyword and subset, but everything
        // else will be dynamic
        if (key === 'keywords') {
          this.keywordSearchWords.set(filterParams[key]);
        } else if (key === 'subset') {
          const subsetsValue = this.subsets();
          if (subsetsValue) {
            subsetsValue.selectedSubset = subsetsValue.options.find(subset => subset.subset === filterParams[key]) ||
              subsetsValue.options[0];
          }
        } else {
          // add all remaining kvp's onto the urlValues object.
          // We can use these when building the form group to preset
          // component values
          urlValues[key] = filterParams[key];
        }
      }
      
      // Update hasActiveFilters whenever URL params change
      if (this.formGroup) {
        this.updateHasActiveFilters();
      }
    });

    const keywordOverrideValue = this.keywordOverride();
    if (keywordOverrideValue) {
      this.keywordSearchWords.set(keywordOverrideValue);
    }

    // build formGroup based on provided filters
    this.buildFormComponents(urlValues);
  }

  /**
   * This will force a rebuild of all filter object components
   * in the search controls 'filters' array, and update the
   * forms group. This is kept public in case you want to allow
   * for dynamically changing the advanced filters on a host component
   *
   * @param {*} defaultFormValues A KVP object that will map default settings for filter values
   * @memberof SearchFilterTemplateComponent
   */
  buildFormComponents(defaultFormValues: Record<string, any> = {}) {
    // If we don't have advanced filters active, don't build the form
    if (!this.advancedFilters()) {
      return;
    }

    // ensure defaultFormValues isn't null
    if (defaultFormValues === null) {
      defaultFormValues = {};
    }

    // This sloppy mess will iterate over each filter that's been passed
    // into the filters array. For each filter type, a form control will
    // be created. If default form values are passed in, an attempt will
    // be made to preset the values.
    const groupControls: Record<string, FormControl> = {};

    this.filters().forEach(filter => {
      if (filter.type === FilterType.DateRange) {
        // read the url and apply val or null where appropriate
        groupControls[filter.filterDefinition.startDateId] = new FormControl();
        groupControls[filter.filterDefinition.endDateId] = new FormControl();

        if (defaultFormValues[filter.filterDefinition.startDateId]) {
          const date = new Date(defaultFormValues[filter.filterDefinition.startDateId]);

          groupControls[filter.filterDefinition.startDateId]
            .setValue({ year: date.getFullYear(), day: date.getDate(), month: date.getMonth() + 1 });
        }

        if (defaultFormValues[filter.filterDefinition.endDateId]) {
          const date = new Date(defaultFormValues[filter.filterDefinition.endDateId]);

          groupControls[filter.filterDefinition.endDateId]
            .setValue({ year: date.getFullYear(), day: date.getDate(), month: date.getMonth() + 1 });
        }
      } else if (filter.type === FilterType.Checkbox) {
        if (!filter.filterDefinition.grouped) {
          filter.filterDefinition.options.forEach((option: any) => {
            groupControls[option.id] = new FormControl();

            if (defaultFormValues[option.id]) {
              groupControls[option.id].setValue(defaultFormValues[option.id]);
            }
          });
        } else {
          const vals = defaultFormValues[filter.id];

          filter.filterDefinition.options.forEach((option: any) => {
            groupControls[option.id] = new FormControl();

            if (vals && vals.split(',').includes(option.id)) {
              groupControls[option.id].setValue(true);
            }
          });
        }
      } else if (filter.type === FilterType.MultiSelect) {
        groupControls[filter.id] = new FormControl();
        if (defaultFormValues[filter.id]) {
          groupControls[filter.id].setValue(decodeURIComponent(defaultFormValues[filter.id]));
        }
      } else if (filter.type === FilterType.Dropdown) {
        groupControls[filter.id] = new FormControl();

        if (defaultFormValues[filter.id]) {
          groupControls[filter.id].setValue(decodeURIComponent(defaultFormValues[filter.id].split(',')));
        }
      } else {
        groupControls[filter.id] = new FormControl();

        if (defaultFormValues[filter.id]) {
          groupControls[filter.id].setValue(defaultFormValues[filter.id]);
        }
      }
    });

    this.formGroup = new FormGroup(groupControls);
    this.valueChangesSubscription = this.formGroup.valueChanges.subscribe(val => {
      this.filterChange.emit(val);
      // Update hasActiveFilters whenever form changes
      this.updateHasActiveFilters();
      if (this.skipNextSearch) {
        this.skipNextSearch = false;
        return;
      }
      if (this.searchOnFilterChange()) {
        this.search();
      }
    });
    
    // Check initial state after form is built
    this.updateHasActiveFilters();
  }

  ngAfterViewInit() {
    // if the advanced filters panel is hidden, this will not work
    const attachPanelToDivValue = this.attachPanelToDiv();
    if (attachPanelToDivValue && this.document.getElementById(attachPanelToDivValue)) {
      // what if the user is hiding the advanced filters page? We need the panel
      // 'visible' to append... so just grab the value and re-apply after append
      const showAdvancedFiltersSetting = this.showFiltersPanel();
      this.showFiltersPanel.set(true);
      const panelElement = this.document.getElementById('advancedFilterPanel');
      const targetElement = this.document.getElementById(attachPanelToDivValue);
      if (panelElement && targetElement) {
        targetElement.appendChild(panelElement);
      }
      this.showFiltersPanel.set(showAdvancedFiltersSetting);
    }
  }

  /*****************************************************
   *  Events/Emitters
   *****************************************************/

  /**
   * Search will build a search package containing keyword and filter settings
   * and fire en event to the host component to handle the search.
   *
   * @memberof SearchFilterTemplateComponent
   */
  search() {
    const subsetsValue = this.subsets();
    const searchPackage = {
      keywords: this.keywordSearchWords(),
      keywordsChanged: this.keywordSearchWords() !== this.previousKeywords,
      subset: subsetsValue ? subsetsValue.selectedSubset!.subset : null,
      filters: {} as Record<string, any>
    };

    this.previousKeywords = this.keywordSearchWords();

    // loop through form filter objects, pull out the values
    // and append to the package
    this.filters().forEach(filter => {
      if (filter.type === FilterType.DateRange) {
        const dateFilter = filter.filterDefinition;

        const startDateControl = this.formGroup.get(dateFilter.startDateId);
        if (startDateControl?.value) {
          // Handle both ISO string format and NgbDateStruct format
          const value = startDateControl.value;
          let convertedStartDate: Date | null = null;
          
          if (typeof value === 'string') {
            // Value is already an ISO string from the date picker
            convertedStartDate = new Date(value);
          } else if (value && typeof value === 'object' && 'year' in value) {
            // Value is NgbDateStruct
            convertedStartDate = this.utils.convertFormGroupNGBDateToJSDate(value);
          }
          
          if (convertedStartDate && !isNaN(convertedStartDate.getTime())) {
            searchPackage.filters[dateFilter.startDateId] = convertedStartDate.toISOString();
          }
        }

        const endDateControl = this.formGroup.get(dateFilter.endDateId);
        if (endDateControl?.value) {
          // Handle both ISO string format and NgbDateStruct format
          const value = endDateControl.value;
          let convertedEndDate: Date | null = null;
          
          if (typeof value === 'string') {
            // Value is already an ISO string from the date picker
            convertedEndDate = new Date(value);
          } else if (value && typeof value === 'object' && 'year' in value) {
            // Value is NgbDateStruct
            convertedEndDate = this.utils.convertFormGroupNGBDateToJSDate(value);
          }
          
          if (convertedEndDate && !isNaN(convertedEndDate.getTime())) {
            searchPackage.filters[dateFilter.endDateId] = convertedEndDate.toISOString();
          }
        }
      } else if (filter.type === FilterType.Checkbox) {
        if (!filter.filterDefinition.grouped) {
          filter.filterDefinition.options.forEach((option: any) => {
            if (this.formGroup.get(option.id)!.value) {
              searchPackage.filters[option.id] = this.formGroup.get(option.id)!.value;
            }
          });
        } else {
          const groupedVals: string[] = [];

          filter.filterDefinition.options.forEach((option: any) => {
            if (this.formGroup.get(option.id)!.value) {
              groupedVals.push(option.id);
            }
          });

          if (groupedVals.length > 0) {
            searchPackage.filters[filter.id] = groupedVals;
          }
        }
      } else if (filter.type === FilterType.MultiSelect) {
        const groupedVals: string[] = [];
        if (filter.filterDefinition.selectedOptions && filter.filterDefinition.selectedOptions.length > 0) {
          filter.filterDefinition.selectedOptions.forEach((item: any) => {
            if (item._id) {
              groupedVals.push(item._id);
            } else {
              groupedVals.push(item.code);
            }
          });
          searchPackage.filters[filter.id] = groupedVals;
        } else {
          delete searchPackage.filters[filter.id];
        }
      } else {
        if (this.formGroup.get(filter.id)!.value) {
          searchPackage.filters[filter.id] = this.formGroup.get(filter.id)!.value;
        }
      }
    });
    
    // Update the reset button state
    this.updateHasActiveFilters();
    
    // Track search execution
    const activeFilterCount = Object.keys(searchPackage.filters).length;
    this.analytics.track('Search Executed', {
      search_term: searchPackage.keywords || '',
      has_keywords: !!searchPackage.keywords,
      keyword_count: searchPackage.keywords ? searchPackage.keywords.split(' ').length : 0,
      filter_count: activeFilterCount,
      subset: searchPackage.subset
    });
    
    // and return the package to the host component
    this.searchEvent.emit(searchPackage);
  }

  /*****************************************************
   *  Utility and Helper functions
   *****************************************************/

  // hides and displays the advanced filters
  // Emits an event on the toggleFiltersPanelEvent emitter
  toggleAdvancedFilters() {
    // @ts-expect-error - HotJar analytics not in types
    if (window.hj) {
      // @ts-expect-error - HotJar analytics not in types
      window.hj('event', 'SEARCH_TOGGLED');
    }
    
    // Track filter panel toggle
    const newState = !this.showFiltersPanel();
    this.analytics.track('Filters Panel Toggled', {
      action: newState ? 'opened' : 'closed'
    });
    
    this.showFiltersPanel.update(val => !val);
    this.toggleFiltersPanelEvent.emit({ showPanel: this.showFiltersPanel() });
  }

  /**
   * Clears all filter components and resets to default state
   */
  clearFilters() {
    // @ts-expect-error - HotJar analytics not in types
    if (window.hj) {
      // @ts-expect-error - HotJar analytics not in types
      window.hj('event', 'FILTERS_CLEARED');
    }
    
    // Track filters cleared
    this.analytics.track('Filters Cleared', {
      had_keywords: !!this.keywordSearchWords(),
      had_filters: this.hasActiveFilters()
    });
    
    // Unsubscribe from valueChanges to prevent ANY firings during ALL reset operations
    if (this.valueChangesSubscription) {
      this.valueChangesSubscription.unsubscribe();
    }
    
    // Reset form
    this.formGroup.reset();
    
    // Clear multi-select filters
    for (const filter of this.filters().filter(f => f.type === FilterType.MultiSelect)) {
      filter.filterDefinition.selectedOptions = [];
    }
    
    // Clear date range filters explicitly
    for (const filter of this.filters().filter(f => f.type === FilterType.DateRange)) {
      const startControl = this.formGroup.get(filter.filterDefinition.startDateId);
      const endControl = this.formGroup.get(filter.filterDefinition.endDateId);
      if (startControl) startControl.setValue(null);
      if (endControl) endControl.setValue(null);
    }
    
    // Clear keywords
    this.keywordSearchWords.set('');
    this.previousKeywords = '';
    
    // Reset subset
    const subsetsValue = this.subsets();
    if (subsetsValue) {
      subsetsValue.selectedSubset = subsetsValue.defaultSubset!;
    }
    
    // NOW re-subscribe to valueChanges after all changes are done
    this.valueChangesSubscription = this.formGroup.valueChanges.subscribe(val => {
      this.filterChange.emit(val);
      // Update hasActiveFilters whenever form changes
      this.updateHasActiveFilters();
      if (this.skipNextSearch) {
        this.skipNextSearch = false;
        return;
      }
      if (this.searchOnFilterChange()) {
        this.search();
      }
    });
    
    // Update hasActiveFilters after clearing (should be false)
    this.hasActiveFilters.set(false);
    
    // Emit single search event with empty filters
    this.resetControls.emit();
    this.searchEvent.emit({
      keywords: '',
      keywordsChanged: false,
      subset: subsetsValue ? subsetsValue.defaultSubset!.subset : null,
      filters: {}
    });
  }

  // Resets a specific filter
  resetFilter(filterId: string) {
    for (const filter of this.filters()) {
      if (filter.id === filterId && filter.type === FilterType.RadioPicker) {
        this.formGroup.get(filter.id)!.setValue(null);
        break;
      }
    }
  }

  /**
   * Clear the keyword search text box
   *
   * @memberof SearchFilterTemplateComponent
   */
  clearSearchTerms() {
    this.keywordSearchWords.set('');
    this.search();
  }

  /**
   * Check if any filters are currently active and update the signal
   */
  private updateHasActiveFilters(): void {
    let hasFilters = false;
    
    // Check keywords
    if (this.keywordSearchWords()) {
      hasFilters = true;
    }
    
    // Check filter definitions for multi-select filters (they store data in selectedOptions)
    if (!hasFilters) {
      for (const filter of this.filters()) {
        if (filter.type === FilterType.MultiSelect && 
            filter.filterDefinition.selectedOptions && 
            filter.filterDefinition.selectedOptions.length > 0) {
          hasFilters = true;
          break;
        }
      }
    }
    
    // Check form controls for any non-empty values (date ranges, checkboxes, etc)
    if (!hasFilters && this.formGroup) {
      const formValues = this.formGroup.value;
      for (const key in formValues) {
        const value = formValues[key];
        if (value) {
          if (Array.isArray(value) && value.length > 0) {
            hasFilters = true;
            break;
          } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
            hasFilters = true;
            break;
          } else if (typeof value === 'string' && value.trim() !== '') {
            hasFilters = true;
            break;
          } else if (typeof value === 'boolean' && value === true) {
            hasFilters = true;
            break;
          }
        }
      }
    }
    
    this.hasActiveFilters.set(hasFilters);
  }

  /**
   *
   * Change the selected subset item. Also, when
   * a subset changes, we should trigger a search event
   * if there are any keywords
   *
   * @param {*} subsetItem
   * @memberof SearchFilterTemplateComponent
   */
  changeSubset(subsetItem: any): void {
    const subsetsValue = this.subsets();
    if (subsetsValue) {
      subsetsValue.selectedSubset = subsetItem;
      this.queryParams[subsetItem.subsetLabel] = subsetItem.subset;

      if (this.keywordSearchWords()) {
        this.queryParams['keywords'] = this.keywordSearchWords();
        this.search();
      }
    }
  }

  changeMultiSelect() {
    // @ts-expect-error - HotJar analytics not in types
    if (window.hj) {
      // @ts-expect-error - HotJar analytics not in types
      window.hj('event', 'CHANGE_MULTISELECT');
    }
    this.search();
  }
}
