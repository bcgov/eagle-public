import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { ApiError, getBulkDownload, type BulkDownloadStatus } from 'app/api/api';
import { logger } from 'app/config/logging';
import { dismissDownload, forgetStoredJob, isTerminal, setJobStatus, useJob, useStartError } from 'app/state/bulk-download';
import { triggerDownload } from 'app/utils/utils';
import './download-panel.css';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function Row({ icon, tone, children }: { icon: ReactNode; tone?: 'muted' | 'error'; children: ReactNode }) {
  return (
    <li className={`download-panel__row${tone ? ` download-panel__row--${tone}` : ''}`}>
      <span className="download-panel__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

const SPINNER = <span className="spinner-border spinner-border-sm"></span>;
const CHECK = <i className="material-icons md-18">check_circle</i>;
const WARNING = <i className="material-icons md-18">error_outline</i>;

function progressRows(job: { count: number }, state?: BulkDownloadStatus): ReactNode {
  const partCount = state?.partCount ?? 0;
  // The part being zipped, not the last one finished: "part 0 of 3" reads as nothing happening.
  const part = Math.min((state?.partsReady ?? 0) + 1, partCount);

  return (
    <Row icon={SPINNER}>
      Zipping {plural(job.count, 'file')}…
      {partCount > 1 && <span className="download-panel__detail">part {part} of {partCount}</span>}
    </Row>
  );
}

function readyRows(state: BulkDownloadStatus): ReactNode {
  if (state.includedCount === 0) {
    return <Row icon={WARNING} tone="error">None of the selected documents could be downloaded.</Row>;
  }

  return (
    <>
      {(state.parts ?? []).map(part => (
        <Row key={part.n} icon={CHECK}>
          Downloading {part.fileName || `part ${part.n}`}
        </Row>
      ))}
      {state.errorCount > 0 && (
        <Row icon={WARNING} tone="muted">
          {plural(state.errorCount, 'file')} could not be included (see errors.txt)
        </Row>
      )}
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
  const panelRef = useRef<HTMLDivElement>(null);
  // StrictMode runs effects twice and a re-render must not re-fire either; the job id fires once.
  const firedFor = useRef<string | null>(null);

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
    if (jobGone) forgetStoredJob();
  }, [query.isError, jobGone, queryError]);

  useEffect(() => {
    if (!job || state?.status !== 'ready' || firedFor.current === job.id) return;
    firedFor.current = job.id;
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

  // The panel is fixed over the page; without this it covers the pagination, the page-size picker
  // and the footer links. No dependencies: collapsing changes its height, so every render measures.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const body = window.document.body;
    // The panel's own 1rem inset from the bottom of the viewport.
    body.style.paddingBottom = `${panel.offsetHeight + 16}px`;
    return () => {
      body.style.paddingBottom = '';
    };
  });

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
    if (state?.status === 'ready') return readyRows(state);
    return progressRows(job!, state);
  }

  return (
    <div className="download-panel" ref={panelRef}>
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
