import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { ApiError, createBulkDownload, getBulkDownload, type BulkDownloadStatus } from 'app/api/api';
import { logger } from 'app/config/logging';
import {
  clearJob,
  clearSelection,
  selectedTableIds,
  setJob,
  useJob,
  useSelection
} from 'app/state/bulk-download';
import { showToast } from 'app/state/toast';
import { triggerDownload } from 'app/utils/utils';

/** demi-api stops moving the job at these; polling stops with it. */
function isTerminal(status?: string): boolean {
  return status === 'ready' || status === 'failed' || status === 'expired';
}

function jobMessage(state?: BulkDownloadStatus): string {
  switch (state?.status) {
    case 'ready':
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

  const query = useQuery({
    queryKey: ['bulk-download', job?.id],
    queryFn: () => getBulkDownload(job!.id),
    enabled: !!job,
    refetchInterval: q => (isTerminal(q.state.data?.status) ? false : 4000)
  });

  const state = query.data;
  const status = state?.status;

  useEffect(() => {
    if (!job || state?.status !== 'ready' || firedFor.current === job.id) return;
    firedFor.current = job.id;
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
      setJob({ id: result.id, tableId: selectedTableIds()[0] ?? '', count: ids.length, startedAt: Date.now() });
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
      className="position-fixed bottom-0 start-0 end-0 bg-white border-top shadow p-3"
      style={{ zIndex: 11000 }}
      role="status"
      aria-live="polite"
    >
      <div className="container d-flex flex-wrap align-items-center justify-content-between gap-2">
        {job ? (
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
