import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { track } from 'app/analytics/analytics';
import { DisplayGrid } from 'app/components/display-grid/display-grid';
import { sortStateOf } from 'app/components/display-grid/grid-helpers';
import { GridToolbar } from 'app/components/display-grid/grid-toolbar';
import type { ListRowField } from 'app/components/display-grid/list-row';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import type { SearchPackage } from 'app/components/filters/filter-object';
import { toggleRow } from 'app/components/table/document-row';
import { tableObject } from 'app/components/table/table-object';
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
import { usePageSelection } from 'app/components/table/use-page-selection';
import { bulkDownloadEnabled } from 'app/config/config';
import {
  clearSelection,
  MAX_JOBS_IN_FLIGHT,
  selectAllMatching,
  startDownload,
  useDownloadInProgress,
  useSelection,
} from 'app/state/bulk-download';
import { createProjectTabModifiers } from 'app/utils/utils';
import { documentColumns, type DocumentRow } from './document-columns';
import { buildDocumentFilters, DATE_FILTER_LIST, filterListFrom } from './document-filters';
import { useProjectContext } from './project-context';

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
 * The document grid shared by the Documents, Application, Certificate and Amendment tabs. They
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

  // The paging, sort and page size the URL carries, with this table's defaults behind them.
  const base = useMemo(
    () => updateTableObjectWithUrlParams(params, tableObject({ tableId })),
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

  const query: TableQueryConfig = useMemo(
    () => ({
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
    }),
    [projId, tabKey, lists, panelSizes, params, base, queryModifiers, activeFilters],
  );

  const result = useTable(tableId, query);
  // An optional tab's query waits on the lists; until then it is pending, not empty.
  const pending = result.loading || (!!tabKey && lists.length === 0);
  const rows: DocumentRow[] = result.data;

  const columns = useMemo(() => documentColumns(lists, showFeatured), [lists, showFeatured]);

  // The selection helpers read the page off a table object, which is also what select-all reruns.
  const data = useMemo(
    () => ({
      ...base,
      items: rows.map((rowData) => ({ rowData })),
      totalListItems: result.totalListItems,
      options: { ...base.options, selectable: bulkDownloadEnabled() },
    }),
    [base, rows, result.totalListItems],
  );

  const {
    selectable,
    selectedCount,
    selectedSizeText,
    showSelectAll,
    selectAllText,
    selectAllLabel,
    selectAllTitle,
    toggleAllOnPage,
  } = usePageSelection(data);
  const selection = useSelection(tableId);
  const selectedIds = useMemo(() => [...selection.keys()], [selection]);
  const downloadInProgress = useDownloadInProgress();

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

  /** The card has room for what no column carries; the star has no cell of its own there. */
  function narrowExtras(row: DocumentRow): ListRowField[] {
    return showFeatured && row.isFeatured === true ? [{ label: 'Featured', value: 'Yes' }] : [];
  }

  return (
    <>
      {panelSizes && (
        <section>
          <SearchFilterTemplate
            onSearch={executeSearch}
            advancedFilters
            filterToggle="filters"
            showAdvancedFilters={[...filterList, ...DATE_FILTER_LIST].some((key) => params[key])}
            searchOnFilterChange
            filters={filters}
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

      <DisplayGrid<DocumentRow>
        caption="Project documents"
        columns={columns}
        rows={rows}
        loading={pending}
        emptyMessage={emptyMessage}
        selectable={selectable}
        sort={sortStateOf(base.sortBy)}
        onSort={(key, dir) =>
          submit({
            ...params,
            sortBy: dir ? `${dir}${key}` : toggleSortDirection(base.sortBy, key),
            currentPage: 1,
          })
        }
        narrowExtras={narrowExtras}
        page={base.currentPage}
        pageSize={base.pageSize}
        total={result.totalListItems}
        onPageChange={(page) => submit({ ...params, currentPage: page })}
        onPageSizeChange={(pageSize) => submit({ ...params, pageSize, currentPage: 1 })}
        rowId={(row) => row._id}
        rowLabel={(row) => row.displayName ?? row._id}
        selectedIds={selectedIds}
        onToggleRow={(row) => toggleRow(tableId, row)}
        onToggleAllOnPage={() => toggleAllOnPage()}
        toolbar={
          <GridToolbar<DocumentRow>
            noun="documents"
            page={base.currentPage}
            pageSize={base.pageSize}
            total={result.totalListItems}
            loading={pending}
            narrowed={!!params['keywords'] || Object.keys(activeFilters).length > 0}
            selectedCount={selectable ? selectedCount : 0}
            onClearSelection={() => clearSelection()}
            onDownload={() => void startDownload()}
            downloadDisabled={downloadInProgress}
            downloadTitle={
              downloadInProgress
                ? `${MAX_JOBS_IN_FLIGHT} downloads are already in progress. Wait for one to finish.`
                : undefined
            }
            /* The size the reader decides on, so it goes on the button they decide with. */
            downloadLabel={`Download ${selectedCount.toLocaleString()}${
              selectedSizeText ? ` (${selectedSizeText})` : ''
            }`}
            selectAll={
              showSelectAll
                ? {
                    text: selectAllText,
                    label: selectAllLabel,
                    title: selectAllTitle,
                    onSelect: () =>
                      void selectAllMatching(tableId, tableSearchParams(tableId, query)),
                  }
                : undefined
            }
          />
        }
      />
    </>
  );
}
