import { useMemo } from 'react';
import { NavLink, useSearchParams } from 'react-router';
import { HeroBanner, type HeroBannerAction } from 'app/components/hero-banner';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import type { FilterObject, SearchPackage } from 'app/components/filters/filter-object';
import { TableTemplate } from './table-template';
import { tableObject, type IColumnObject, type ITableMessage, type ITableOptions, type TableRowComponent } from './table-object';
import {
  getFiltersFromParams,
  getFiltersFromSearchPackage,
  normalizeSortBy,
  paramsToObject,
  toggleSortDirection,
  toSearchParams,
  updateTableObjectWithUrlParams,
  type Params
} from './table-params';
import { useTable } from './use-table';

export interface TableListConfig {
  /** Identifies the table's cache entry and loading state. */
  tableId: string;
  datasetType: 'Project' | 'Document' | 'DocumentChunk' | 'ProjectNotification';
  /** Sort applied when the URL names none, e.g. `+name`. */
  defaultSort: string;
  heroBanner: {
    title: string;
    description: string;
    actions?: HeroBannerAction[];
    backgroundImage?: string;
  };
  tableColumns: IColumnObject[];
  tableRowComponent: TableRowComponent;
  /** Non-date filter param names, in URL and request order. */
  filterList: string[];
  dateFilterList: string[];
  /** Filter definitions. May start empty while their options are still loading. */
  filters: FilterObject[];
  /** Extra data handed to every row as `tableData.data`. */
  rowData?: any;
  tableOptions?: Partial<ITableOptions>;
  /**
   * Sibling views as tabs under the hero banner, between the banner and the filters. The active
   * tab is matched exactly, so a parent path is not highlighted while a child is open.
   */
  tabs?: { label: string; link: string }[];
}

/** Config-driven list page: hero banner, optional tabs, filter bar and table, synced to the URL. */
export function TableList({ config }: { config: TableListConfig }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const allFilterKeys = useMemo(
    () => [...config.filterList, ...config.dateFilterList],
    [config.filterList, config.dateFilterList]
  );
  const filters = useMemo(() => getFiltersFromParams(params, allFilterKeys), [params, allFilterKeys]);
  const sortBy = params['sortBy'] ? normalizeSortBy(params['sortBy']) : config.defaultSort;

  const table = useTable(config.tableId, {
    dataset: config.datasetType,
    keywords: params['keywords'] || '',
    currentPage: +(params['currentPage'] || 1),
    pageSize: +(params['pageSize'] || 10),
    sortBy,
    populate: true,
    filters
  });

  const data = useMemo(() => {
    const base = updateTableObjectWithUrlParams(
      params,
      tableObject({ component: config.tableRowComponent, sortBy: config.defaultSort })
    );
    return {
      ...base,
      columns: config.tableColumns,
      items: table.data.map(record => ({ rowData: record })),
      totalListItems: table.totalListItems,
      options: { ...base.options, showAllPicker: true, ...config.tableOptions },
      data: config.rowData ?? null
    };
  }, [config, params, table.data, table.totalListItems]);

  function submit(next: Params): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  function executeSearch(searchPackage: SearchPackage): void {
    const hasKeywords = searchPackage.keywords?.trim();
    submit({
      // Page size is the user's choice, not part of the search; Angular dropped it here.
      pageSize: params['pageSize'],
      currentPage: 1,
      keywords: hasKeywords || null,
      sortBy: hasKeywords
        ? searchPackage.keywordsChanged
          ? '-score'
          : params['sortBy'] || config.defaultSort
        : config.defaultSort,
      ...getFiltersFromSearchPackage(searchPackage, config.filterList, config.dateFilterList)
    });
  }

  function onMessage(msg: ITableMessage): void {
    switch (msg.label) {
      case 'pageNum':
        submit({ ...params, currentPage: msg.data });
        break;
      case 'pageSize':
        submit({ ...params, pageSize: msg.data.value, currentPage: 1 });
        break;
      case 'columnSort':
        submit({ ...params, sortBy: toggleSortDirection(data.sortBy, msg.data), currentPage: 1 });
        break;
    }
  }

  return (
    <main>
      <HeroBanner
        title={config.heroBanner.title}
        description={config.heroBanner.description}
        actions={config.heroBanner.actions}
        backgroundImage={config.heroBanner.backgroundImage}
      />

      {config.tabs && config.tabs.length > 0 && (
        <div className="container">
          <ul className="nav nav-tabs search-tabs" role="tablist">
            {config.tabs.map(tab => (
              <li className="nav-item" role="presentation" key={tab.link}>
                <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} role="tab" to={tab.link} end>
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="table-container">
        <div className="container">
          <section className="mb-4 pt-0 pb-0">
            <SearchFilterTemplate
              onSearch={executeSearch}
              advancedFilters
              showAdvancedFilters={config.filterList.some(filter => params[filter])}
              searchOnFilterChange
              filters={config.filters}
              searchHelpLink="/search-help"
              searching={table.loading}
            />
          </section>
          <div className={table.loading ? 'table-loading' : undefined}>
            <TableTemplate data={data} loading={table.loading} onMessage={onMessage} />
          </div>
        </div>
      </section>
    </main>
  );
}
