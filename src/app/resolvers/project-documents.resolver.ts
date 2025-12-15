import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';

import { TableService } from 'app/services/table.service';
import { ConfigService } from 'app/services/config.service';
import { Utils } from 'app/shared/utils/utils';
import { Constants } from 'app/shared/utils/constants';
// import { TableTemplate } from 'app/shared/components/table-template/table-template';
import { SearchParamObject } from 'app/services/search.service';

// TODO: Complete implementation after TableTemplate migration
export const certificatesResolver: ResolveFn<void> = async (route): Promise<void> => {
  const tableService = inject(TableService);
  // const tableTemplateUtils = inject(TableTemplate);
  const configService = inject(ConfigService);
  const utils = inject(Utils);
  
  const tableId = 'certificates';
  tableService.clearTable(tableId);
  
  const projId = route.parent?.paramMap.get('projId') || '';
  
  tableService.initTableData(tableId);
  
  const list = await configService.lists.toPromise();
  const fields: any[] = [{ 'name': 'project', 'value': projId }];
  tableService.fetchData(new SearchParamObject(
    tableId,
    '',
    'Document',
    fields,
    1,
    10,
    '-datePosted',
    utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.CERTIFICATE, list),
    false,
    '+displayName'
  ));
};

export const amendmentsResolver: ResolveFn<void> = async (route): Promise<void> => {
  const tableService = inject(TableService);
  const configService = inject(ConfigService);
  const utils = inject(Utils);
  
  const tableId = 'amendments';
  tableService.clearTable(tableId);
  
  const projId = route.parent?.paramMap.get('projId') || '';
  tableService.initTableData(tableId);
  
  const list = await configService.lists.toPromise();
  const fields: any[] = [{ 'name': 'project', 'value': projId }];
  tableService.fetchData(new SearchParamObject(
    tableId,
    '',
    'Document',
    fields,
    1,
    10,
    '-datePosted',
    utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.AMENDMENT, list),
    false,
    '+displayName'
  ));
};

export const applicationResolver: ResolveFn<void> = async (route): Promise<void> => {
  const tableService = inject(TableService);
  const configService = inject(ConfigService);
  const utils = inject(Utils);
  
  const tableId = 'application';
  tableService.clearTable(tableId);
  
  const sortBy = route.queryParamMap.get('sortBy') || '+sortOrder,-datePosted,+displayName';
  const projId = route.parent?.paramMap.get('projId') || '';
  
  tableService.initTableData(tableId);
  
  const list = await configService.lists.toPromise();
  const fields: any[] = [{ 'name': 'project', 'value': projId }];
  tableService.fetchData(new SearchParamObject(
    tableId,
    '',
    'Document',
    fields,
    1,
    10,
    sortBy,
    utils.createProjectTabModifiers(Constants.optionalProjectDocTabs.APPLICATION, list),
    false,
    '+displayName'
  ));
};
