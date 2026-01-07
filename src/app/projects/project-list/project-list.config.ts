import { inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { PROJECT_LIST_TABLE_ID, PROJECT_LIST_TABLE_COLUMNS, FILTER_CONFIGS, FILTER_LIST, DATE_FILTER_LIST, FilterConfig } from './project-list.constants';
import { ProjectListTableRowsComponent } from './project-list-table-rows/project-list-table-rows.component';
import { OrgService } from 'app/services/org.service';
import { ConfigService } from 'app/services/config.service';
import { FilterObject, FilterType } from 'app/shared/components/search-filter-template/filter-object';

/**
 * Builds filters for project list from org and config data
 */
function buildProjectListFilters(data: { orgs: any[]; lists: any[] }): FilterObject[] {
  const { orgs, lists } = data;
  
  const eaDecisions: any[] = [];
  const iaacInvolvements: any[] = [];
  const phases: any[] = [];

  lists.forEach((item: any) => {
    switch (item.type) {
      case 'eaDecision':
        eaDecisions.push({ ...item });
        break;
      case 'CEAA':
        iaacInvolvements.push({ ...item });
        break;
      case 'projectPhase':
        phases.push({ ...item });
        break;
    }
  });

  return FILTER_CONFIGS.map(config => createFilter(config, orgs, eaDecisions, iaacInvolvements, phases));
}

/**
 * Creates a FilterObject from configuration
 */
function createFilter(
  config: FilterConfig,
  proponents: any[],
  eaDecisions: any[],
  iaacInvolvements: any[],
  phases: any[]
): FilterObject {
  const dynamicOptions: Record<string, any[]> = {
    'eaDecision': eaDecisions,
    'CEAAInvolvement': iaacInvolvements,
    'currentPhaseName': phases,
    'proponent': proponents
  };

  const options = dynamicOptions[config.id] || config.options || [];

  let definition: any;
  if (config.type === FilterType.DateRange && config.dateConfig) {
    definition = {
      startDateId: config.dateConfig.startId,
      startDateLabel: config.dateConfig.startLabel,
      endDateId: config.dateConfig.endId,
      endDateLabel: config.dateConfig.endLabel,
      minDate: new Date('1900-01-01'),
      maxDate: new Date()
    };
  } else {
    definition = {
      options,
      useGroup: config.useGroup,
      matchId: config.matchId
    };
  }

  return new FilterObject(config.id, config.type, config.label, definition, config.panelSize ?? null);
}

/**
 * Creates the table-list configuration for project list
 */
export function createProjectListConfig(): TableListConfig {
  const orgService = inject(OrgService);
  const configService = inject(ConfigService);

  return {
    tableId: PROJECT_LIST_TABLE_ID,
    datasetType: 'Project',
    defaultSort: '+name',
    heroBanner: {
      title: 'Environmental Assessments in British Columbia',
      description: 'Use the list below to navigate to individual Projects. Click on any project to go directly to its details page.',
      backgroundImage: '/assets/images/hero-banner.jpg',
      actions: [{
        label: 'Search All Documents',
        icon: 'search',
        routerLink: '/search',
        title: 'Search All Documents'
      }]
    },
    tableColumns: PROJECT_LIST_TABLE_COLUMNS,
    tableRowComponent: ProjectListTableRowsComponent,
    filterList: FILTER_LIST,
    dateFilterList: DATE_FILTER_LIST,
    filterDataSource: combineLatest([
      orgService.getValue(),
      configService.lists
    ]).pipe(
      map(([orgs, lists]) => ({ orgs, lists }))
    ),
    filterBuilder: buildProjectListFilters,
    isFilterDataLoaded: (data: { orgs: any[]; lists: any[] }) => data.orgs?.length > 0 && data.lists?.length > 0,
    initializeData: () => {
      orgService.fetchProponent();
    }
  };
}
