import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useSearchParams } from 'react-router';
import { filterUpdates, projectUpdatesQueryOptions } from 'app/api/updates';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { Pagination } from 'app/components/table/pagination';
import { paramsToObject, toSearchParams } from 'app/components/table/table-params';
import { UpdateCard } from 'app/components/update-card/update-card';
import { getNotifyApi } from 'app/config/config';
import { searchUrl } from 'app/routes/legacy-search';
import { Constants } from 'app/utils/constants';
import { useProjectContext } from './project-context';
import './updates-tab.css';

const PAGE_SIZE = Constants.tableDefaults.DEFAULT_PAGE_SIZE;

/** How long typing must pause before the filter applies. */
const FILTER_DELAY_MS = 300;

/** Rows a list holds open while its first page is in flight. */
const SKELETON_ROWS = [1, 2, 3];

function plural(count: number): string {
  return `${count.toLocaleString('en-CA')} ${count === 1 ? 'update' : 'updates'}`;
}

/**
 * The project's visible Updates, newest first, filtered in place over the loaded list. Its own
 * `*Activities` query params. With nothing visible there is no tab, so it leaves for the overview.
 */
export function UpdatesTab() {
  const { projId } = useProjectContext();
  const filterId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);
  const text = params['keywordsActivities'] || '';
  const page = +(params['currentPageActivities'] || Constants.tableDefaults.DEFAULT_CURRENT_PAGE);

  // The box answers every keystroke; the URL, the list and the announced count follow it once
  // typing pauses. Back and Forward change the URL, and the box follows that.
  const [draft, setDraft] = useState(text);
  const [synced, setSynced] = useState(text);
  if (text !== synced) {
    setSynced(text);
    setDraft(text);
  }
  useEffect(() => {
    if (draft === text) return;
    const timer = window.setTimeout(() => {
      setSearchParams(
        toSearchParams({ ...params, keywordsActivities: draft || null, currentPageActivities: 1 }),
        { replace: true },
      );
    }, FILTER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, text, params, setSearchParams]);

  const { data, isError } = useQuery(projectUpdatesQueryOptions(projId));
  const updates = data ?? null;
  const shown = useMemo(() => (updates ? filterUpdates(updates, text) : null), [updates, text]);
  const lastPage = Math.max(1, Math.ceil((shown?.length ?? 0) / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), lastPage);

  if (updates?.length === 0) return <Navigate to={`/p/${projId}/overview`} replace />;

  function submit(next: Record<string, unknown>): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  return (
    <div className="updates-tab">
      <div className="updates-tab__main">
        <div className="updates-tab__header">
          <h2 className="updates-tab__title">Updates</h2>
          {updates && shown ? (
            <p className="updates-tab__count" role="status">
              {text
                ? `${shown.length.toLocaleString('en-CA')} of ${plural(updates.length)} match`
                : `${plural(updates.length)}, newest first`}
            </p>
          ) : (
            !isError && (
              <p className="updates-tab__count">
                <Skeleton width="9rem" />
              </p>
            )
          )}
        </div>

        <div className="updates-tab__filter">
          <label htmlFor={filterId}>Filter updates</label>
          <input
            id={filterId}
            type="search"
            className="form-control"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>

        {isError && !shown ? (
          <p className="updates-tab__empty">
            Updates could not be loaded right now. Try again in a moment.
          </p>
        ) : !shown ? (
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
        ) : shown.length === 0 ? (
          <p className="updates-tab__empty">No updates match that filter.</p>
        ) : (
          <ol className="updates-tab__list">
            {shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((update) => (
              <UpdateCard key={update.id} update={update} />
            ))}
          </ol>
        )}

        <Pagination
          currentPage={current}
          pageSize={PAGE_SIZE}
          totalItems={shown?.length ?? 0}
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
              You can also <Link to={searchUrl('activities')}>subscribe to all projects</Link>.
            </p>
          </section>
        </aside>
      )}
    </div>
  );
}
