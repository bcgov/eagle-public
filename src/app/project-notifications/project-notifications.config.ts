import { of } from 'rxjs';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { IColumnObject } from 'app/shared/components/table-template/table-object';
import { FilterObject, FilterType, MultiSelectDefinition } from 'app/shared/components/search-filter-template/filter-object';
import { Constants } from 'app/shared/utils/constants';
import { ProjectNotificationsTableRowsComponent } from './project-notifications-table-rows/project-notifications-table-rows.component';

export const PROJECT_NOTIFICATIONS_TABLE_ID = 'notificationProject';

export const PROJECT_NOTIFICATIONS_TABLE_COLUMNS: IColumnObject[] = [
  {
    name: 'Project Notifications',
    value: '',
    width: 'col-12',
    nosort: true
  }
];

export const FILTER_LIST = ['type', 'region', 'pcp', 'decision'];
export const DATE_FILTER_LIST: string[] = [];

/**
 * Builds filters for project notifications list
 */
function buildProjectNotificationsFilters(): FilterObject[] {
  const filterConfigs = [
    { id: 'type', label: 'Project Type', constant: Constants.TEMPORARY_PROJECT_TYPE },
    { id: 'region', label: 'Region', constant: Constants.REGIONS_COLLECTION },
    { id: 'pcp', label: 'Public Comment Period', constant: Constants.PCP_COLLECTION },
    { id: 'decision', label: 'Notification Decision', constant: Constants.PROJECT_NOTIFICATION_DECISIONS }
  ];

  return filterConfigs.map(config => 
    new FilterObject(
      config.id,
      FilterType.MultiSelect,
      config.label,
      new MultiSelectDefinition(config.constant, [], null, null, true),
      4
    )
  );
}

/**
 * Creates the table-list configuration for project notifications
 */
export function createProjectNotificationsConfig(): TableListConfig {
  return {
    tableId: PROJECT_NOTIFICATIONS_TABLE_ID,
    datasetType: 'ProjectNotification',
    defaultSort: '-_id',
    heroBanner: {
      title: 'Project Notifications in British Columbia',
      description: 'Use the list below to navigate Project Notifications. A Project Notification is required if a proposed project meets the notification thresholds in the Reviewable Projects Regulation, indicating that while the project is not automatically reviewable, it may have the potential to cause adverse effects and warrants further review to determine if the project requires an Environmental Assessment.',
      backgroundImage: '/assets/images/hero-banner.jpg',
      actions: [{
        label: 'Learn More',
        icon: 'lightbulb_outline',
        href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/environmental-assessment-process/project-notifications',
        target: '_blank',
        rel: 'noopener',
        title: 'Learn more about Project Notifications'
      }]
    },
    tableColumns: PROJECT_NOTIFICATIONS_TABLE_COLUMNS,
    tableRowComponent: ProjectNotificationsTableRowsComponent,
    filterList: FILTER_LIST,
    dateFilterList: DATE_FILTER_LIST,
    tableOptions: {
      disableRowHighlight: true,
      showHeader: false,
      rowSpacing: 25
    },
    filterDataSource: of({}), // No dynamic filter data needed, using static Constants
    filterBuilder: buildProjectNotificationsFilters,
    isFilterDataLoaded: () => true // Static filters, always loaded
  };
}
