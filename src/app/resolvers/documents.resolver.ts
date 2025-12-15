import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { TableService } from 'app/services/table.service';
// import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';

// TODO: Complete implementation after TableTemplate migration
export const documentsResolver: ResolveFn<void> = (route): void => {
  const tableService = inject(TableService);
  // const tableTemplateUtils = inject(TableTemplate);
  
  const tableId = 'documentsTab';
  tableService.clearTable(tableId);
  
  const keywords = route.queryParamMap.get('keywords') || Constants.tableDefaults.DEFAULT_KEYWORDS;
  const projId = route.parent?.paramMap.get('projId') || '';
  
  // TODO: Implement filtersForAPI and dateFiltersForAPI after TableTemplate migration
  
  tableService.initTableData(tableId);
  tableService.fetchData(new SearchParamObject(
    tableId,
    keywords,
    'Document',
    [{ 'name': 'project', 'value': projId }],
    1,
    10,
    '-datePosted',
    { documentSource: 'PROJECT' },
    true,
    '+displayName',
    {} // filters
  ));
};
