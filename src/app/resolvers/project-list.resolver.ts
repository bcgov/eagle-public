import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { TableService } from 'app/services/table.service';
import { OrgService } from 'app/services/org.service';
// import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';

// TODO: Complete implementation after TableTemplate migration
export const projectListResolver: ResolveFn<void> = (route): void => {
  const tableService = inject(TableService);
  const orgService = inject(OrgService);
  // const tableTemplateUtils = inject(TableTemplate);
  
  const tableId = 'projectList';
  tableService.clearTable(tableId);
  orgService.fetchProponent();
  
  // const tableObject = tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject());
  
  const sortBy = route.queryParamMap.get('sortBy') || '+name';
  const keywords = route.queryParamMap.get('keywords') || Constants.tableDefaults.DEFAULT_KEYWORDS;
  
  // TODO: Implement filtersForAPI and dateFiltersForAPI after TableTemplate migration
  
  tableService.initTableData(tableId);
  tableService.fetchData(new SearchParamObject(
    tableId,
    keywords,
    'Project',
    [],
    1, // tableObject.currentPage,
    10, // tableObject.pageSize,
    sortBy,
    {},
    true,
    '',
    {} // filters
  ));
};
