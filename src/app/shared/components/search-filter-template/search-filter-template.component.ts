import { ChangeDetectionStrategy, OnInit, OnDestroy, Component, input, output, inject, AfterViewInit, effect, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatOptionModule } from '@angular/material/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { takeWhile } from 'rxjs/operators';

import { FilterObject, FilterType } from './filter-object';
import { SubsetsObject } from './subset-object';
import { Utils } from 'app/shared/utils/utils';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { AutoCompleteMultiSelect2Component } from '../autocomplete-multi-select-2/autocomplete-multi-select-2.component';

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
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatTooltipModule,
    MatSelectModule,
    MatOptionModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    NgbDropdownModule,
    DatePickerComponent,
    AutoCompleteMultiSelect2Component
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class SearchFilterTemplateComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private document = inject(DOCUMENT);
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
  public previousKeywords: string = '';
  public queryParams: Record<string, any> = {};
  public formGroup!: FormGroup; // Helper formGroup for grabbing values from controls
  public showFiltersPanel = signal(false);

  private alive = true;

  constructor() {
    // Initialize showFiltersPanel from input
    effect(() => {
      this.showFiltersPanel.set(this.showAdvancedFilters());
    }, { allowSignalWrites: true });
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
            .setValue({ year: date.getFullYear(), day: date.getDay(), month: date.getMonth() });
        }

        if (defaultFormValues[filter.filterDefinition.endDateId]) {
          const date = new Date(defaultFormValues[filter.filterDefinition.endDateId]);

          groupControls[filter.filterDefinition.endDateId]
            .setValue({ year: date.getFullYear(), day: date.getDay(), month: date.getMonth() });
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
    this.formGroup.valueChanges.subscribe(val => {
      this.filterChange.emit(val);
      if (this.searchOnFilterChange()) {
        this.search();
      }
    });
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
    // Create a search package containing the users search
    // filters
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
          const convertedStartDate = this.utils.convertFormGroupNGBDateToJSDate(startDateControl.value);
          if (convertedStartDate) {
            searchPackage.filters[dateFilter.startDateId] = convertedStartDate.toISOString();
          }
        }

        const endDateControl = this.formGroup.get(dateFilter.endDateId);
        if (endDateControl?.value) {
          const convertedEndDate = this.utils.convertFormGroupNGBDateToJSDate(endDateControl.value);
          if (convertedEndDate) {
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
        if (filter.filterDefinition.selectedOptions.length > 0) {
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
    // and return the package to the host component
    this.searchEvent.emit(searchPackage);
  }

  /*****************************************************
   *  Utility and Helper functions
   *****************************************************/

  // hides and displays the advanced filters
  // Emits an event on the toggleFiltersPanelEvent emitter
  toggleAdvancedFilters() {
    // @ts-ignore
    if (window.hj) {
      // @ts-ignore
      window.hj('event', 'SEARCH_TOGGLED');
    }
    this.showFiltersPanel.update(val => !val);
    this.toggleFiltersPanelEvent.emit({ showPanel: this.showFiltersPanel() });
  }

  /**
   * Clears all filter components on the search form,
   * including keyword and subset selections
   *
   * @memberof SearchFilterTemplateComponent
   */
  clearFilters() {
    // reset the form group, doesn't appear to reset multiselects, or date ranges
    // @ts-ignore
    if (window.hj) {
      // @ts-ignore
      window.hj('event', 'FILTERS_CLEARED');
    }
    this.formGroup.reset();
    // clear multiSelects && date ranges
    for (const filter of this.filters().filter(f => f.type === FilterType.MultiSelect)) {
      filter.filterDefinition.selectedOptions = [];
    }
    // clear keywords
    this.keywordSearchWords.set('');
    // reset the subset settings
    const subsetsValue = this.subsets();
    if (subsetsValue) {
      this.changeSubset(subsetsValue.defaultSubset!);
    }
    // emit to the host that the form was reset
    this.resetControls.emit();
    // rerun the search
    this.search();
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
    // @ts-ignore
    if (window.hj) {
      // @ts-ignore
      window.hj('event', 'CHANGE_MULTISELECT');
    }
    this.search();
  }
}
