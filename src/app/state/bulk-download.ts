import { createStore, useStore } from './store';
import { fetchData, type SearchParamObject } from 'app/api/search';
import { showToast } from './toast';

/** Anonymous cap demi-api enforces per job. Also the ceiling on "select all matching". */
export const SELECT_ALL_MAX = 100;

/** What every refused selection says, wherever it is refused. */
export const CAP_MESSAGE = `You can select up to ${SELECT_ALL_MAX} documents at a time.`;

/** The banner only ever renders once the table already found matches; an empty answer is a failed request, not a real zero. */
export const SELECT_ALL_FAILED_MESSAGE = 'Could not select all matching documents. Try again.';

/** Only what the bulk bar needs: the id to post and a name to show. */
export interface SelectedDocument {
  id: string;
  displayName: string;
}

export interface BulkDownloadJob {
  id: string;
  count: number;
  startedAt: number;
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
  tables.forEach(docs => docs.forEach((doc, id) => all.set(id, doc)));
  return all;
}

/** Every table's selection counts against the cap: the bar posts them merged, as one job. */
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
  docs.forEach(doc => next.set(doc.id, doc));
  if (selectedElsewhere(tableId) + next.size > SELECT_ALL_MAX) return false;
  write(tableId, next);
  return true;
}

/** Clears one table's selection, or every table's when called with no id (the bar's Clear). */
export function clearSelection(tableId?: string): void {
  if (tableId === undefined) {
    selection.set(new Map());
    return;
  }
  write(tableId, EMPTY);
}

/** One table's selection, or every table's merged, which is what the bulk bar downloads. */
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
export async function selectAllMatching(tableId: string, params: SearchParamObject): Promise<boolean> {
  const results = await fetchData({ ...params, pageSize: SELECT_ALL_MAX, currentPage: 1 });
  const rows: any[] = Array.isArray(results.data) ? results.data : [];
  if (rows.length === 0) {
    showToast(SELECT_ALL_FAILED_MESSAGE, { type: 'warning' });
    return false;
  }
  const added = setSelected(
    tableId,
    rows.map(row => ({ id: row._id, displayName: row.displayName }))
  );
  if (!added) showToast(CAP_MESSAGE, { type: 'warning' });
  return added;
}

const JOB_KEY = 'epic-bulk-download-job';
/** A job older than this is demi-api's problem, not ours: the zip has been swept or expired. */
const JOB_MAX_AGE_MS = 60 * 60 * 1000;

function storedJob(): BulkDownloadJob | null {
  try {
    const raw = localStorage.getItem(JOB_KEY);
    const job: BulkDownloadJob | null = raw ? JSON.parse(raw) : null;
    if (!job?.id || Date.now() - job.startedAt > JOB_MAX_AGE_MS) {
      localStorage.removeItem(JOB_KEY);
      return null;
    }
    return job;
  } catch {
    localStorage.removeItem(JOB_KEY);
    return null;
  }
}

// Read at module load so a reload mid-zip resumes polling instead of losing the job.
const job = createStore<BulkDownloadJob | null>(storedJob());

export function setJob(next: BulkDownloadJob): void {
  localStorage.setItem(JOB_KEY, JSON.stringify(next));
  job.set(next);
}

/**
 * Drops the persisted copy but leaves the bar's, so a dead job id cannot come back on reload while
 * the reader still has the failure in front of them.
 */
export function forgetStoredJob(): void {
  localStorage.removeItem(JOB_KEY);
}

export function clearJob(): void {
  localStorage.removeItem(JOB_KEY);
  job.set(null);
}

export function useJob(): BulkDownloadJob | null {
  return useStore(job);
}
