import type { TableListConfig } from 'app/components/table/table-list';
import type { IColumnObject } from 'app/components/table/table-object';
import { NewsRow } from './news-row';

const NEWS_TABLE_ID = 'news';

const NEWS_TABLE_COLUMNS: IColumnObject[] = [
  { name: 'Headline', value: 'headline', width: 'col-10', nosort: true },
  { name: 'Date', value: 'dateAdded', width: 'col-2', nosort: false },
];

export const newsConfig: TableListConfig = {
  tableId: NEWS_TABLE_ID,
  datasetType: 'RecentActivity',
  // The shared default is the document field; activities are dated with dateAdded.
  defaultSort: '-dateAdded',
  heroBanner: {
    title: 'Activities & Updates',
    description:
      'Find activities and updates for environmental assessment projects in British Columbia. Click on the project info button to view the project details page.',
    backgroundImage: '/assets/images/hero-banner.jpg',
  },
  tableColumns: NEWS_TABLE_COLUMNS,
  tableRowComponent: NewsRow,
  filterList: [],
  dateFilterList: [],
  filters: [],
  advancedFilters: false,
  emptyMessage: 'No activities found',
  tableOptions: { disableRowHighlight: true },
};
