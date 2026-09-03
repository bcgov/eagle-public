import type { FilterObject } from 'app/components/filters/filter-object';
import type { TableListConfig } from 'app/components/table/table-list';
import type { IColumnObject } from 'app/components/table/table-object';
import { bulkDownloadEnabled, contentSearchEnabled } from 'app/config/config';
import {
  buildDocumentFilters,
  DATE_FILTER_LIST,
  filterListFrom,
} from 'app/pages/project/document-filters';
import { DocSearchTableRow } from './search-documents-table-rows';

const SEARCH_TABLE_ID = 'search';

/**
 * Tabs shared by both search views. Defined here, the base config, so the dependency runs one way:
 * content search imports from this file and nothing imports back.
 */
export const SEARCH_TABS = [
  { label: 'Documents', link: '/search' },
  { label: 'Document Content', link: '/search/content' },
];

/** The tabs to render. The content tab is gated on the CONTENT_SEARCH runtime config flag. */
export function visibleSearchTabs(
  isContentSearchEnabled: boolean,
): { label: string; link: string }[] {
  // One tab is no tab bar: with content search off there is nothing to switch between.
  return isContentSearchEnabled ? SEARCH_TABS : [];
}

const SEARCH_TABLE_COLUMNS: IColumnObject[] = [
  { name: 'Document Name', value: 'displayName', width: 'col-4' },
  { name: 'Project', value: 'project.name', width: 'col-2' },
  { name: 'Date', value: 'datePosted', width: 'col-2' },
  { name: 'Type', value: 'type', width: 'col-2' },
  { name: 'Milestone', value: 'milestone', width: 'col-2' },
];

/** The filters search renders, in order, mapped to their column widths. */
const SEARCH_PANEL_SIZES = {
  issuedDate: 8,
  milestone: 4,
  documentAuthorType: 4,
  type: 4,
  projectPhase: 4,
};

/** Builds filters for document search from the `List` collection, grouped by legislation year. */
export function buildSearchFilters(lists: any[]): FilterObject[] {
  return buildDocumentFilters(lists, SEARCH_PANEL_SIZES, true);
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
    filterList: filterListFrom(SEARCH_PANEL_SIZES),
    dateFilterList: DATE_FILTER_LIST,
    filters,
    rowData: { lists },
  };
}
