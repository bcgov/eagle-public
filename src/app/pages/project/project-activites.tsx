import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ActivityCard } from 'app/components/activity-card';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import { TableTemplate } from 'app/components/table/table-template';
import { tableObject, type IColumnObject, type ITableMessage, type TableRowProps } from 'app/components/table/table-object';
import {
  paramsToObject,
  toSearchParams,
  updateTableObjectWithUrlParams
} from 'app/components/table/table-params';
import { useTable } from 'app/components/table/use-table';
import { useProjectContext } from './project-context';

const COLUMNS: IColumnObject[] = [
  { name: 'Headline', value: 'headine', width: 'col-10', nosort: true },
  { name: 'Date', value: 'dateAdded', width: 'col-2', nosort: true }
];

const DEFAULT_SORT = '-dateAdded';

function ActivityRow({ rowData }: TableRowProps) {
  return <ActivityCard rowData={rowData} tableMode showProjectInfo={false} />;
}

/** Recent activities for this project. Its own `*Activities` query params. */
export function ProjectActivites() {
  const { projId } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const base = useMemo(() => {
    const table = updateTableObjectWithUrlParams(params, tableObject({ tableId: 'activities-table', component: ActivityRow }), 'Activities');
    return params['sortByActivities'] ? table : { ...table, sortBy: DEFAULT_SORT };
  }, [params]);

  const result = useTable('projectActivities', {
    dataset: 'RecentActivity',
    enabled: !!projId,
    keywords: params['keywordsActivities'] || '',
    currentPage: base.currentPage,
    pageSize: base.pageSize,
    sortBy: base.sortBy,
    queryModifiers: { project: projId },
    populate: true
  });

  const data = {
    ...base,
    columns: COLUMNS,
    items: result.data.map(record => ({ rowData: record })),
    totalListItems: result.totalListItems,
    options: { ...base.options, showAllPicker: true, disableRowHighlight: true }
  };

  function submit(next: Record<string, any>): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  function onMessage(msg: ITableMessage): void {
    switch (msg.label) {
      case 'pageNum':
        submit({ ...params, currentPageActivities: msg.data });
        break;
      case 'pageSize':
        submit({ ...params, pageSizeActivities: msg.data.value, currentPageActivities: 1 });
        break;
    }
  }

  return (
    <>
      <h3 className="mb-4">Activities and Updates</h3>

      <SearchFilterTemplate
        keywordOverride={params['keywordsActivities']}
        searching={result.loading}
        onSearch={searchPackage => {
          const hasKeywords = searchPackage.keywords?.trim();
          submit({
            ...params,
            keywordsActivities: hasKeywords || null,
            sortByActivities: hasKeywords && searchPackage.keywordsChanged ? '-score' : DEFAULT_SORT,
            currentPageActivities: 1
          });
        }}
      />

      <section className="tab-section">
        {data.totalListItems === 0 && !result.loading ? (
          <div>No recent activities.</div>
        ) : (
          <TableTemplate data={data} loading={result.loading} onMessage={onMessage} />
        )}
      </section>
    </>
  );
}
