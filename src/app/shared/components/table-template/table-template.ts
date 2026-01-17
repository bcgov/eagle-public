import { Injectable, inject } from '@angular/core';
import { Router, Params } from '@angular/router';
import { TableObject } from './table-object';
import { Constants } from '../../utils/constants';

const EXCLUDED_NAV_PARAMS = ['columns', 'component', 'options', 'items', 'totalListItems', 'pageSizeOptions', 'tableId'] as const;

@Injectable({ providedIn: 'root' })
export class TableTemplate {
  private router = inject(Router);

  public updateTableObjectWithUrlParams(routeParams: Params, tableObject: TableObject, suffix = ''): TableObject {
    for (const [key, value] of Object.entries(routeParams)) {
      // Skip if value is null, undefined, or empty string
      if (value == null || value === '') {
        continue;
      }

      const cleanKey = suffix ? key.replace(suffix, '') : key;

      if (key === `currentPage${suffix}` || key === `pageSize${suffix}`) {
        (tableObject as Record<string, any>)[cleanKey] = +value;
      } else if (key === `sortBy${suffix}`) {
        (tableObject as Record<string, any>)[cleanKey] = value;
      }
    }

    // Apply defaults using nullish coalescing
    tableObject.pageSize ??= Constants.tableDefaults.DEFAULT_PAGE_SIZE;
    tableObject.currentPage ??= Constants.tableDefaults.DEFAULT_CURRENT_PAGE;
    tableObject.sortBy ??= Constants.tableDefaults.DEFAULT_SORT_BY;

    return tableObject;
  }

  /**
   * Navigates using the current tableObject params and any optional additional params.
   *
   * Note: If duplicate parameters are found, the ones from tableOject will take precedence.
   *
   * @param {TableObject} tableObject table object where standard table template query parameters will be take from.
   * @param {any[]} path url path to navigate to.
   * @param {object} [additionalParams={}] additional query parameters to include. If duplicate parameters are found,
   *   the ones from tableOject will take precedence. (optional)
   * @memberof TableTemplate
   */
  public navigateUsingParams(tableObject: TableObject, path: any[], additionalParams: object = {}) {
    if (!tableObject) {
      throw Error('Navigation Object cannot be null.');
    }

    if (!path || !path.length) {
      path = ['/'];
    }
    const params = this.getNavParamsObj(tableObject, additionalParams);
    path.push(params);
    this.router.navigate(path);
  }

  /**
   * Builds a query param object from the known table object params, and any optional additional params.
   *
   * @param tableObject table object where standard table template query parameters will be taken from
   * @param additionalParams additional query parameters to include (tableObject takes precedence)
   * @returns navigation parameters object
   */
  public getNavParamsObj(tableObject: TableObject, additionalParams: Record<string, any> = {}): Record<string, any> {
    const params: Record<string, any> = { ...additionalParams };

    // Build params directly, excluding specific properties
    for (const [key, value] of Object.entries(tableObject)) {
      if (value != null && value !== '' && !EXCLUDED_NAV_PARAMS.includes(key as any)) {
        params[key] = value;
      }
    }

    return params;
  }

  public getFiltersFromSearchPackage(
    searchPackage: { filters: Record<string, any> },
    filtersList: string[] = [],
    dateFiltersList: string[] = []
  ): Record<string, any> {
    const allFilters = [...filtersList, ...dateFiltersList];
    const extracted = this.getFiltersFromParams(searchPackage.filters, allFilters);
    
    // Set missing filters to null for URL merge (removes them from URL)
    const params: Record<string, any> = {};
    for (const filterName of allFilters) {
      params[filterName] = extracted[filterName] ?? null;
    }
    
    return params;
  }

  public getFiltersFromParams(params: Record<string, any>, filterLabels: string[]): Record<string, any> {
    const filterForAPI: Record<string, any> = {};
    
    for (const filterLabel of filterLabels) {
      const value = params[filterLabel];
      if (value != null) {
        filterForAPI[filterLabel] = Array.isArray(value) ? value.join() : value;
      }
    }
    
    return filterForAPI;
  }
}
