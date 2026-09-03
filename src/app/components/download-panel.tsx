import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { ApiError, cancelBulkDownload, getBulkDownload, type BulkDownloadStatus } from 'app/api/api';
import { logger } from 'app/config/logging';
import {
  claimDownload,
  dismissAll,
  dismissJob,
  isTerminal,
  setJobStatus,
  useJobs,
  useStartError,
  type BulkDownloadJob
} from 'app/state/bulk-download';
import { triggerDownload } from 'app/utils/utils';
import './download-panel.css';

/**
 * Best effort: the job leaves the panel whether or not demi-api takes the cancel, and older
 * backends answer the route with 404 or 405.
 */
function cancelJob(id: string, keepalive = false): void {
  void cancelBulkDownload(id, keepalive).catch(failure =>
    logger.warn('Bulk download could not be cancelled', 'bulk-download', failure)
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function Row({
  icon,
  tone,
  action,
  children
}: {
  icon: ReactNode;
  tone?: 'muted' | 'error';
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className={`download-panel__row${tone ? ` download-panel__row--${tone}` : ''}`}>
      <span className="download-panel__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="download-panel__text">{children}</span>
      {action}
    </li>
  );
}

/** Only the status text is live; the buttons sit outside so they are not re-announced. */
function StatusRows({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <ul className="download-panel__rows">{children}</ul>
    </div>
  );
}

const SPINNER = <span className="spinner-border spinner-border-sm"></span>;
const CHECK = (
  <i className="material-icons md-18" aria-hidden="true">
    check_circle
  </i>
);
const WARNING = (
  <i className="material-icons md-18" aria-hidden="true">
    error_outline
  </i>
);

function progressRows(job: { count: number }, state?: BulkDownloadStatus): ReactNode {
  const partCount = state?.partCount ?? 0;
  // The part being zipped, not the last one finished: "part 0 of 3" reads as nothing happening.
  const part = Math.min((state?.partsReady ?? 0) + 1, partCount);

  return (
    <Row icon={SPINNER}>
      Zipping {plural(job.count, 'document')}…
      {partCount > 1 && <span className="download-panel__detail">part {part} of {partCount}</span>}
    </Row>
  );
}

function errorRows(state: BulkDownloadStatus): ReactNode {
  // errorCount is the true total; errors[] is capped at 100 by demi-api, so it can be shorter.
  const errors = state.errors ?? [];
  const unnamed = state.errorCount - errors.length;
  const allFailed = state.includedCount === 0;

  return (
    <>
      <Row icon={WARNING} tone="error">
        {allFailed
          ? 'None of the selected documents could be downloaded.'
          : `${plural(state.errorCount, 'document')} could not be included${errors.length > 0 ? ':' : '.'}`}
      </Row>
      {errors.length > 0 && (
        <li className="download-panel__errors">
          <ul className="download-panel__names">
            {errors.map(error => (
              <li key={error.documentId}>{error.name || error.documentId}</li>
            ))}
          </ul>
          {unnamed > 0 && <span className="download-panel__detail">and {unnamed} more</span>}
          {/* An all-failed job downloads no zip, so there is no errors.txt to read. */}
          {!allFailed && <span className="download-panel__detail">See errors.txt in the zip for the reasons.</span>}
        </li>
      )}
    </>
  );
}

function readyRows(state: BulkDownloadStatus, downloaded: boolean): ReactNode {
  if (state.includedCount === 0) {
    return errorRows(state);
  }

  return (
    <>
      {(state.parts ?? []).map(part => {
        // demi-api names the zip; the reader must see that name, not one this app made up.
        const name = part.fileName || `part ${part.n}`;
        return (
          <Row
            key={part.n}
            icon={CHECK}
            action={
              downloaded && (
                <button
                  type="button"
                  className="download-panel__again"
                  aria-label={`Download again ${name}`}
                  onClick={() => triggerDownload(part.url)}
                >
                  <i className="material-icons md-18" aria-hidden="true">
                    file_download
                  </i>
                </button>
              )
            }
          >
            <span className="download-panel__name">{name}</span>
            <span className="download-panel__detail">{downloaded ? 'Downloaded' : 'Downloading…'}</span>
          </Row>
        );
      })}
      {state.errorCount > 0 && errorRows(state)}
    </>
  );
}

/**
 * One job's rows, with its own poll: a job that reached its last status stops asking while the
 * others carry on.
 */
function JobRows({ job, collapsed }: { job: BulkDownloadJob; collapsed: boolean }) {
  const query = useQuery({
    queryKey: ['bulk-download', job.id],
    queryFn: () => getBulkDownload(job.id),
    retry: false,
    // A poll that failed keeps failing; stop the 4s beat and let the reader retry or close.
    refetchInterval: q => (q.state.status === 'error' || isTerminal(q.state.data?.status) ? false : 4000)
  });

  const state = query.data;
  const status = state?.status;
  const queryError = query.error;
  // demi-api no longer knows the job: the zip is swept or expired, so retrying cannot bring it back.
  const jobGone =
    query.isError && queryError instanceof ApiError && (queryError.status === 404 || queryError.status === 410);

  useEffect(() => {
    if (!query.isError) return;
    logger.warn('Bulk download status could not be read', 'bulk-download', queryError);
    // A poll that cannot answer leaves the status unread, which the toolbar takes for "still
    // running"; a terminal one releases Download while the panel keeps the error and its Retry.
    setJobStatus(job.id, 'failed');
  }, [query.isError, queryError, job.id]);

  // `downloadedAt` on the stored job is the guard, not a ref: a re-render must not re-fire the zip.
  useEffect(() => {
    if (job.downloadedAt || state?.status !== 'ready' || !claimDownload(job.id)) return;
    // An empty zip has parts, and each one answers with an error page; downloading them is noise.
    if (state.includedCount === 0) {
      track('Bulk Download Failed', { status: 'empty' });
      return;
    }
    track('Bulk Download Ready', {
      count: job.count,
      part_count: state.partCount,
      error_count: state.errorCount
    });
    // A second apart: the browser asks once to allow multiple downloads, as Drive's does.
    (state.parts ?? []).forEach((part, index) => window.setTimeout(() => triggerDownload(part.url), index * 1000));
  }, [job, state]);

  useEffect(() => {
    if (status === 'failed' || status === 'expired') track('Bulk Download Failed', { status });
  }, [status]);

  useEffect(() => {
    if (status) setJobStatus(job.id, status);
  }, [status, job.id]);

  function rows(): ReactNode {
    if (jobGone)
      return (
        <Row icon={WARNING} tone="error">
          That download is no longer available.
        </Row>
      );
    if (query.isError)
      return (
        <Row icon={WARNING} tone="error">
          Could not check the download.
        </Row>
      );
    if (status === 'failed')
      return (
        <Row icon={WARNING} tone="error">
          That download could not be completed. Please try again.
        </Row>
      );
    if (status === 'expired')
      return (
        <Row icon={WARNING} tone="error">
          That download has expired. Please start it again.
        </Row>
      );
    if (status === 'cancelled')
      return (
        <Row icon={WARNING} tone="muted">
          Download cancelled.
        </Row>
      );
    if (state?.status === 'ready') return readyRows(state, !!job.downloadedAt);
    return progressRows(job, state);
  }

  // Collapsing hides the rows but keeps the poll: the zip carries on being built either way.
  if (collapsed) return null;

  return (
    <div className="download-panel__job">
      <div className="download-panel__job-body">
        <StatusRows>{rows()}</StatusRows>
        {query.isError && !jobGone && (
          <div className="download-panel__actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void query.refetch()}>
              Retry
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="download-panel__dismiss"
        aria-label={`Dismiss download of ${plural(job.count, 'document')}`}
        onClick={() => {
          // A zip still being built is stopped at the backend, not left running for nobody.
          if (!isTerminal(job.status)) cancelJob(job.id);
          dismissJob(job.id);
        }}
      >
        <i className="material-icons md-18" aria-hidden="true">
          close
        </i>
      </button>
    </div>
  );
}

/**
 * The transfer panel, mounted once for the whole app: it stays put as the reader moves around the
 * site. Jobs live in memory only, so leaving or reloading ends them; closing the panel forgets
 * them, collapsing it keeps the polls running.
 */
export function DownloadPanel() {
  const jobs = useJobs();
  const startError = useStartError();
  const [collapsed, setCollapsed] = useState(false);
  const inFlight = jobs.filter(job => !isTerminal(job.status)).map(job => job.id);
  // A joined key, so the listeners are not torn down and rebuilt on every unrelated render.
  const inFlightKey = inFlight.join(',');

  useEffect(() => {
    if (!inFlightKey) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    // `pagehide`, not `unload`: a page put in the back/forward cache fires it too.
    const cancelAll = () => inFlightKey.split(',').forEach(id => cancelJob(id, true));
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', cancelAll);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', cancelAll);
    };
  }, [inFlightKey]);

  if (jobs.length === 0 && !startError) return null;

  return (
    <div className="download-panel">
      <div className="download-panel__header">
        <h2 className="download-panel__title">Document download</h2>
        <button
          type="button"
          className="download-panel__control"
          aria-label={collapsed ? 'Expand download panel' : 'Collapse download panel'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <i className="material-icons md-18" aria-hidden="true">
            {collapsed ? 'expand_less' : 'expand_more'}
          </i>
        </button>
        <button
          type="button"
          className="download-panel__control"
          aria-label="Close download panel"
          onClick={() => {
            inFlight.forEach(id => cancelJob(id));
            dismissAll();
          }}
        >
          <i className="material-icons md-18" aria-hidden="true">
            close
          </i>
        </button>
      </div>

      <div className="download-panel__body">
        {!collapsed && startError && (
          <StatusRows>
            <Row icon={WARNING} tone="error">
              {startError}
            </Row>
          </StatusRows>
        )}
        {jobs.map(job => (
          <JobRows key={job.id} job={job} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}
