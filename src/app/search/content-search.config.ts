import { inject } from '@angular/core';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { IColumnObject } from 'app/shared/components/table-template/table-object';
import { ContentSearchTableRowsComponent } from './search-content-table-rows/search-content-table-rows.component';
import { ConfigService } from 'app/services/config.service';
import { buildSearchFilters, SEARCH_DATE_FILTER_LIST, SEARCH_TABS } from './search.config';

export const CONTENT_SEARCH_TABLE_ID = 'search-content';

/**
 * One full-width column, and the header is switched off below — the rows render result CARDS, not
 * cells. The table element is kept only for the pagination, filter and loading-state plumbing that
 * `table-list` already provides.
 *
 * No sortable columns, on purpose. Relevance is the only meaningful order for a content search:
 * sorting by document name would replace BM25's ranking with an alphabetical one, and the fields
 * that could be sorted (`documentName`, `pageNumber`) describe a passage rather than the document
 * a result now represents.
 */
export const CONTENT_SEARCH_TABLE_COLUMNS: IColumnObject[] = [
  {
    name: 'Results',
    value: '',
    width: 'col-12',
    nosort: true
  },
];

/**
 * The chunk index carries `documentTypeId` and `milestoneId`, so those two filters work as they do
 * on the Documents tab. Document Author and Project Phase are NOT on a chunk — offering them would
 * render controls whose selections the service drops on the floor.
 */
const CONTENT_FILTER_IDS = ['milestone', 'type', 'issuedDate'];
export const CONTENT_SEARCH_FILTER_LIST = ['milestone', 'type'];

/**
 * Creates the table-list configuration for document content search.
 *
 * `defaultSort` is `-score`: this is a relevance search over 1.13M chunks, and any real sort field
 * would replace the ranking with an alphabetical or chronological order. eagle-search reads `-score`
 * as "issue no $orderby", which is what leaves BM25's own order in place.
 */
export function createContentSearchConfig(): TableListConfig {
  const configService = inject(ConfigService);

  return {
    tableId: CONTENT_SEARCH_TABLE_ID,
    datasetType: 'DocumentChunk',
    defaultSort: '-score',
    heroBanner: {
      title: 'Search Inside Documents',
      description: 'Search the text inside documents from the Environmental Assessment Office, not just their titles. Results show the page the match was found on and the surrounding text.',
      actions: [{
        label: 'List of Projects',
        icon: 'list',
        routerLink: '/projects-list',
        title: 'List of Projects'
      }]
    },
    tableColumns: CONTENT_SEARCH_TABLE_COLUMNS,
    tableRowComponent: ContentSearchTableRowsComponent,
    tableOptions: {
      disableRowHighlight: true,
      // The rows are cards; a column header above them would describe nothing.
      showHeader: false
    },
    tabs: SEARCH_TABS,
    filterList: CONTENT_SEARCH_FILTER_LIST,
    dateFilterList: SEARCH_DATE_FILTER_LIST,
    filterDataSource: configService.lists,
    filterBuilder: (lists: any[]) => buildSearchFilters(lists).filter(f => CONTENT_FILTER_IDS.includes(f.id)),
    isFilterDataLoaded: (lists: any[]) => lists?.length > 0
  };
}
