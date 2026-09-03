import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { track } from 'app/analytics/analytics';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import type { SearchPackage } from 'app/components/filters/filter-object';
import { TableTemplate } from 'app/components/table/table-template';
import {
  tableObject,
  type IColumnObject,
  type ITableMessage,
} from 'app/components/table/table-object';
import {
  getFiltersFromParams,
  getFiltersFromSearchPackage,
  paramsToObject,
  toggleSortDirection,
  toSearchParams,
  updateTableObjectWithUrlParams,
  type Params,
} from 'app/components/table/table-params';
import { tableSearchParams, useTable, type TableQueryConfig } from 'app/components/table/use-table';
import { bulkDownloadEnabled } from 'app/config/config';
import { selectAllMatching } from 'app/state/bulk-download';
import { createProjectTabModifiers } from 'app/utils/utils';
import { DocumentTableRow } from './document-table-rows';
import { buildDocumentFilters, DATE_FILTER_LIST, filterListFrom } from './document-filters';
import { useProjectContext } from './project-context';

const FEATURED_COLUMN: IColumnObject = { name: '★', value: 'isFeatured', width: 'col-1' };

const DOCUMENT_COLUMNS: IColumnObject[] = [
  { name: 'Date', value: 'datePosted', width: 'col-2' },
  { name: 'Type', value: 'type', width: 'col-2' },
  { name: 'Milestone', value: 'milestone', width: 'col-2' },
  { name: 'Phase', value: 'projectPhase', width: 'col-2' },
];

interface ProjectDocumentTabProps {
  tableId: string;
  emptyMessage: string;
  /** Renders the featured-star column, and asks the API to populate related records. */
  showFeatured?: boolean;
  /**
   * `Constants.optionalProjectDocTabs` key. Set for the Application / Certificate / Amendment
   * tabs, which select documents by type and milestone; the main Documents tab lists them all.
   */
  tabKey?: string;
  /** Advanced filter ids mapped to their panel widths. Omitted means no filter panel at all. */
  panelSizes?: Record<string, number>;
  /** Groups multi-select options by the legislation year they belong to. */
  groupedFilters?: boolean;
  /** Reports filter use to analytics. Only the main Documents tab does. */
  trackFilters?: boolean;
}

/** Counts by filter, for the Document Filters Applied analytics event. */
function countFilters(queryFilters: Params): Record<string, number | boolean> {
  const count = (value: any) => (value == null ? 0 : Array.isArray(value) ? value.length : 1);
  const counts = {
    milestone: count(queryFilters['milestone']),
    type: count(queryFilters['type']),
    documentAuthorType: count(queryFilters['documentAuthorType']),
    projectPhase: count(queryFilters['projectPhase']),
    hasDateRange: !!(queryFilters['datePostedStart'] || queryFilters['datePostedEnd']),
  };
  return {
    ...counts,
    total:
      counts.milestone +
      counts.type +
      counts.documentAuthorType +
      counts.projectPhase +
      (counts.hasDateRange ? 1 : 0),
  };
}

/**
 * The document table shared by the Documents, Application, Certificate and Amendment tabs. They
 * differ only in which documents they select, whether they offer filters, and their empty message.
 */
export function ProjectDocumentTab({
  tableId,
  emptyMessage,
  showFeatured = false,
  tabKey,
  panelSizes,
  groupedFilters = false,
  trackFilters = false,
}: ProjectDocumentTabProps) {
  const { projId, lists } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const filterList = useMemo(() => (panelSizes ? filterListFrom(panelSizes) : []), [panelSizes]);
  const filters = useMemo(
    () => (panelSizes ? buildDocumentFilters(lists, panelSizes, groupedFilters) : []),
    [lists, panelSizes, groupedFilters],
  );

  const base = useMemo(
    () =>
      updateTableObjectWithUrlParams(params, tableObject({ tableId, component: DocumentTableRow })),
    [params, tableId],
  );

  const activeFilters = useMemo(
    () => (panelSizes ? getFiltersFromParams(params, [...filterList, ...DATE_FILTER_LIST]) : {}),
    [params, panelSizes, filterList],
  );

  const queryModifiers = useMemo(
    () => (tabKey ? createProjectTabModifiers(tabKey, lists) : { project: projId }),
    [tabKey, lists, projId],
  );

  const query: TableQueryConfig = {
    dataset: 'Document',
    // The optional tabs identify their documents through query modifiers built from the lists, so
    // they cannot run until those have loaded.
    enabled: !!projId && (!tabKey || lists.length > 0),
    keywords: panelSizes ? params['keywords'] || '' : '',
    fields: tabKey ? [{ name: 'project', value: projId }] : [],
    currentPage: base.currentPage,
    pageSize: base.pageSize,
    sortBy: base.sortBy,
    queryModifiers,
    populate: !tabKey,
    secondarySort: base.sortBy.includes('displayName') ? '' : '+displayName',
    filters: activeFilters,
  };

  const result = useTable(tableId, query);

  const data = {
    ...base,
    columns: showFeatured
      ? [
          FEATURED_COLUMN,
          { name: 'Name', value: 'displayName', width: 'col-3' },
          ...DOCUMENT_COLUMNS,
        ]
      : [{ name: 'Name', value: 'displayName', width: 'col-4' }, ...DOCUMENT_COLUMNS],
    items: result.data.map((record) => ({ rowData: record })),
    totalListItems: result.totalListItems,
    options: { ...base.options, showAllPicker: true, selectable: bulkDownloadEnabled() },
    data: { lists, showFeatured },
  };

  function submit(next: Params): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  function executeSearch(searchPackage: SearchPackage): void {
    const queryFilters = getFiltersFromSearchPackage(searchPackage, filterList, DATE_FILTER_LIST);
    if (trackFilters) {
      track('Document Filters Applied', {
        project_id: projId,
        ...countFilters(queryFilters),
        has_keyword: !!searchPackage.keywords,
        keyword_length: searchPackage.keywords?.length || 0,
      });
    }
    const hasKeywords = searchPackage.keywords?.trim();
    submit({
      ...params,
      pageSize: params['pageSize'],
      currentPage: 1,
      keywords: hasKeywords || null,
      sortBy: hasKeywords
        ? searchPackage.keywordsChanged
          ? '-score'
          : params['sortBy'] || '-datePosted'
        : '-datePosted',
      ...queryFilters,
    });
  }

  function onMessage(msg: ITableMessage): void {
    switch (msg.label) {
      case 'columnSort':
        submit({ ...params, sortBy: toggleSortDirection(base.sortBy, msg.data), currentPage: 1 });
        break;
      case 'pageNum':
        submit({ ...params, currentPage: msg.data });
        break;
      case 'pageSize':
        submit({ ...params, pageSize: msg.data.value, currentPage: 1 });
        break;
      case 'selectAllMatching':
        void selectAllMatching(tableId, tableSearchParams(tableId, query));
        break;
    }
  }

  return (
    <>
      {panelSizes && (
        <section>
          <SearchFilterTemplate
            onSearch={executeSearch}
            advancedFilters
            showAdvancedFilters={[...filterList, ...DATE_FILTER_LIST].some((key) => params[key])}
            searchOnFilterChange
            filters={filters}
            searchHelpLink="/search-help"
            searching={result.loading}
            onToggleFiltersPanel={
              trackFilters
                ? ({ showPanel }) =>
                    track('Document Filters Panel Toggled', {
                      project_id: projId,
                      is_open: showPanel,
                    })
                : undefined
            }
          />
        </section>
      )}

      {!result.loading && data.totalListItems === 0 ? (
        <div>{emptyMessage}</div>
      ) : (
        <TableTemplate data={data} loading={result.loading} onMessage={onMessage} />
      )}
    </>
  );
}
