import type { GridColumn } from 'app/components/display-grid/types';
import { Constants } from 'app/utils/constants';
import { NotificationRow } from './notification-row';
import {
  RECORD_DATASETS,
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
} from './record-type';

/** What the `/project-notifications` table asked for: newest record first, by insertion order. */
export const NOTIFICATIONS_SORT = '-_id';

/** The notification's own page. `/p/:id` lands on the project the notification became. */
function projectHref(row: Record<string, unknown>): string | undefined {
  const id = row['associatedProjectId'];
  return typeof id === 'string' && id !== '' ? `/p/${id}` : undefined;
}

/**
 * A notification renders as one card, so these are its filterable fields rather than a layout.
 * A headerless grid has no filter row, so every one of them reaches the reader through the panel.
 */
const COLUMNS: GridColumn<Record<string, unknown>>[] = [
  { key: 'name', label: 'Project notification', link: true, href: projectHref, locked: true },
  { key: 'type', label: 'Project type', filter: 'values', filterId: 'type' },
  { key: 'region', label: 'Region', filter: 'values', filterId: 'region' },
  { key: 'pcp', label: 'Public comment period', filter: 'values', filterId: 'pcp' },
  { key: 'decision', label: 'Notification decision', filter: 'values', filterId: 'decision' },
];

/** Project notifications: the records the `/project-notifications` page listed. */
export const notificationsConfig: RecordTypeConfig = {
  id: 'notifications',
  label: 'Project notifications',
  noun: 'notifications',
  dataset: RECORD_DATASETS.notifications,
  defaultSort: NOTIFICATIONS_SORT,
  template: 'list',
  columns: COLUMNS,
  advancedFields: [],
  // Every option is a constant, so these filters never wait on a request.
  optionsFrom: () => ({
    type: toOptions(Constants.TEMPORARY_PROJECT_TYPE as OptionSource[]),
    region: toOptions(Constants.REGIONS_COLLECTION as OptionSource[]),
    pcp: toOptions(Constants.PCP_COLLECTION as OptionSource[]),
    decision: toOptions(Constants.PROJECT_NOTIFICATION_DECISIONS as OptionSource[]),
  }),
  selectable: false,
  headerless: true,
  rowComponent: NotificationRow,
};
