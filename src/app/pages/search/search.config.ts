import {
  DateFilterDefinition,
  FilterGroupObject,
  FilterObject,
  FilterType,
  MultiSelectDefinition,
} from 'app/components/filters/filter-object';
import type { TableListConfig } from 'app/components/table/table-list';
import type { IColumnObject } from 'app/components/table/table-object';
import { bulkDownloadEnabled, contentSearchEnabled } from 'app/config/config';
import { DocSearchTableRow } from './search-documents-table-rows';

export const SEARCH_TABLE_ID = 'search';

/**
 * Tabs shared by both search views. Defined here, the base config, so the dependency runs one way:
 * content search imports from this file and nothing imports back.
 */
export const SEARCH_TABS = [
  { label: 'Documents', link: '/search' },
  { label: 'Document Content', link: '/search/content' },
];

export const CONTENT_SEARCH_LINK = '/search/content';

/** The tabs to render. The content tab is gated on the CONTENT_SEARCH runtime config flag. */
export function visibleSearchTabs(
  isContentSearchEnabled: boolean,
): { label: string; link: string }[] {
  // One tab is no tab bar: with content search off there is nothing to switch between.
  return isContentSearchEnabled ? SEARCH_TABS : [];
}

export const SEARCH_TABLE_COLUMNS: IColumnObject[] = [
  { name: 'Document Name', value: 'displayName', width: 'col-4' },
  { name: 'Project', value: 'project.name', width: 'col-2' },
  { name: 'Date', value: 'datePosted', width: 'col-2' },
  { name: 'Type', value: 'type', width: 'col-2' },
  { name: 'Milestone', value: 'milestone', width: 'col-2' },
];

export const SEARCH_FILTER_LIST = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
export const SEARCH_DATE_FILTER_LIST = ['datePostedStart', 'datePostedEnd'];

const LEGISLATION_FILTER_GROUP = new FilterGroupObject('legislation', '', ' Act Terms');

const MULTI_SELECT_FILTERS = [
  { id: 'milestone', label: 'Milestone', listType: 'label' },
  { id: 'documentAuthorType', label: 'Document Author', listType: 'author' },
  { id: 'type', label: 'Document Type', listType: 'doctype' },
  { id: 'projectPhase', label: 'Project Phase', listType: 'projectPhase' },
];

/** Builds filters for document search from the `List` collection, grouped by legislation year. */
export function buildSearchFilters(lists: any[]): FilterObject[] {
  const docDateFilter = new FilterObject(
    'issuedDate',
    FilterType.DateRange,
    '',
    new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
    8,
  );

  return [
    docDateFilter,
    ...MULTI_SELECT_FILTERS.map(
      (filter) =>
        new FilterObject(
          filter.id,
          FilterType.MultiSelect,
          filter.label,
          new MultiSelectDefinition(
            lists.filter((item) => item.type === filter.listType),
            [],
            LEGISLATION_FILTER_GROUP,
            null,
            true,
          ),
          4,
        ),
    ),
  ];
}

/** Table-list configuration for document metadata search. */
export function createSearchConfig(filters: FilterObject[], lists: any[]): TableListConfig {
  return {
    tableId: SEARCH_TABLE_ID,
    datasetType: 'Document',
    defaultSort: '-datePosted',
    heroBanner: {
      title: 'Search All Documents',
      description:
        'Search through all documents from the Environmental Assessment Office. Click on a project name to view the project details page, or click the download button to download a document.',
      actions: [
        {
          label: 'List of Projects',
          icon: 'list',
          routerLink: '/projects-list',
          title: 'List of Projects',
        },
      ],
    },
    tableColumns: SEARCH_TABLE_COLUMNS,
    tableRowComponent: DocSearchTableRow,
    tableOptions: { disableRowHighlight: true, selectable: bulkDownloadEnabled() },
    tabs: visibleSearchTabs(contentSearchEnabled()),
    filterList: SEARCH_FILTER_LIST,
    dateFilterList: SEARCH_DATE_FILTER_LIST,
    filters,
    rowData: { lists },
  };
}
