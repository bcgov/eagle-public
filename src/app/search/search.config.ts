import { inject } from '@angular/core';
import { TableListConfig } from 'app/shared/components/table-list/table-list-config.interface';
import { IColumnObject } from 'app/shared/components/table-template/table-object';
import { DocSearchTableRowsComponent } from './search-documents-table-rows/search-document-table-rows.component';
import { ConfigService } from 'app/services/config.service';
import { FilterObject, FilterType, MultiSelectDefinition, DateFilterDefinition } from 'app/shared/components/search-filter-template/filter-object';

export const SEARCH_TABLE_ID = 'search';

/**
 * Tabs shared by both search views. Defined here, the base config, so the dependency runs one way:
 * the content config imports from this file and nothing imports back.
 */
export const SEARCH_TABS = [
  { label: 'Documents', link: '/search' }
  // 'Document Content' (/search/content) is HIDDEN, not removed. The route and its component are
  // still there and still work if you type the URL — only the way in is gone, because content
  // search is not ready to be shown to the public. Restore by putting the entry back here:
  //   { label: 'Document Content', link: '/search/content' }
  // and re-adding `tabs: SEARCH_TABS` to the config below. With one tab left, the strip renders as
  // a lone tab, which is why the Documents view drops it entirely.
];

export const SEARCH_TABLE_COLUMNS: IColumnObject[] = [
  {
    name: 'Document Name',
    value: 'displayName',
    width: 'col-3'
  },
  {
    name: 'Project',
    value: 'project.name',
    width: 'col-2'
  },
  {
    name: 'Date',
    value: 'datePosted',
    width: 'col-2'
  },
  {
    name: 'Type',
    value: 'type',
    width: 'col-2'
  },
  {
    name: 'Milestone',
    value: 'milestone',
    width: 'col-2'
  },
  {
    name: '\u00A0',
    value: '',
    width: 'col-1',
    nosort: true,
  },
];

export const SEARCH_FILTER_LIST = ['milestone', 'documentAuthorType', 'type', 'projectPhase'];
export const SEARCH_DATE_FILTER_LIST = ['datePostedStart', 'datePostedEnd'];

const LEGISLATION_FILTER_GROUP = {
  name: 'legislation',
  labelPrefix: '',
  labelPostfix: ' Act Terms'
};

/**
 * Builds filters for document search from config data
 *
 * Exported so the content tab can take the subset the chunk index supports, rather than
 * reimplementing the same five FilterObjects against the same lists.
 */
export function buildSearchFilters(lists: any[]): FilterObject[] {
  const milestones: any[] = [];
  const authors: any[] = [];
  const docTypes: any[] = [];
  const phases: any[] = [];

  lists.forEach((item: any) => {
    if (item.type === 'label') {
      milestones.push({ ...item });
    } else if (item.type === 'author') {
      authors.push({ ...item });
    } else if (item.type === 'doctype') {
      docTypes.push({ ...item });
    } else if (item.type === 'projectPhase') {
      phases.push({ ...item });
    }
  });

  const docDateFilter = new FilterObject(
    'issuedDate',
    FilterType.DateRange,
    '',
    new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
    8
  );

  const milestoneFilter = new FilterObject(
    'milestone',
    FilterType.MultiSelect,
    'Milestone',
    new MultiSelectDefinition(
      milestones,
      [],
      LEGISLATION_FILTER_GROUP,
      null,
      true
    ),
    4
  );

  const documentAuthorTypeFilter = new FilterObject(
    'documentAuthorType',
    FilterType.MultiSelect,
    'Document Author',
    new MultiSelectDefinition(
      authors,
      [],
      LEGISLATION_FILTER_GROUP,
      null,
      true
    ),
    4
  );

  const documentTypeFilter = new FilterObject(
    'type',
    FilterType.MultiSelect,
    'Document Type',
    new MultiSelectDefinition(
      docTypes,
      [],
      LEGISLATION_FILTER_GROUP,
      null,
      true
    ),
    4
  );

  const projectPhaseFilter = new FilterObject(
    'projectPhase',
    FilterType.MultiSelect,
    'Project Phase',
    new MultiSelectDefinition(
      phases,
      [],
      LEGISLATION_FILTER_GROUP,
      null,
      true
    ),
    4
  );

  return [
    docDateFilter,
    milestoneFilter,
    documentAuthorTypeFilter,
    documentTypeFilter,
    projectPhaseFilter
  ];
}

/**
 * Creates the table-list configuration for document search
 */
export function createSearchConfig(): TableListConfig {
  const configService = inject(ConfigService);

  return {
    tableId: SEARCH_TABLE_ID,
    datasetType: 'Document',
    defaultSort: '-datePosted',
    heroBanner: {
      title: 'Search All Documents',
      description: 'Search through all documents from the Environmental Assessment Office. Click on a project name to view the project details page, or click the download button to download a document.',
      actions: [{
        label: 'List of Projects',
        icon: 'list',
        routerLink: '/projects-list',
        title: 'List of Projects'
      }]
    },
    tableColumns: SEARCH_TABLE_COLUMNS,
    tableRowComponent: DocSearchTableRowsComponent,
    tableOptions: {
      disableRowHighlight: true
    },
    // No `tabs` while Document Content is hidden — `tabs?` is optional on the config
    // (table-list-config.interface.ts:62) and table-list.component.html:9 skips the whole strip
    // when it is absent.
    filterList: SEARCH_FILTER_LIST,
    dateFilterList: SEARCH_DATE_FILTER_LIST,
    filterDataSource: configService.lists,
    filterBuilder: buildSearchFilters,
    isFilterDataLoaded: (lists: any[]) => lists?.length > 0
  };
}
