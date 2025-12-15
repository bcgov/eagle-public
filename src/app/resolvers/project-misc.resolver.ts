import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { TableService } from 'app/services/table.service';
// import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';
import { Constants } from 'app/shared/utils/constants';
import { PinsService } from 'app/services/pins.service';

// TODO: Complete implementation after TableTemplate migration
export const projectActivitiesResolver: ResolveFn<void> = (route): void => {
  const tableService = inject(TableService);
  // const tableTemplateUtils = inject(TableTemplate);
  
  const tableId = 'projectActivities';
  tableService.clearTable(tableId);
  
  const sortBy = route.queryParamMap.get('sortBy') || '-dateAdded';
  const keywords = route.queryParamMap.get('keywordsActivities') || Constants.tableDefaults.DEFAULT_KEYWORDS;
  const projId = route.parent?.paramMap.get('projId') || '';
  
  tableService.initTableData(tableId);
  tableService.fetchData(new SearchParamObject(
    tableId,
    keywords,
    'RecentActivity',
    [],
    1,
    10,
    sortBy,
    { project: projId },
    true
  ));
};

export const pinsResolver: ResolveFn<void> = (route): void => {
  const pinsService = inject(PinsService);
  
  pinsService.clearValue();
  const projectId = route.parent?.paramMap.get('projId') || '';
  const pageNum = Number(route.queryParamMap.get('currentPagePins')) || Constants.tableDefaults.DEFAULT_CURRENT_PAGE;
  const pageSize = Number(route.queryParamMap.get('pageSizePins')) || Constants.tableDefaults.DEFAULT_PAGE_SIZE;
  const sortBy = route.queryParamMap.get('sortByPins') || '+name';
  
  pinsService.fetchData(pageNum, pageSize, sortBy, projectId);
};

export const featuredDocumentsResolver: ResolveFn<void> = (route): void => {
  const tableService = inject(TableService);
  
  const tableId = 'featuredDocuments';
  tableService.clearTable(tableId);
  
  const projId = route.parent?.paramMap.get('projId') || '';
  const fields: any[] = [{ 'name': 'project', 'value': projId }];
  
  tableService.initTableData(tableId);
  tableService.fetchData(new SearchParamObject(
    tableId,
    '',
    'Document',
    fields,
    1,
    5,
    '-datePosted',
    { documentSource: 'PROJECT', isFeatured: 'true' },
    false,
    '+displayName'
  ));
};
