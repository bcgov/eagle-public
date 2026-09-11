import {
  FilterObject,
  FilterType,
  MultiSelectDefinition,
} from 'app/components/filters/filter-object';
import type { TableListConfig } from 'app/components/table/table-list';
import type { IColumnObject } from 'app/components/table/table-object';
import { Constants } from 'app/utils/constants';
import { ProjectNotificationsTableRow } from './project-notifications-table-rows';

export const PROJECT_NOTIFICATIONS_TABLE_ID = 'notificationProject';

export const PROJECT_NOTIFICATIONS_TABLE_COLUMNS: IColumnObject[] = [
  { name: 'Project Notifications', value: '', width: 'col-12', nosort: true },
];

export const FILTER_LIST = ['type', 'region', 'pcp', 'decision'];
export const DATE_FILTER_LIST: string[] = [];

const FILTER_CONFIGS = [
  { id: 'type', label: 'Project Type', options: Constants.TEMPORARY_PROJECT_TYPE },
  { id: 'region', label: 'Region', options: Constants.REGIONS_COLLECTION },
  { id: 'pcp', label: 'Public Comment Period', options: Constants.PCP_COLLECTION },
  {
    id: 'decision',
    label: 'Notification Decision',
    options: Constants.PROJECT_NOTIFICATION_DECISIONS,
  },
];

/** Static filters — every option is a constant, so they never wait on a request. */
export const PROJECT_NOTIFICATIONS_FILTERS: FilterObject[] = FILTER_CONFIGS.map(
  (config) =>
    new FilterObject(
      config.id,
      FilterType.MultiSelect,
      config.label,
      new MultiSelectDefinition(config.options, [], null, null, true),
      4,
    ),
);

export const projectNotificationsConfig: TableListConfig = {
  tableId: PROJECT_NOTIFICATIONS_TABLE_ID,
  datasetType: 'ProjectNotification',
  defaultSort: '-_id',
  heroBanner: {
    title: 'Project Notifications in British Columbia',
    description:
      'Use the list below to navigate Project Notifications. A Project Notification is required if a proposed project meets the notification thresholds in the Reviewable Projects Regulation, indicating that while the project is not automatically reviewable, it may have the potential to cause adverse effects and warrants further review to determine if the project requires an Environmental Assessment.',
    backgroundImage: '/assets/images/hero-banner.jpg',
    actions: [
      {
        label: 'Learn More',
        icon: 'lightbulb_outline',
        href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/environmental-assessment-process/project-notifications',
        target: '_blank',
        rel: 'noopener',
        title: 'Learn more about Project Notifications',
      },
    ],
  },
  tableColumns: PROJECT_NOTIFICATIONS_TABLE_COLUMNS,
  tableRowComponent: ProjectNotificationsTableRow,
  filterList: FILTER_LIST,
  dateFilterList: DATE_FILTER_LIST,
  filters: PROJECT_NOTIFICATIONS_FILTERS,
  tableOptions: {
    disableRowHighlight: true,
    showHeader: false,
  },
};
