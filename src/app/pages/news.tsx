import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { getNotifyApi } from 'app/config/config';
import { ActivityCard } from 'app/components/activity-card';
import { HeroBanner } from 'app/components/hero-banner';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import { TableTemplate } from 'app/components/table/table-template';
import { tableObject, type IColumnObject, type ITableMessage, type TableRowProps } from 'app/components/table/table-object';
import {
  paramsToObject,
  toggleSortDirection,
  toSearchParams,
  updateTableObjectWithUrlParams
} from 'app/components/table/table-params';
import { useTable } from 'app/components/table/use-table';

const TABLE_ID = 'news';

const TABLE_COLUMNS: IColumnObject[] = [
  { name: 'Headline', value: 'headline', width: 'col-10', nosort: true },
  { name: 'Date', value: 'dateAdded', width: 'col-2', nosort: false }
];

function NewsRow({ rowData }: TableRowProps) {
  return <ActivityCard rowData={rowData} tableMode />;
}

export function News() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const base = useMemo(() => {
    const table = updateTableObjectWithUrlParams(params, tableObject({ component: NewsRow }));
    // The shared default is the document field; activities are dated with dateAdded.
    return table.sortBy === '-datePosted' ? { ...table, sortBy: '-dateAdded' } : table;
  }, [params]);

  const result = useTable(TABLE_ID, {
    dataset: 'RecentActivity',
    keywords: params['keywords'] || '',
    currentPage: base.currentPage,
    pageSize: base.pageSize,
    sortBy: base.sortBy,
    populate: true
  });

  const data = {
    ...base,
    columns: TABLE_COLUMNS,
    items: result.data.map(record => ({ rowData: record })),
    totalListItems: result.totalListItems,
    options: {
      ...base.options,
      showPageCountDisplay: true,
      showPagination: true,
      showAllPicker: true,
      disableRowHighlight: true
    }
  };

  function submit(next: Record<string, any>): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  function onMessage(msg: ITableMessage): void {
    switch (msg.label) {
      case 'columnSort':
        submit({ ...params, sortBy: toggleSortDirection(base.sortBy, msg.data, '-'), currentPage: 1 });
        break;
      case 'pageNum':
        submit({ ...params, currentPage: msg.data });
        break;
      case 'pageSize':
        submit({ ...params, pageSize: msg.data.value, currentPage: 1 });
        break;
    }
  }

  return (
    <main>
      <HeroBanner
        title="Activities & Updates"
        description="Find activities and updates for environmental assessment projects in British Columbia. Click on the project info button to view the project details page."
        backgroundImage="/assets/images/hero-banner.jpg"
      />

      {getNotifyApi() ? (
        <div className="container d-flex justify-content-end pt-4">
          <SubscribePopover serviceName="eao:updates" variant="all" />
        </div>
      ) : null}

      <section className="project-list table-container">
        <div className="container">
          <section className="mb-4 pt-0 pb-0">
            <SearchFilterTemplate
              onSearch={searchEvent =>
                submit({ ...params, currentPage: 1, keywords: searchEvent.keywords || null })
              }
              searching={result.loading}
            />
          </section>
          {!result.loading && data.totalListItems === 0 ? (
            <div className="text-center my-5">
              <p className="text-muted">No activities found</p>
            </div>
          ) : (
            <TableTemplate data={data} loading={result.loading} onMessage={onMessage} />
          )}
        </div>
      </section>
    </main>
  );
}
