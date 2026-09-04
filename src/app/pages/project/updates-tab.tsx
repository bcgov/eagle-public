import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ActivityCard } from 'app/components/activity-card';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { TableTemplate } from 'app/components/table/table-template';
import {
  tableObject,
  type IColumnObject,
  type ITableMessage,
  type TableRowProps,
} from 'app/components/table/table-object';
import {
  paramsToObject,
  toSearchParams,
  updateTableObjectWithUrlParams,
} from 'app/components/table/table-params';
import { useTable } from 'app/components/table/use-table';
import { getNotifyApi } from 'app/config/config';
import { useProjectContext } from './project-context';
import './updates-tab.css';

const COLUMNS: IColumnObject[] = [
  { name: 'Headline', value: 'headine', width: 'col-10', nosort: true },
  { name: 'Date', value: 'dateAdded', width: 'col-2', nosort: true },
];

const DEFAULT_SORT = '-dateAdded';

function ActivityRow({ rowData }: TableRowProps) {
  return <ActivityCard rowData={rowData} tableMode showProjectInfo={false} />;
}

/** Updates published for this project, newest first. Its own `*Activities` query params. */
export function UpdatesTab() {
  const { projId } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const base = useMemo(() => {
    const table = updateTableObjectWithUrlParams(
      params,
      tableObject({ tableId: 'activities-table', component: ActivityRow }),
      'Activities',
    );
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
    populate: true,
  });

  const total = result.totalListItems;

  const data = {
    ...base,
    columns: COLUMNS,
    items: result.data.map((record) => ({ rowData: record })),
    totalListItems: total,
    options: {
      ...base.options,
      showHeader: false,
      showTopControls: false,
      showAllPicker: true,
      disableRowHighlight: true,
    },
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
    <div className="updates-tab">
      <div className="updates-tab__main">
        <div className="updates-tab__header">
          <h2 className="updates-tab__title">Updates</h2>
          {total > 0 && (
            <p className="updates-tab__count">
              {total.toLocaleString('en-CA')} {total === 1 ? 'update' : 'updates'}, newest first
            </p>
          )}
        </div>

        <SearchFilterTemplate
          keywordOverride={params['keywordsActivities']}
          searching={result.loading}
          onSearch={(searchPackage) => {
            const hasKeywords = searchPackage.keywords?.trim();
            submit({
              ...params,
              keywordsActivities: hasKeywords || null,
              sortByActivities:
                hasKeywords && searchPackage.keywordsChanged ? '-score' : DEFAULT_SORT,
              currentPageActivities: 1,
            });
          }}
        />

        <TableTemplate
          data={data}
          loading={result.loading}
          onMessage={onMessage}
          emptyMessage="No updates have been published for this project."
        />
      </div>

      {/* eagle-notify is optional per environment; without it the card would offer nothing. */}
      {!!getNotifyApi() && (
        <aside className="updates-tab__aside">
          <section className="updates-tab__subscribe">
            <h2 className="updates-tab__subscribe-title">Never miss an update</h2>
            <SubscribePopover serviceName={`project:${projId}`} variant="project" />
          </section>
        </aside>
      )}
    </div>
  );
}
