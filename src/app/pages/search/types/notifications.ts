import type { GridColumn } from 'app/components/display-grid/types';
import { Constants } from 'app/utils/constants';
import { proponentName } from './projects';
import {
  RECORD_DATASETS,
  toOptions,
  type OptionSource,
  type RecordTypeConfig,
} from './record-type';

type Row = Record<string, unknown>;

/** Newest received first, on a sortable column so the Received heading shows the order. */
export const NOTIFICATIONS_SORT = '-notificationReceivedDate';

/** The project a notification became when it has one, else the notification's own page. */
function notificationHref(row: Row): string | undefined {
  const associatedProjectId = String(row['associatedProjectId'] ?? '');
  if (associatedProjectId) return `/p/${associatedProjectId}`;
  const id = String(row['_id'] ?? '');
  return id ? `/pn/${id}` : undefined;
}

const COLUMNS: GridColumn<Row>[] = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    link: true,
    href: notificationHref,
    locked: true,
    width: '26%',
  },
  { key: 'type', label: 'Type', filter: 'values', filterId: 'type', width: '16%' },
  { key: 'region', label: 'Region', filter: 'values', filterId: 'region', width: '11%' },
  { key: 'proponent', label: 'Proponent', render: proponentName, width: '19%' },
  { key: 'decision', label: 'Decision', filter: 'values', filterId: 'decision', width: '14%' },
  {
    key: 'notificationReceivedDate',
    label: 'Received',
    sortable: true,
    date: true,
    primaryDate: true,
    width: '14%',
  },
];

/** Project notifications: the records the `/project-notifications` page listed. */
export const notificationsConfig: RecordTypeConfig = {
  id: 'notifications',
  label: 'Project notifications',
  noun: 'notifications',
  dataset: RECORD_DATASETS.notifications,
  defaultSort: NOTIFICATIONS_SORT,
  template: 'grid',
  columns: COLUMNS,
  // The comment period has no column, so its filter lives in the panel.
  advancedFields: [{ id: 'pcp', label: 'Public comment period', kind: 'select' }],
  // Every option is a constant, so these filters never wait on a request.
  optionsFrom: () => ({
    type: toOptions(Constants.TEMPORARY_PROJECT_TYPE as OptionSource[]),
    region: toOptions(Constants.REGIONS_COLLECTION as OptionSource[]),
    pcp: toOptions(Constants.PCP_COLLECTION as OptionSource[]),
    decision: toOptions(Constants.PROJECT_NOTIFICATION_DECISIONS as OptionSource[]),
  }),
  selectable: false,
  headerless: false,
};
