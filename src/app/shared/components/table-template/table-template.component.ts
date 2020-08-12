import { Component, Input, OnInit, ComponentFactoryResolver, OnDestroy, ViewChild, Output, EventEmitter, SimpleChanges, OnChanges, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';
import * as _ from 'lodash';
import { Router } from '@angular/router';
import { StorageService } from 'app/services/storage.service';
import { TableDirective } from './table.directive';
import { TableObject } from './table-object';
import { TableComponent } from './table.component';
import { FilterObject } from './filter-object';
import { Constants } from 'app/shared/utils/constants';

@Component({
  selector: 'app-table-template',
  templateUrl: './table-template.component.html',
  styleUrls: ['./table-template.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableTemplateComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: TableObject;
  @Input() columns: any[];
  @Input() pageSizeArray: number[];
  @Input() activePageSize: number;
  @Input() activePage: number = Constants.tableDefaults.DEFAULT_CURRENT_PAGE;
  @Input() hidePager = false;
  @Input() showMoreLoader = false;
  @Input() showMoreIncrement: number = Constants.tableDefaults.DEFAULT_SHOW_MORE_INCREMENT;
  @Input() showCountAtTop = true;
  // use the below options for dynamic search control configuration
  // These are only relevent if "showSearch" is true
  @Input() showTableTemplate = true;
  @Input() showSearch = false;
  @Input() showAdvancedSearch = false;
  @Input() searchDisclaimer: string = null;
  @Input() filters: FilterObject[];
  @Input() buttonFilter: FilterObject;
  @Input() persistenceId: string = null;
  @Input() showSearchHelp = true;

  @ViewChild(TableDirective, {static: true}) tableHost: TableDirective;

  @Output() onPageNumUpdate: EventEmitter<any> = new EventEmitter();
  @Output() onSelectedRow: EventEmitter<any> = new EventEmitter();
  @Output() onColumnSort: EventEmitter<any> = new EventEmitter();
  @Output() onSearch: EventEmitter<any> = new EventEmitter();

  public column: string = null;

  interval: any;

  public keywords: string = null;
  public searching = false;

  public readonly constants = Constants;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private storageService: StorageService,
    private router: Router) { }

  ngOnInit() {
    if (!this.showTableTemplate && !this.data) {
      // we are going to ignore the table, so just create a stub data component
      this.data = new TableObject(null, null, { totalListItems: 0, pageSize: 0, currentPage: 1, sortBy: null }, null);
    }

    this.restorePersistence();
    this.loadComponent();

    this.activePageSize = parseInt(this.data.paginationData.pageSize, 10);
    const pageSizeTemp = [10, 25, 50, 100, parseInt(this.data.paginationData.totalListItems, 10)];
    this.pageSizeArray = pageSizeTemp.filter(function(el: number) { return el >= 10; });
    this.pageSizeArray.sort(function(a: number, b: number) { return a - b });
    if (this.activePage !== parseInt(this.data.paginationData.currentPage, 10)) {
      this.activePage = parseInt(this.data.paginationData.currentPage, 10);
    }

    // Store previous and default values on the data's pagination set.
    if (this.showSearch && !this.data.paginationData.hasOwnProperty('previousFilters')) {
      this.data.paginationData.previousFilters = null;
      this.data.paginationData.previousKeyword = null;
      this.data.paginationData.defaultSortBy = this.data.paginationData.sortBy
    }

    // values passed in on the URL should override any current settings
    this.router.url.split(';').forEach(filterVal => {
      if (filterVal.split('=').length === 2) {
        let filterName = filterVal.split('=')[0];
        let val = filterVal.split('=')[1];

        if (val && val !== 'null' && val.length !== 0) {

          if (filterName === 'keywords') {
            this.data.paginationData.keywords = val;
          } else if (filterName === 'pageSize') {
            this.data.paginationData.pageSize = parseInt(val, 10);
          } else if (filterName === 'currentPage') {
            this.data.paginationData.currentPage = parseInt(val, 10);
          } else if (filterName === 'sortBy') {
            this.data.paginationData.sortBy = val;
          }

          if (!['currentPage', 'pageSize', 'sortBy', 'ms', 'keywords'].includes(filterName)) {
            this.filters.forEach(filter => {
              if (filter.id === filterName) {
                filter.options.forEach(option => {
                  if (option.hasOwnProperty('code') && option.name.toLowerCase() === val.toLowerCase()) {
                    filter.selectedOptions.push(option);
                  } else if (option.hasOwnProperty('_id') && option._id === val) {
                    filter.selectedOptions.push(option);
                  }
                })
              }
            })
          }
        }
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // only run when property "data" changed
    if (!changes.firstChange && changes['data'] && changes['data'].currentValue && this.data && this.data.component && this.data.paginationData && this.data.data) {
      this.data.component = changes['data'].currentValue.component;
      this.data.data = changes['data'].currentValue.data;
      this.data.paginationData = changes['data'].currentValue.paginationData;
      this.data.extraData = changes['data'].currentValue.extraData;
      this.column = changes['data'].currentValue.paginationData.sortBy;

      this.loadComponent();
    }

    this.searching = false;
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  loadComponent() {
    if (this.data && this.data.component) {

      let componentFactory = this.componentFactoryResolver.resolveComponentFactory(this.data.component);

      let viewContainerRef = this.tableHost.viewContainerRef;
      viewContainerRef.clear();

      let componentRef = viewContainerRef.createComponent(componentFactory);
      (<TableComponent>componentRef.instance).data = this.data;

      // Don't subscribe if it doesn't exist.
      if (componentRef.instance.selectedCount) {
        componentRef.instance.selectedCount.subscribe(msg => {
          this.onSelectedRow.emit(msg);
        });
      } else {
        //  TODO: Display an error with no documents returning
      }
    }

    this.searching = false;
  }

  // Table action emits
  sort(property: string) {
    if (this.data.paginationData.sortBy && this.data.paginationData.sortBy.charAt(0) === '+') {
      this.data.paginationData.sortBy = '-' + property;
    } else {
      this.data.paginationData.sortBy = '+' + property;
    }
    this.onColumnSort.emit(property);
    this.search();
  }

  updatePageNumber(pageNum) {
    this.data.paginationData.currentPage = pageNum;
    this.activePage = pageNum;
    this.onPageNumUpdate.emit(pageNum);
    this.search();
  }

  updatePageSize(pageSize) {
    this.activePageSize = pageSize;
    this.data.paginationData.pageSize = pageSize;
    // If the user changes the size of the page, we should go
    // back to the first page, just like if we changed a
    // query filter/keyword
    this.updatePageNumber(1);
  }

  // Searching and filtering functions

  // Search is triggered when the user clicks the "search" button
  // this will create a filter set, persist if needed, and it will
  // emit to the parent container a search package that contains
  // the filters and keywords needed to perform the desired search
  search() {
    // if the new search doesnt match the old search, reset to page 1
    let newFilters = this.getFiltersForAPI();

    // if the current filters/keyword does not match previous filter/keyword
    // reset the page and sortBy back to defaults. Persist the changed values

    if ((this.data.paginationData.previousKeyword != null && this.data.paginationData.previousKeyword !== this.keywords) ||
       (this.data.paginationData.previousFilters != null && JSON.stringify(this.data.paginationData.previousFilters) !== JSON.stringify(newFilters))) {
      this.data.paginationData.currentPage = 1;
      // for default searches, also include the score. This will bubble
      // the highest related match up to the top, but will only trigger
      // that behaviour if the user has entered a new search term and if
      // the data supports the score attribute
      this.data.paginationData.sortBy = '-score,' + this.data.paginationData.defaultSortBy;
      this.data.paginationData.previousFilters = { ...newFilters };
      this.data.paginationData.previousKeyword = this.keywords;
      // because we're changing the values here, fire an emit
      this.onColumnSort.emit(this.data.paginationData.defaultSortBy);
      this.onPageNumUpdate.emit(1);
      this.activePage = 1;
    }

    this.persist();

    // The search package to return to the parent component
    let searchPackage = {
      filterForAPI: newFilters,
      keywords: this.keywords ? this.keywords : '',
      paginationData: this.data.paginationData
    }

    // emit to parent that a search has been requested
    // send the search package, consisting of filters and keyword
    this.searching = true;
    this.onSearch.emit(searchPackage);

    if (!this.showTableTemplate) {
      this.searching = false;
    }
  }

  // Build the Filter for API object. This is used by the api service
  // for sending filters to the search endpoint
  getFiltersForAPI() {
    let filtersForAPI = {};

    if (this.filters) {
      this.filters.forEach(filter => {
        if (!filter.collection) {
          this.addToFiltersByCollection(filtersForAPI, filter);
        } else {
          // theoretically, a developer could add collections to collections, so we should
          // handle this recursively. However, the UI doesn't currently support this so
          // we'll assume only top level collections.
          filter.collection.forEach(subfilter => {
            this.addToFiltersByCollection(filtersForAPI, subfilter);
          });
        }
      });
    }

    if (this.buttonFilter) {
      this.addToFiltersByCollection(filtersForAPI, this.buttonFilter);
    }

    return filtersForAPI;
  }

  private addToFiltersByCollection(filtersForAPI, filter) {
    if (filter.selectedOptions && filter.selectedOptions.length > 0) {
      filtersForAPI[filter.id] = '';
      filter.selectedOptions.forEach(option => {
        if (option.hasOwnProperty('code') && option['code']) {
          filtersForAPI[filter.id] += (filter.id === 'pcp' ? option.code : option.name) + ',';
        } else if (option.hasOwnProperty('_id')) {
          filtersForAPI[filter.id] += option._id + ',';
        } else {
          filtersForAPI[filter.id] += option + ',';
        }
      });
      filtersForAPI[filter.id] = filtersForAPI[filter.id].slice(0, -1);
    }

    if (filter.dateFilter) {
      if (filter.startDate) {
        filtersForAPI[filter.dateFilter.startDateId] = filter.startDate.year + '-' + filter.startDate.month + '-' + filter.startDate.day;
      }
      if (filter.endDate) {
        filtersForAPI[filter.dateFilter.endDateId] = filter.endDate.year + '-' + filter.endDate.month + '-' + filter.endDate.day;
      }
    }

    if (filtersForAPI[filter.id] === null || filtersForAPI[filter.id] === '') {
      delete filtersForAPI[filter.id];
    }
  }

  // clear all filters and keywords
  clearAllFilters() {
    this.keywords = '';
    this.filters.forEach(filter => {
      filter.selectedOptions = [];
      if (filter.collection) {
        filter.collection.forEach(subfilter => {
          subfilter.selectedOptions = [];
        });
      }
    })
  }

  // Check if any filter window is currently active. If so, and we're showing advanced search
  // move the search button down
  isShowingFilter() {
    let isOpen = false;

    for (let idx in this.filters) {
      if (idx && this.filters[idx].active) {
        isOpen = true;
        break;
      }
    }

    return isOpen;
  }
  // Toggle a filter display on or off (set active to true/false)
  toggleFilter(filter: FilterObject) {
    filter.active = !filter.active;
    this.filters.forEach(otherfilter => {
      if (filter.name !== otherfilter.name) { otherfilter.active = false };
      // otherfilter.active = otherfilter.name === filter.name; would be nicer, but then we can only see one at a time
    });
  }

  // Toggle a filter option on or off (for button type filter)
  toggleFilterOption(filter: FilterObject, option) {
    if (!option.hasOwnProperty('active')) {
      option.active = false;
    }

    option.active = !option.active;

    // add or remove from filters selected Options
    if (option.active) {
      filter.selectedOptions.push(option);
    } else {
      this.clearSelectedItem(filter, option);
    }
  }

  // comparator for filters. We use objects in Constants, or list objects from
  // the DB, so check for the possible identifiers of code or _id. If we have
  // neither, then assume a string to string comparison
  public filterCompareWith(item: any, itemToCompare: any) {
    if (item.hasOwnProperty('code')) {
      return item && itemToCompare
        ? item.code === itemToCompare.code
        : item === itemToCompare;
    } else if (item.hasOwnProperty('_id')) {
      return item && itemToCompare
        ? item._id === itemToCompare._id
        : item === itemToCompare;
    } else {
      return item === itemToCompare;
    }
  }

  clearSelectedItem(filter: FilterObject, item: any) {
    // may have strings, or a list of code table items with _id values
    filter.selectedOptions = filter.selectedOptions.filter(option => {
      return option !== item || option._id !== item._id
    });
  }

  getCollectionSelectedCount(filter) {
    let count = 0;

    if (filter.collection) {
      filter.collection.forEach(subfilter => {
        count += subfilter.selectedOptions ? subfilter.selectedOptions.length : 0;
      });
    }

    return count;
  }

  // If the component has a persistence ID set, it means we will persist the table
  // filters, so if a user changes pages and comes back, their previous search
  // will auto-populate
  private async persist() {
    if (this.showSearch && this.persistenceId && this.persistenceId !== '') {

      // if the searchComponent set doesn't exist in storage, create it
      if (!this.storageService.state.searchComponent) {
        this.storageService.state.searchComponent = {};
      }

      // if the persistenceId hasn't been created in searchComponent, create it
      if (!this.storageService.state.searchComponent[this.persistenceId]) {
        this.storageService.state.searchComponent[this.persistenceId] = {};
      }

      // fetch the persistence object for clarity in the code below
      let persistenceObject = this.storageService.state.searchComponent[this.persistenceId];

      let selectedFilters = {};
      this.filters.forEach(filter => {
        selectedFilters[filter.id] = {};
        if (!filter.collection) {
          this.persistFilters(selectedFilters[filter.id], filter);
        } else {
          // this is a filter collection, so we need to persist the subfilter values instead
          selectedFilters[filter.id].subfilters = {};
          filter.collection.forEach(subFilter => {
            selectedFilters[filter.id].subfilters[subFilter.id] = {};
            this.persistFilters(selectedFilters[filter.id].subfilters[subFilter.id], subFilter);
          });
        }
      });
      persistenceObject.filters = selectedFilters;
      persistenceObject.keywords = this.keywords;
      persistenceObject.paginationData = this.data.paginationData;
    }
  }

  private persistFilters(selectedFilters, filter) {
    selectedFilters.selectedOptions = filter.selectedOptions ? filter.selectedOptions : [];
    // persist dates
    if (filter.dateFilter) {
      selectedFilters.startDate = filter.startDate;
      selectedFilters.endDate = filter.endDate;
    }
  }

  private restorePersistence() {
    // if the component is using persisted searches, check if we have any existing search configurations
    if (this.showSearch && this.persistenceId && this.persistenceId !== '' && this.storageService.state.searchComponent && this.storageService.state.searchComponent[this.persistenceId]) {
      // fetch the persistence object, for clarity in the code below
      let persistenceObject = this.storageService.state.searchComponent[this.persistenceId];
      let selectedFilters = persistenceObject.filters;

      this.filters.forEach(filter => {
        if (selectedFilters[filter.id]) {
          if (!selectedFilters[filter.id].hasOwnProperty('subfilters')) {
            this.restoreFilters(selectedFilters[filter.id], filter);
          } else {
            filter.collection.forEach(subFilter => {
              this.restoreFilters(selectedFilters[filter.id].subfilters[subFilter.id], subFilter);
            });
          }
        }
      });
      this.keywords = persistenceObject.keywords;
      this.data.paginationData = persistenceObject.paginationData;
    }
  }

  private restoreFilters(selectedFilters, filter) {
    filter.selectedOptions = selectedFilters.selectedOptions ? selectedFilters.selectedOptions : [];
    // set dates
    if (filter.dateFilter) {
      filter.startDate = selectedFilters.startDate;
      filter.endDate = selectedFilters.endDate;
    }
  }
}
