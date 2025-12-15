import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { TableService } from 'app/services/table.service';
// import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';

// TODO: Complete implementation after TableTemplate migration
export const projectNotificationsResolver: ResolveFn<void> = (route): void => {
  const tableService = inject(TableService);
  // const tableTemplateUtils = inject(TableTemplate);
  
  const tableId = 'projectNotificationsList';
  tableService.clearTable(tableId);
  
  // const tableObject = tableTemplateUtils.updateTableObjectWithUrlParams(params, new TableObject());
  
  const sortBy = route.queryParamMap.get('sortBy') || '+datePosted';
  const keywords = route.queryParamMap.get('keywords') || Constants.tableDefaults.DEFAULT_KEYWORDS;
  
  tableService.initTableData(tableId);
  tableService.fetchData(new SearchParamObject(
    tableId,
    keywords,
    'ProjectNotification',
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
