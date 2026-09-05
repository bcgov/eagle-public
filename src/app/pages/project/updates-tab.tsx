import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { Pagination } from 'app/components/table/pagination';
import { paramsToObject, toSearchParams } from 'app/components/table/table-params';
import { useTable } from 'app/components/table/use-table';
import { UpdateCard } from 'app/components/update-card/update-card';
import { getNotifyApi } from 'app/config/config';
import { Constants } from 'app/utils/constants';
import { useProjectContext } from './project-context';
import './updates-tab.css';

const DEFAULT_SORT = '-dateAdded';
const PAGE_SIZE = Constants.tableDefaults.DEFAULT_PAGE_SIZE;

/** Rows a list holds open while its first page is in flight. */
const SKELETON_ROWS = [1, 2, 3];

/** Updates published for this project, newest first. Its own `*Activities` query params. */
export function UpdatesTab() {
  const { projId } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const page = +(params['currentPageActivities'] || Constants.tableDefaults.DEFAULT_CURRENT_PAGE);
  const sortBy = params['sortByActivities'] || DEFAULT_SORT;

  const result = useTable('projectActivities', {
    dataset: 'RecentActivity',
    enabled: !!projId,
    keywords: params['keywordsActivities'] || '',
    currentPage: page,
    pageSize: PAGE_SIZE,
    sortBy,
    queryModifiers: { project: projId },
    populate: true,
  });

  const total = result.totalListItems;

  function submit(next: Record<string, any>): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  return (
    <div className="updates-tab">
      <div className="updates-tab__main">
        <div className="updates-tab__header">
          <h2 className="updates-tab__title">Updates</h2>
          {result.loading && !total && (
            <p className="updates-tab__count">
              <Skeleton width="9rem" />
            </p>
          )}
          {total > 0 && (
            <p className="updates-tab__count">
              {total.toLocaleString('en-CA')} {total === 1 ? 'update' : 'updates'},{' '}
              {sortBy === DEFAULT_SORT ? 'newest first' : 'by relevance'}
            </p>
          )}
        </div>

        <SearchFilterTemplate
          keywordOverride={params['keywordsActivities']}
          searching={result.loading}
          searchAsYouType
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

        {result.loading && result.data.length === 0 ? (
          <ol className="updates-tab__list" aria-busy="true">
            <li className="visually-hidden">Loading</li>
            {SKELETON_ROWS.map((index) => (
              <li className="updates-tab__skeleton" key={index}>
                <Skeleton width="25%" />
                <Skeleton width="65%" />
                <Skeleton lines={2} />
              </li>
            ))}
          </ol>
        ) : total === 0 ? (
          <p className="updates-tab__empty">No updates have been published for this project.</p>
        ) : (
          <ol className="updates-tab__list">
            {result.data.map((update: any) => (
              <UpdateCard key={update._id} update={update} />
            ))}
          </ol>
        )}

        <Pagination
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalItems={total}
          ariaLabel="Updates pagination"
          onPageChange={(next) => submit({ ...params, currentPageActivities: next })}
        />
      </div>

      {/* eagle-notify is optional per environment; without it the card would offer nothing. */}
      {!!getNotifyApi() && (
        <aside className="updates-tab__aside">
          <section className="updates-tab__subscribe">
            <h2 className="updates-tab__subscribe-title">Never miss an update</h2>
            <p className="updates-tab__subscribe-text">
              Get an email each time the Environmental Assessment Office publishes an update on this
              project.
            </p>
            <SubscribePopover
              serviceName={`project:${projId}`}
              variant="project"
              surface="card"
              label="Subscribe to this project"
            />
            <p className="updates-tab__subscribe-all">
              You can also <Link to="/news">subscribe to all projects</Link>.
            </p>
          </section>
        </aside>
      )}
    </div>
  );
}
