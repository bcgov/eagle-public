import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { ApiError, getBulkDownload, type BulkDownloadStatus } from 'app/api/api';
import { logger } from 'app/config/logging';
import {
  claimDownload,
  dismissDownload,
  forgetStoredJob,
  isTerminal,
  setJobStatus,
  useJob,
  useStartError
} from 'app/state/bulk-download';
import { triggerDownload } from 'app/utils/utils';
import './download-panel.css';

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

  return (
    <>
      <Row icon={WARNING} tone="error">
        {state.includedCount === 0
          ? 'None of the selected documents could be downloaded.'
          : `${plural(state.errorCount, 'document')} could not be included:`}
      </Row>
      {errors.length > 0 && (
        <li className="download-panel__errors">
          <ul className="download-panel__names">
            {errors.map(error => (
              <li key={error.documentId}>{error.name || error.documentId}</li>
            ))}
          </ul>
          <span className="download-panel__detail">See errors.txt in the zip for the reasons.</span>
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
 * The transfer panel, mounted once for the whole app: it stays put as the reader moves around the
 * site, and a job id in localStorage means a reload mid-zip resumes polling rather than losing the
 * download. Closing it forgets the job; collapsing it keeps the poll running.
 */
export function DownloadPanel() {
  const job = useJob();
  const startError = useStartError();
  const [collapsed, setCollapsed] = useState(false);

  const query = useQuery({
    queryKey: ['bulk-download', job?.id],
    queryFn: () => getBulkDownload(job!.id),
    enabled: !!job,
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
    setJobStatus('failed');
    if (jobGone) forgetStoredJob();
  }, [query.isError, jobGone, queryError]);

  // `downloadedAt` on the stored job is the guard, not a ref: a reload must not re-fire the zip.
  useEffect(() => {
    if (!job || job.downloadedAt || state?.status !== 'ready' || !claimDownload()) return;
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
    if (status) setJobStatus(status);
  }, [status]);

  if (!job && !startError) return null;

  const canRetry = query.isError && !jobGone;

  function rows(): ReactNode {
    if (startError)
      return (
        <Row icon={WARNING} tone="error">
          {startError}
        </Row>
      );
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
    if (state?.status === 'ready') return readyRows(state, !!job?.downloadedAt);
    return progressRows(job!, state);
  }

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
          onClick={dismissDownload}
        >
          <i className="material-icons md-18" aria-hidden="true">
            close
          </i>
        </button>
      </div>

      {!collapsed && (
        <div className="download-panel__body">
          {/* Only the status text is live; the buttons sit outside so they are not re-announced. */}
          <div role="status" aria-live="polite">
            <ul className="download-panel__rows">{rows()}</ul>
          </div>
          {canRetry && (
            <div className="download-panel__actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void query.refetch()}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
