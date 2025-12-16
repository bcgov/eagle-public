import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { TableService } from 'app/services/table.service';
import { OrgService } from 'app/services/org.service';
import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';
import { TableObject } from 'app/shared/components/table-template/table-object';
import { PROJECT_LIST_TABLE_ID, FILTER_LIST, DATE_FILTER_LIST } from 'app/projects/project-list/project-list.constants';

export const projectListResolver: ResolveFn<void> = (route): void => {
  const tableService = inject(TableService);
  const orgService = inject(OrgService);
  const tableTemplateUtils = inject(TableTemplate);
  
  // Clear and initialize table
  tableService.clearTable(PROJECT_LIST_TABLE_ID);
  tableService.initTableData(PROJECT_LIST_TABLE_ID);
  
  // Fetch proponents
  orgService.fetchProponent();
  
  // Parse URL parameters more efficiently
  const queryParamMap = route.queryParamMap;
  const params: Record<string, string | null> = {};
  for (const key of queryParamMap.keys) {
    params[key] = queryParamMap.get(key);
  }
  
  // Create table object from URL params
  const tableObject = tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject());
  
  // Build filters from URL params using constants
  const filtersForAPI = tableTemplateUtils.getFiltersFromParams(params, FILTER_LIST);
  const dateFiltersForAPI = tableTemplateUtils.getDateFiltersFromParams(params, DATE_FILTER_LIST);
  
  // Fetch initial data
  tableService.fetchData(new SearchParamObject(
    PROJECT_LIST_TABLE_ID,
    params['keywords'] || Constants.tableDefaults.DEFAULT_KEYWORDS,
    'Project',
    [],
    tableObject.currentPage,
    tableObject.pageSize,
    tableObject.sortBy || '+name',
    {},
    true,
    '',
    { ...filtersForAPI, ...dateFiltersForAPI }
  ));
};
