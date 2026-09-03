import { createStore, useStore } from './store';
import { track } from 'app/analytics/analytics';
import { ApiError, createBulkDownload, type BulkDownloadStatus } from 'app/api/api';
import { fetchData, type SearchParamObject } from 'app/api/search';
import { logger } from 'app/config/logging';
import { triggerDownload } from 'app/utils/utils';
import { showToast } from './toast';

/** Anonymous cap demi-api enforces per job. Also the ceiling on "select all matching". */
export const SELECT_ALL_MAX = 100;

/** What every refused selection says, wherever it is refused. */
export const CAP_MESSAGE = `You can select up to ${SELECT_ALL_MAX} documents at a time.`;

/** The banner only ever renders once the table already found matches; an empty answer is a failed request, not a real zero. */
export const SELECT_ALL_FAILED_MESSAGE = 'Could not select all matching documents. Try again.';

/** Only what bulk download needs: the id to post and a name to show. */
export interface SelectedDocument {
  id: string;
  displayName: string;
}

export interface BulkDownloadJob {
  id: string;
  count: number;
  startedAt: number;
  /** Last status demi-api reported. Absent until the panel has polled once. */
  status?: BulkDownloadStatus['status'];
  /** When the ready parts were fired; the guard against firing them a second time. */
  downloadedAt?: number;
}

/** demi-api stops moving the job at these; polling stops with it, and so does the wait. */
export function isTerminal(status?: string): boolean {
  return (
    status === 'ready' || status === 'failed' || status === 'expired' || status === 'cancelled'
  );
}

type TableSelection = Map<string, SelectedDocument>;

const EMPTY: TableSelection = new Map();
const selection = createStore<Map<string, TableSelection>>(new Map());

function write(tableId: string, docs: TableSelection): void {
  const next = new Map(selection.get());
  if (docs.size === 0) {
    next.delete(tableId);
  } else {
    next.set(tableId, docs);
  }
  selection.set(next);
}

function merged(tables: Map<string, TableSelection>): TableSelection {
  if (tables.size === 1) return tables.values().next().value ?? EMPTY;
  const all: TableSelection = new Map();
  tables.forEach((docs) => docs.forEach((doc, id) => all.set(id, doc)));
  return all;
}

/** Every table's selection counts against the cap: they are posted merged, as one job. */
function selectedElsewhere(tableId: string): number {
  let total = 0;
  selection.get().forEach((docs, id) => {
    if (id !== tableId) total += docs.size;
  });
  return total;
}

/** False when the cap refuses the addition; removals always go through. */
export function toggleSelected(tableId: string, doc: SelectedDocument): boolean {
  const docs = new Map(selection.get().get(tableId) ?? EMPTY);
  if (docs.has(doc.id)) {
    docs.delete(doc.id);
  } else {
    if (selectedElsewhere(tableId) + docs.size >= SELECT_ALL_MAX) return false;
    docs.set(doc.id, doc);
  }
  write(tableId, docs);
  return true;
}

/**
 * Adds documents to a table's selection; the ones already selected elsewhere in it stay. All or
 * nothing: false when the whole batch would take the selection past the cap.
 */
export function setSelected(tableId: string, docs: SelectedDocument[]): boolean {
  const next = new Map(selection.get().get(tableId) ?? EMPTY);
  docs.forEach((doc) => next.set(doc.id, doc));
  if (selectedElsewhere(tableId) + next.size > SELECT_ALL_MAX) return false;
  write(tableId, next);
  return true;
}

/** Clears one table's selection, or every table's when called with no id (the toolbar's Clear). */
export function clearSelection(tableId?: string): void {
  if (tableId === undefined) {
    selection.set(new Map());
    return;
  }
  write(tableId, EMPTY);
}

/** One table's selection, or every table's merged, which is what Download posts. */
export function useSelection(tableId?: string): TableSelection {
  const tables = useStore(selection);
  if (tableId === undefined) return merged(tables);
  return tables.get(tableId) ?? EMPTY;
}

/**
 * Selects every document the current filters match, in one request: the anonymous cap is 100 and
 * DEMI pages up to 500, so there is no paging loop to run.
 *
 * Only called from the select-all banner, which only renders once the table already holds more
 * than a page of matches. `fetchData` swallows its own errors into an empty result rather than
 * rejecting, so zero rows here means the request failed, not that the count dropped to zero; the
 * existing selection is left as it was rather than replaced with nothing.
 */
export async function selectAllMatching(
  tableId: string,
  params: SearchParamObject,
): Promise<boolean> {
  const results = await fetchData({ ...params, pageSize: SELECT_ALL_MAX, currentPage: 1 });
  const rows: any[] = Array.isArray(results.data) ? results.data : [];
  if (rows.length === 0) {
    showToast(SELECT_ALL_FAILED_MESSAGE, { type: 'warning' });
    return false;
  }
  const added = setSelected(
    tableId,
    rows.map((row) => ({ id: row._id, displayName: row.displayName })),
  );
  if (!added) showToast(CAP_MESSAGE, { type: 'warning' });
  return added;
}

/** How many jobs demi-api runs at once for one requester; a fourth POST is refused with 429. */
export const MAX_JOBS_IN_FLIGHT = 3;
/** How many jobs the panel keeps, finished ones included. */
const MAX_JOBS = 5;

// In memory only: leaving the site cancels whatever is still being zipped, so nothing survives it.
const jobs = createStore<BulkDownloadJob[]>([]);

/** Newest first. */
export function useJobs(): BulkDownloadJob[] {
  return useStore(jobs);
}

export function addJob(job: BulkDownloadJob): void {
  const list = [job, ...jobs.get()];
  if (list.length > MAX_JOBS) {
    // The oldest finished job falls off first; one still zipping only goes if there is no other.
    const oldest =
      [...list].reverse().find((other) => isTerminal(other.status)) ?? list[list.length - 1];
    jobs.set(list.filter((other) => other !== oldest));
    return;
  }
  jobs.set(list);
}

function patchJob(id: string, change: Partial<BulkDownloadJob>): void {
  jobs.set(jobs.get().map((job) => (job.id === id ? { ...job, ...change } : job)));
}

/** Removes one job; the others keep going. */
export function dismissJob(id: string): void {
  jobs.set(jobs.get().filter((job) => job.id !== id));
}

/** Records what the panel last read, so the toolbar knows a finished job is not still running. */
export function setJobStatus(id: string, status: BulkDownloadStatus['status']): void {
  const current = jobs.get().find((job) => job.id === id);
  if (!current || current.status === status) return;
  patchJob(id, { status });
}

/**
 * Claims a job's one automatic download, returning false if it was already claimed. Read off the
 * store rather than a render's copy, so StrictMode's second effect pass cannot fire a second zip.
 */
export function claimDownload(id: string): boolean {
  const current = jobs.get().find((job) => job.id === id);
  if (!current || current.downloadedAt) return false;
  patchJob(id, { downloadedAt: Date.now() });
  return true;
}

/** True once demi-api is preparing as many jobs as it will take: a fourth would be refused. */
export function useDownloadInProgress(): boolean {
  const list = useStore(jobs);
  return list.filter((job) => !isTerminal(job.status)).length >= MAX_JOBS_IN_FLIGHT;
}

/** What each refused POST tells the reader. Anything else is a fault they cannot act on. */
const START_ERRORS: Record<number, string> = {
  429: "You've reached the download limit. Try again later.",
  503: 'Bulk download is not available right now.',
};
const START_FAILED = 'That download could not be started. Please try again.';

const startError = createStore<string | null>(null);

export function useStartError(): string | null {
  return useStore(startError);
}

/** Forgets every job and any failed start: the panel is closed and nothing is left to show. */
export function dismissAll(): void {
  startError.set(null);
  jobs.set([]);
}

/**
 * Posts every selected document as one job. The selection is cleared once demi-api has it, so a
 * failed start leaves the reader their selection to try again with.
 */
export async function startDownload(): Promise<void> {
  const ids = [...merged(selection.get()).keys()];
  if (ids.length === 0) return;
  startError.set(null);
  track('Bulk Download Started', { count: ids.length });

  try {
    const result = await createBulkDownload(ids);
    clearSelection();
    // One document never gets a job: demi-api answers with the presigned URL itself.
    if ('single' in result) {
      triggerDownload(result.url);
      return;
    }
    addJob({ id: result.id, count: ids.length, startedAt: Date.now() });
  } catch (failure) {
    logger.warn('Bulk download could not be started', 'bulk-download', failure);
    const status = failure instanceof ApiError ? failure.status : 0;
    startError.set(START_ERRORS[status] ?? START_FAILED);
  }
}
