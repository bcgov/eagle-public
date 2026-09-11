import {
  DateFilterDefinition,
  FilterObject,
  FilterType,
  MultiSelectDefinition,
} from 'app/components/filters/filter-object';
import type { TableListConfig } from 'app/components/table/table-list';
import { ProjectListTableRow } from './project-list-table-rows';
import {
  DATE_FILTER_LIST,
  FILTER_CONFIGS,
  FILTER_LIST,
  PROJECT_LIST_TABLE_COLUMNS,
  PROJECT_LIST_TABLE_ID,
  type FilterConfig,
} from './project-list.constants';

/** Builds one FilterObject, filling multi-select options from the lists and proponent orgs. */
function createFilter(config: FilterConfig, dynamicOptions: Record<string, any[]>): FilterObject {
  if (config.type === FilterType.DateRange && config.dateConfig) {
    return new FilterObject(
      config.id,
      config.type,
      config.label,
      new DateFilterDefinition(
        config.dateConfig.startId,
        config.dateConfig.startLabel,
        config.dateConfig.endId,
        config.dateConfig.endLabel,
        new Date('1900-01-01'),
        new Date(),
      ),
      config.panelSize ?? null,
    );
  }

  const options = dynamicOptions[config.id] ?? config.options ?? [];
  return new FilterObject(
    config.id,
    config.type,
    config.label,
    new MultiSelectDefinition(options, [], null, null, config.matchId ?? false),
    config.panelSize ?? null,
  );
}

/** Groups the `List` collection items the project filters draw their options from. */
export function buildProjectListFilters(orgs: any[], lists: any[]): FilterObject[] {
  const dynamicOptions: Record<string, any[]> = {
    eacDecision: lists.filter((item) => item.type === 'eaDecisions'),
    CEAAInvolvement: lists.filter((item) => item.type === 'ceaaInvolvements'),
    currentPhaseName: lists.filter((item) => item.type === 'projectPhase'),
    proponent: orgs,
  };

  return FILTER_CONFIGS.map((config) => createFilter(config, dynamicOptions));
}

export function createProjectListConfig(filters: FilterObject[]): TableListConfig {
  return {
    tableId: PROJECT_LIST_TABLE_ID,
    datasetType: 'Project',
    defaultSort: '+name',
    heroBanner: {
      title: 'Search Environmental Assessment Projects',
      description:
        'Search and filter all environmental assessment projects in British Columbia. Click on a project row to view its details page.',
      backgroundImage: '/assets/images/hero-banner.jpg',
      actions: [
        {
          label: 'Search All Documents',
          icon: 'search',
          routerLink: '/search',
          title: 'Search All Documents',
        },
      ],
    },
    tableColumns: PROJECT_LIST_TABLE_COLUMNS,
    tableRowComponent: ProjectListTableRow,
    filterList: FILTER_LIST,
    dateFilterList: DATE_FILTER_LIST,
    filters,
  };
}
