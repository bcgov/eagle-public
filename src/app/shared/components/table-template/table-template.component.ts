import { Component, Input, OnInit, ComponentFactoryResolver, OnDestroy, ViewChild, Output, EventEmitter, SimpleChanges, OnChanges, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/takeUntil';
import * as _ from 'lodash';
import { ApiService } from 'app/services/api';
import { SearchService } from 'app/services/search.service';

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
  // use the below options for dynamic table control
  @Input() showSearch = false;
  @Input() showAdvancedSearch = false;
  @Input() searchDisclaimer: string = null;
  @Input() filters: FilterObject[];
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

  private previousFilters;
  private previousKeyword;
  private defaultSortBy;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    public api: ApiService,
    public searchService: SearchService) { }

  ngOnInit() {
    this.loadComponent();

    this.activePageSize = parseInt(this.data.paginationData.pageSize, 10);
    const pageSizeTemp = [10, 25, 50, 100, parseInt(this.data.paginationData.totalListItems, 10)];
    this.pageSizeArray = pageSizeTemp.filter(function(el: number) { return el >= 10; });
    this.pageSizeArray.sort(function(a: number, b: number) { return a - b });
    if (this.activePage !== parseInt(this.data.paginationData.currentPage, 10)) {
      this.activePage = parseInt(this.data.paginationData.currentPage, 10);
    }

    this.defaultSortBy = this.data.paginationData.sortBy;
  }

  ngOnChanges(changes: SimpleChanges) {
    // only run when property "data" changed
    if (!changes.firstChange && changes['data'].currentValue && this.data && this.data.component && this.data.paginationData && this.data.data) {
      this.data.component = changes['data'].currentValue.component;
      this.data.data = changes['data'].currentValue.data;
      this.data.paginationData = changes['data'].currentValue.paginationData;
      this.data.extraData = changes['data'].currentValue.extraData;
      this.column = changes['data'].currentValue.paginationData.sortBy;
      this.loadComponent();
    }
  }

  public sort(property: string) {
    this.onColumnSort.emit(property);
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
  }

  updatePageNumber(pageNum) {
    this.onPageNumUpdate.emit(pageNum);
  }
  updatePageSize(pageSize) {
    this.data.paginationData.pageSize = pageSize;
    this.onPageNumUpdate.emit(1);
  }

  // Searching and filtering components

  search() {
    // if the new search doesnt match the old search, reset to page 1
    let newFilters = this.getFiltersForAPI();

    if (this.previousKeyword !== this.keywords || JSON.stringify(this.previousFilters) !== JSON.stringify(newFilters)) {
      this.data.paginationData.pageNum = 1;
      this.data.paginationData.sortBy = this.defaultSortBy;
    }

    this.previousFilters = { ...newFilters };
    this.previousKeyword = this.keywords;

    let searchPackage = {
      filterForAPI: newFilters,
      keywords: this.keywords
    }
    this.onSearch.emit(searchPackage);
  }

  getFiltersForAPI() {
    let filtersForAPI = {};
    this.filters.forEach(filter => {
      if (!filter.hasDateFilter) {
        filtersForAPI[filter.id] = '';
        filter.selectedOptions.forEach(option => {
          if (option.hasOwnProperty('code')) {
            filtersForAPI[filter.id] += option.code + ',';
          } else if (option.hasOwnProperty('_id')) {
            filtersForAPI[filter.id] += option._id + ',';
          } else {
            filtersForAPI[filter.id] += option + ',';
          }
        });
        filtersForAPI[filter.id] = filtersForAPI[filter.id].slice(0, -1);
      } else {
        // handle a date filter. For this to work, we need the ID of the date
        // filter to always match for start/end, and to always end in Start or End
        // We will need to rework this
        if (filter.startDate) {
          filtersForAPI[filter.dateFilter.startDateId] = filter.startDate;
        }
        if (filter.endDate) {
          filtersForAPI[filter.dateFilter.endDateId] = filter.endDate;
        }
      }

      if (filtersForAPI[filter.id] === null || filtersForAPI[filter.id] === '') {
        delete filtersForAPI[filter.id];
      }
    });

    return filtersForAPI;
  }

  clearAllFilters() {
    this.keywords = '';
    this.filters.forEach(filter => {
      filter.selectedOptions = [];
    })
  }

  isShowingFilter() {
    return true;
  }

  toggleFilter(filter: FilterObject) {
    filter.active = !filter.active;
    this.filters.forEach(otherfilter => {
      if (filter.name !== otherfilter.name) { otherfilter.active = false };
      // otherfilter.active = otherfilter.name === filter.name; would be nicer
    });
  }

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
}
