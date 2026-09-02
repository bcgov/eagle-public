import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { ApiError, createBulkDownload, getBulkDownload, type BulkDownloadStatus } from 'app/api/api';
import { logger } from 'app/config/logging';
import { clearJob, clearSelection, forgetStoredJob, setJob, useJob, useSelection } from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import { triggerDownload } from 'app/utils/utils';

/** demi-api stops moving the job at these; polling stops with it. */
function isTerminal(status?: string): boolean {
  return status === 'ready' || status === 'failed' || status === 'expired';
}

function jobMessage(state?: BulkDownloadStatus): string {
  switch (state?.status) {
    case 'ready':
      if (state.includedCount === 0) return 'None of the selected documents could be downloaded.';
      return state.errorCount
        ? `Download started (${state.errorCount} files could not be included; see errors.txt)`
        : 'Download started';
    case 'failed':
      return 'That download could not be completed. Please try again.';
    case 'expired':
      return 'That download has expired. Please start it again.';
    default:
      return state?.partCount
        ? `Preparing download… ${state.partsReady} of ${state.partCount} parts`
        : 'Preparing download…';
  }
}

/**
 * The selection and bulk-download bar, mounted once for the whole app. It survives navigation, and
 * a job id in localStorage means a reload mid-zip resumes polling rather than losing the download.
 */
export function BulkDownloadBar() {
  const selection = useSelection();
  const job = useJob();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice and a re-render must not re-fire either; the job id fires once.
  const firedFor = useRef<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['bulk-download', job?.id],
    queryFn: () => getBulkDownload(job!.id),
    enabled: !!job,
    retry: false,
    // A poll that failed keeps failing; stop the 4s beat and let the reader retry or dismiss.
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

  // The bar is fixed over the page; without this the last rows and the footer cannot be reached.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const body = window.document.body;
    body.style.paddingBottom = `${bar.offsetHeight}px`;
    return () => {
      body.style.paddingBottom = '';
    };
  });

  async function startDownload(): Promise<void> {
    const ids = [...selection.keys()];
    setError(null);
    track('Bulk Download Started', { count: ids.length });

    try {
      const result = await createBulkDownload(ids);
      // One document never gets a job: demi-api answers with the presigned URL itself.
      if ('single' in result) {
        triggerDownload(result.url);
        clearSelection();
        return;
      }
      setJob({ id: result.id, count: ids.length, startedAt: Date.now() });
    } catch (failure) {
      logger.warn('Bulk download could not be started', 'bulk-download', failure);
      const httpStatus = failure instanceof ApiError ? failure.status : 0;
      if (httpStatus === 429) {
        setError("You've reached the download limit. Try again later.");
      } else if (httpStatus === 503) {
        setError('Bulk download is not available right now.');
      } else {
        showToast('That download could not be started. Please try again.', { type: 'error' });
      }
    }
  }

  function dismiss(): void {
    clearJob();
    clearSelection();
  }

  if (!job && selection.size === 0 && !error) return null;

  return (
    <div
      ref={barRef}
      className="position-fixed bottom-0 start-0 end-0 bg-white border-top shadow p-3"
      style={{ zIndex: 11000 }}
      role="status"
      aria-live="polite"
    >
      <div className="container d-flex flex-wrap align-items-center justify-content-between gap-2">
        {query.isError ? (
          <>
            <span>{jobGone ? 'That download is no longer available.' : 'Could not check the download.'}</span>
            <div className="d-flex gap-2">
              {!jobGone && (
                <button type="button" className="btn btn-primary" onClick={() => void query.refetch()}>
                  Retry
                </button>
              )}
              <button type="button" className="btn btn-outline-secondary" onClick={dismiss}>
                Dismiss
              </button>
            </div>
          </>
        ) : job ? (
          <>
            <span>{jobMessage(state)}</span>
            {isTerminal(status) && (
              <button type="button" className="btn btn-outline-secondary" onClick={dismiss}>
                Dismiss
              </button>
            )}
          </>
        ) : (
          <>
            <span>{error ?? `${selection.size} document${selection.size === 1 ? '' : 's'} selected`}</span>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-primary" onClick={() => void startDownload()}>
                Download
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setError(null);
                  clearSelection();
                }}
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
