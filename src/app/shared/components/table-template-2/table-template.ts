import { Injectable } from '@angular/core';
import { Router, Params } from '@angular/router';
import { TableObject2 } from './table-object-2';
import { Constants } from '../../utils/constants';

@Injectable()
export class TableTemplate {
  constructor(private router: Router) { }

  public updateTableObjectWithUrlParams(routeParams: Params, tableObject: TableObject2, suffix: string = '') {
    Object.keys(routeParams).forEach(item => {
      if (
        !routeParams ||
        routeParams[item] === undefined ||
        routeParams[item] === null ||
        routeParams[item].length === 0
      ) {
        // console.log('skipping:', item);
      } else {
        switch (item) {
          case `currentPage${suffix}`:
          case `pageSize${suffix}`:
            tableObject[item.replace(suffix, '')] = +routeParams[item];
            break;
          case `sortBy${suffix}`:
            tableObject[item.replace(suffix, '')] = routeParams[item];
            break;
          default:
            break;
        }
      }
    });

    if (!tableObject.pageSize) {
      tableObject.pageSize = Constants.tableDefaults.DEFAULT_PAGE_SIZE;
    }
    if (!tableObject.currentPage) {
      tableObject.currentPage = Constants.tableDefaults.DEFAULT_CURRENT_PAGE;
    }
    if (!tableObject.sortBy) {
      tableObject.sortBy = Constants.tableDefaults.DEFAULT_SORT_BY;
    }

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
  public navigateUsingParams(tableObject: TableObject2, path: any[], additionalParams: object = {}) {
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
   * @param {TableObject} tableObject table object where standard table template query parameters will be take from.
   * @param {object} [additionalParams={}] additional query parameters to include. If duplicate parameters are found,
   *   the ones from tableOject will take precedence. (optional)
   * @returns
   * @memberof TableTemplate
   */
  public getNavParamsObj(tableObject: TableObject2, additionalParams: object = {}) {
    const params = { ...additionalParams };

    Object.keys(tableObject).forEach(item => {
      if (
        !tableObject ||
        tableObject[item] === undefined ||
        tableObject[item] === null ||
        tableObject[item].length === 0
      ) {
        // console.log('skipping:', item);
      } else {
        params[item] = tableObject[item];
      }
    });

    delete params['columns'];
    delete params['component'];
    delete params['options'];
    delete params['items'];
    delete params['totalListItems'];
    delete params['pageSizeOptions'];
    delete params['tableId'];

    return params;
  }
}
