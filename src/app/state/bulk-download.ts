import { createStore, useStore } from './store';
import { fetchData, type SearchParamObject } from 'app/api/search';

/** Anonymous cap demi-api enforces per job. Also the ceiling on "select all matching". */
export const SELECT_ALL_MAX = 100;

/** Only what the bulk bar needs: the id to post and a name to show. */
export interface SelectedDocument {
  id: string;
  displayName: string;
}

export interface BulkDownloadJob {
  id: string;
  tableId: string;
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

export function toggleSelected(tableId: string, doc: SelectedDocument): void {
  const docs = new Map(selection.get().get(tableId) ?? EMPTY);
  if (docs.has(doc.id)) {
    docs.delete(doc.id);
  } else {
    docs.set(doc.id, doc);
  }
  write(tableId, docs);
}

/** Adds documents to a table's selection; the ones already selected elsewhere in it stay. */
export function setSelected(tableId: string, docs: SelectedDocument[]): void {
  const next = new Map(selection.get().get(tableId) ?? EMPTY);
  docs.forEach(doc => next.set(doc.id, doc));
  write(tableId, next);
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

export function selectedCount(tableId: string): number {
  return selection.get().get(tableId)?.size ?? 0;
}

/** Table ids holding a selection. The bar stamps the first onto the job it starts. */
export function selectedTableIds(): string[] {
  return [...selection.get().keys()];
}

/**
 * Selects every document the current filters match, in one request: the anonymous cap is 100 and
 * DEMI pages up to 500, so there is no paging loop to run.
 */
export async function selectAllMatching(tableId: string, params: SearchParamObject): Promise<void> {
  const results = await fetchData({ ...params, pageSize: SELECT_ALL_MAX, currentPage: 1 });
  const rows: any[] = Array.isArray(results.data) ? results.data : [];
  setSelected(
    tableId,
    rows.map(row => ({ id: row._id, displayName: row.displayName }))
  );
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

export function clearJob(): void {
  localStorage.removeItem(JOB_KEY);
  job.set(null);
}

export function useJob(): BulkDownloadJob | null {
  return useStore(job);
}
