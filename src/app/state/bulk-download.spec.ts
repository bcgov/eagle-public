import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readDocuments, type DocumentQuery } from 'app/api/document';
import { Document } from 'app/models/document';
import { clearToasts, useToasts } from './toast';
import {
  addJob,
  claimDownload,
  clearSelection,
  dismissAll,
  dismissJob,
  selectAllMatching,
  SELECT_ALL_FAILED_MESSAGE,
  SELECT_ALL_MAX,
  selectionSummary,
  setJobStatus,
  setSelected,
  toggleSelected,
  useDownloadInProgress,
  useJobs,
  useSelection,
  type BulkDownloadJob,
  type TableSelection,
} from './bulk-download';

vi.mock('app/api/document', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/api/document')>()),
  readDocuments: vi.fn(),
}));

/** The table query select-all reruns: page 4 of ten, newest first, one milestone. */
const QUERY: DocumentQuery = {
  projId: 'eagle-1',
  page: 4,
  pageSize: 10,
  sortBy: '-datePosted',
  filters: { milestoneId: ['ms-1'] },
};

/** A page `readDocuments` answers, from `_id`/`displayName` pairs. */
function documents(rows: { _id: string; displayName?: string; internalSize?: string }[]) {
  return { rows: rows.map((row) => new Document(row)), total: rows.length };
}

const ALPHA = { id: 'doc-a', displayName: 'Alpha' };
const BETA = { id: 'doc-b', displayName: 'Beta' };

/** The store's read surface is a hook; every assertion goes through it. */
function selectionOf(tableId?: string): TableSelection {
  return renderHook(() => useSelection(tableId)).result.current;
}

describe('bulk download selection', () => {
  beforeEach(() => {
    clearSelection();
  });

  it('toggles a document in and back out of a table', () => {
    toggleSelected('documents', ALPHA);
    expect([...selectionOf('documents').keys()]).toEqual(['doc-a']);

    toggleSelected('documents', ALPHA);
    expect(selectionOf('documents').size).toBe(0);
  });

  it('adds a page of documents without dropping what is already selected', () => {
    toggleSelected('documents', ALPHA);

    setSelected('documents', [BETA]);

    expect([...selectionOf('documents').keys()]).toEqual(['doc-a', 'doc-b']);
  });

  it('keeps each table separate, and clears one without clearing the other', () => {
    setSelected('documents', [ALPHA]);
    setSelected('search', [BETA]);

    clearSelection('documents');

    expect(selectionOf('documents').size).toBe(0);
    expect([...selectionOf('search').keys()]).toEqual(['doc-b']);
  });

  it('merges every table for the bar, and clears them all at once', () => {
    setSelected('documents', [ALPHA]);
    setSelected('search', [BETA]);

    expect([...selectionOf().keys()]).toEqual(['doc-a', 'doc-b']);

    clearSelection();

    expect(selectionOf().size).toBe(0);
  });
});

/** The bar's estimate: rows carry `internalSize`, and plenty of them carry nothing. */
describe('the size of a selection', () => {
  beforeEach(() => {
    clearSelection();
  });

  it('sums the sizes it knows and counts the documents carrying none', () => {
    setSelected('documents', [
      { id: 'doc-a', displayName: 'Alpha', size: 2 * 1024 * 1024 },
      { id: 'doc-b', displayName: 'Beta', size: 3 * 1024 * 1024 },
      { id: 'doc-c', displayName: 'Gamma' },
    ]);

    expect(selectionSummary(selectionOf('documents'))).toEqual({
      bytes: 5 * 1024 * 1024,
      unknownCount: 1,
    });
  });

  it('knows nothing about a selection where no size came through', () => {
    setSelected('documents', [ALPHA, BETA]);

    expect(selectionSummary(selectionOf('documents'))).toEqual({ bytes: 0, unknownCount: 2 });
  });

  it('adds up every table, because they are downloaded as one job', () => {
    setSelected('documents', [{ id: 'doc-a', displayName: 'Alpha', size: 1024 }]);
    setSelected('search', [{ id: 'doc-b', displayName: 'Beta', size: 2048 }]);

    expect(selectionSummary(selectionOf())).toEqual({ bytes: 3072, unknownCount: 0 });
  });
});

/** demi-api caps an anonymous job at 100 documents, and every table's selection goes in one job. */
describe('the selection cap', () => {
  const page = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `doc-${from + i}`,
      displayName: `Doc ${from + i}`,
    }));

  beforeEach(() => {
    clearSelection();
  });

  it('refuses the document past the cap and keeps the ones already selected', () => {
    setSelected('documents', page(1, SELECT_ALL_MAX));

    expect(toggleSelected('documents', { id: 'doc-101', displayName: 'Doc 101' })).toBe(false);
    expect(selectionOf('documents').size).toBe(SELECT_ALL_MAX);
    expect(selectionOf('documents').has('doc-101')).toBe(false);
  });

  it('deselects at the cap, which frees a slot', () => {
    setSelected('documents', page(1, SELECT_ALL_MAX));

    expect(toggleSelected('documents', { id: 'doc-1', displayName: 'Doc 1' })).toBe(true);
    expect(toggleSelected('documents', { id: 'doc-101', displayName: 'Doc 101' })).toBe(true);
    expect(selectionOf('documents').size).toBe(SELECT_ALL_MAX);
  });

  it('refuses a whole page rather than filling the last slots of it', () => {
    setSelected('documents', page(1, SELECT_ALL_MAX));

    expect(setSelected('documents', page(101, 100))).toBe(false);
    expect(selectionOf('documents').size).toBe(SELECT_ALL_MAX);
  });

  // The bar posts every table merged, so a second table cannot start its own 100.
  it('counts what other tables hold against the cap', () => {
    setSelected('documents', page(1, SELECT_ALL_MAX));

    expect(setSelected('search', page(101, 1))).toBe(false);
    expect(selectionOf('search').size).toBe(0);
  });
});

describe('selectAllMatching', () => {
  beforeEach(() => {
    clearSelection();
    vi.mocked(readDocuments).mockReset();
  });

  it('reruns the table request at page 1, a full page of 100, and selects every row it returns', async () => {
    vi.mocked(readDocuments).mockResolvedValue(
      documents([
        { _id: 'doc-a', displayName: 'Alpha' },
        { _id: 'doc-b', displayName: 'Beta', internalSize: '2048' },
      ]),
    );

    const ok = await selectAllMatching('documents', QUERY);

    expect(vi.mocked(readDocuments).mock.calls[0][0]).toEqual({
      ...QUERY,
      page: 1,
      pageSize: 100,
    });
    expect(ok).toBe(true);
    expect([...selectionOf('documents').values()]).toEqual([
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta', size: 2048 },
    ]);
  });

  it('trims the fetched page to the cap instead of refusing it, keeping a row from outside it', async () => {
    setSelected('documents', [{ id: 'row-150', displayName: 'Row 150' }]);
    vi.mocked(readDocuments).mockResolvedValue(
      documents(
        Array.from({ length: SELECT_ALL_MAX }, (_, i) => ({
          _id: `row-${i}`,
          displayName: `Row ${i}`,
        })),
      ),
    );

    const ok = await selectAllMatching('documents', QUERY);

    expect(ok).toBe(true);
    expect(selectionOf('documents').size).toBe(SELECT_ALL_MAX);
    expect(selectionOf('documents').has('row-150')).toBe(true);
  });

  it('says so when the whole matching set would pass the cap', async () => {
    setSelected(
      'search',
      Array.from({ length: SELECT_ALL_MAX }, (_, i) => ({
        id: `other-${i}`,
        displayName: `Other ${i}`,
      })),
    );
    vi.mocked(readDocuments).mockResolvedValue(documents([{ _id: 'doc-a', displayName: 'Alpha' }]));
    clearToasts();
    const toasts = renderHook(() => useToasts());

    await selectAllMatching('documents', QUERY);

    expect(toasts.result.current.map((toast) => toast.message)).toEqual([
      'You can select up to 100 documents at a time.',
    ]);
    expect(selectionOf('documents').size).toBe(0);
  });

  // The banner only renders once the table already found more than a page of matches, so a failed
  // read and an empty answer both mean the request went wrong, not a real zero.
  it.each([
    ['fails', () => vi.mocked(readDocuments).mockRejectedValue(new Error('400 Bad Request'))],
    ['comes back empty', () => vi.mocked(readDocuments).mockResolvedValue(documents([]))],
  ])('says so and keeps the prior selection when the request %s', async (_case, answer) => {
    setSelected('documents', [ALPHA]);
    answer();
    clearToasts();
    const toasts = renderHook(() => useToasts());

    const ok = await selectAllMatching('documents', QUERY);

    expect(ok).toBe(false);
    expect(toasts.result.current.map((toast) => toast.message)).toEqual([
      SELECT_ALL_FAILED_MESSAGE,
    ]);
    expect([...selectionOf('documents').keys()]).toEqual(['doc-a']);
  });
});

/** Jobs live in memory only, and several can be in flight at once. */
describe('bulk download jobs', () => {
  const job = (id: string, extra: Partial<BulkDownloadJob> = {}): BulkDownloadJob => ({
    id,
    count: 3,
    startedAt: Date.now(),
    ...extra,
  });

  /** Every assertion on the store goes through the hook the panel reads. */
  const jobsNow = () => renderHook(() => useJobs()).result.current;

  beforeEach(() => {
    dismissAll();
  });

  it('keeps every job, newest first', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    expect(jobsNow().map((one) => one.id)).toEqual(['job-2', 'job-1']);
  });

  it('dismisses the job asked for and leaves the others alone', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));
    addJob(job('job-3'));

    dismissJob('job-2');

    expect(jobsNow().map((one) => one.id)).toEqual(['job-3', 'job-1']);
  });

  it('forgets them all on dismissAll', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    dismissAll();

    expect(jobsNow()).toEqual([]);
  });

  it('records a status against one job only', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    setJobStatus('job-2', 'ready');

    expect(jobsNow().map((one) => one.status)).toEqual(['ready', undefined]);
  });

  it('claims the download of the job asked for, once only', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    expect(claimDownload('job-2')).toBe(true);
    // The zip only ever goes once, however often the panel re-renders.
    expect(claimDownload('job-2')).toBe(false);
    expect(jobsNow().find((one) => one.id === 'job-1')?.downloadedAt).toBeUndefined();
    expect(claimDownload('job-1')).toBe(true);
  });

  // job-1 is older than the finished job, so a plain "drop the last" would take the zip still running.
  it('drops the oldest finished job once the list is full', () => {
    ['job-1', 'job-2', 'job-3', 'job-4', 'job-5'].forEach((id) => addJob(job(id)));
    setJobStatus('job-2', 'ready');
    setJobStatus('job-4', 'ready');

    addJob(job('job-6'));

    expect(jobsNow().map((one) => one.id)).toEqual(['job-6', 'job-5', 'job-4', 'job-3', 'job-1']);
  });

  it('drops the oldest of all when none of them has finished', () => {
    ['job-1', 'job-2', 'job-3', 'job-4', 'job-5'].forEach((id) => addJob(job(id)));

    addJob(job('job-6'));

    expect(jobsNow().map((one) => one.id)).toEqual(['job-6', 'job-5', 'job-4', 'job-3', 'job-2']);
  });

  /** demi-api runs three jobs at once per requester and answers 429 above that. */
  it('holds the next download back only once three jobs are in flight', () => {
    const inFlight = renderHook(() => useDownloadInProgress());

    addJob(job('job-1'));
    addJob(job('job-2'));
    inFlight.rerender();
    expect(inFlight.result.current).toBe(false);

    addJob(job('job-3'));
    inFlight.rerender();
    expect(inFlight.result.current).toBe(true);

    // A job that reached its last status is not still being prepared.
    setJobStatus('job-1', 'ready');
    inFlight.rerender();
    expect(inFlight.result.current).toBe(false);
  });

  /** A cancelled job is finished as far as the toolbar is concerned. */
  it('releases the next download when a job is cancelled', () => {
    const inFlight = renderHook(() => useDownloadInProgress());
    ['job-1', 'job-2', 'job-3'].forEach((id) => addJob(job(id)));
    inFlight.rerender();
    expect(inFlight.result.current).toBe(true);

    setJobStatus('job-1', 'cancelled');
    inFlight.rerender();

    expect(inFlight.result.current).toBe(false);
  });
});
