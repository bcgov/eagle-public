import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fetchData, SearchParamObject } from 'app/api/search';
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
  setJobStatus,
  setSelected,
  toggleSelected,
  useDownloadInProgress,
  useJobs,
  useSelection,
  type BulkDownloadJob
} from './bulk-download';

vi.mock('app/api/search', async importOriginal => ({
  ...(await importOriginal<typeof import('app/api/search')>()),
  fetchData: vi.fn()
}));

const JOB_KEY = 'epic-bulk-download-job';
const ALPHA = { id: 'doc-a', displayName: 'Alpha' };
const BETA = { id: 'doc-b', displayName: 'Beta' };

/** The store's read surface is a hook; every assertion goes through it. */
function selectionOf(tableId?: string): Map<string, { id: string; displayName: string }> {
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

/** demi-api caps an anonymous job at 100 documents, and every table's selection goes in one job. */
describe('the selection cap', () => {
  const page = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `doc-${from + i}`, displayName: `Doc ${from + i}` }));

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
    vi.mocked(fetchData).mockReset();
  });

  it('reruns the table request at page 1 and selects every row it returns', async () => {
    vi.mocked(fetchData).mockResolvedValue({
      data: [
        { _id: 'doc-a', displayName: 'Alpha' },
        { _id: 'doc-b', displayName: 'Beta' }
      ],
      totalSearchCount: 2
    } as any);
    const params = new SearchParamObject('documents', '', 'Document', [], 4, 10, '-datePosted');
    params.filters = { milestone: 'ms-1' };

    const ok = await selectAllMatching('documents', params);

    const sent = vi.mocked(fetchData).mock.calls[0][0];
    expect(sent.pageSize).toBe(100);
    expect(sent.currentPage).toBe(1);
    expect(sent.filters).toEqual({ milestone: 'ms-1' });
    expect(ok).toBe(true);
    expect([...selectionOf('documents').values()]).toEqual([
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);
  });

  it('says so when the whole matching set would pass the cap', async () => {
    setSelected(
      'search',
      Array.from({ length: SELECT_ALL_MAX }, (_, i) => ({ id: `other-${i}`, displayName: `Other ${i}` }))
    );
    vi.mocked(fetchData).mockResolvedValue({ data: [{ _id: 'doc-a', displayName: 'Alpha' }] } as any);
    clearToasts();
    const toasts = renderHook(() => useToasts());

    await selectAllMatching('documents', new SearchParamObject('documents'));

    expect(toasts.result.current.map(toast => toast.message)).toEqual([
      'You can select up to 100 documents at a time.'
    ]);
    expect(selectionOf('documents').size).toBe(0);
  });

  // fetchData never rejects, so an empty result here is a failed request masquerading as a real
  // zero: the banner only renders once the table already found more than a page of matches.
  it('says so and keeps the prior selection when the request comes back empty', async () => {
    setSelected('documents', [ALPHA]);
    // SearchResults defaults `data` to 0, not an empty array, when the response carried no results.
    vi.mocked(fetchData).mockResolvedValue({ data: 0, totalSearchCount: 0 } as any);
    clearToasts();
    const toasts = renderHook(() => useToasts());

    const ok = await selectAllMatching('documents', new SearchParamObject('documents'));

    expect(ok).toBe(false);
    expect(toasts.result.current.map(toast => toast.message)).toEqual([SELECT_ALL_FAILED_MESSAGE]);
    expect([...selectionOf('documents').keys()]).toEqual(['doc-a']);
  });
});

/**
 * The job id is the capability token for the zip, so it outlives a reload: the panel resumes
 * polling instead of losing a download that is still building. Several can be in flight at once.
 */
describe('bulk download jobs', () => {
  const job = (id: string, extra: Partial<BulkDownloadJob> = {}): BulkDownloadJob => ({
    id,
    count: 3,
    startedAt: Date.now(),
    ...extra
  });

  /** Every assertion on the store goes through the hook the panel reads. */
  const jobsNow = () => renderHook(() => useJobs()).result.current;
  const stored = () => JSON.parse(localStorage.getItem(JOB_KEY) ?? 'null');

  beforeEach(() => {
    localStorage.clear();
    dismissAll();
  });

  it('keeps every job, newest first, and persists the list', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    expect(jobsNow().map(one => one.id)).toEqual(['job-2', 'job-1']);
    expect(stored().map((one: BulkDownloadJob) => one.id)).toEqual(['job-2', 'job-1']);
  });

  it('dismisses the job asked for and leaves the others alone', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));
    addJob(job('job-3'));

    dismissJob('job-2');

    expect(jobsNow().map(one => one.id)).toEqual(['job-3', 'job-1']);
    expect(stored().map((one: BulkDownloadJob) => one.id)).toEqual(['job-3', 'job-1']);
  });

  it('forgets them all on dismissAll', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    dismissAll();

    expect(jobsNow()).toEqual([]);
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });

  it('records a status against one job only', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    setJobStatus('job-2', 'ready');

    expect(jobsNow().map(one => one.status)).toEqual(['ready', undefined]);
  });

  it('claims the download of the job asked for, once only', () => {
    addJob(job('job-1'));
    addJob(job('job-2'));

    expect(claimDownload('job-2')).toBe(true);
    // The zip only ever goes once, however often the panel re-renders.
    expect(claimDownload('job-2')).toBe(false);
    expect(jobsNow().find(one => one.id === 'job-1')?.downloadedAt).toBeUndefined();
    expect(claimDownload('job-1')).toBe(true);
  });

  it('drops the oldest finished job once the list is full', () => {
    ['job-1', 'job-2', 'job-3', 'job-4', 'job-5'].forEach(id => addJob(job(id)));
    setJobStatus('job-1', 'ready');
    setJobStatus('job-2', 'ready');

    addJob(job('job-6'));

    expect(jobsNow().map(one => one.id)).toEqual(['job-6', 'job-5', 'job-4', 'job-3', 'job-2']);
  });

  it('drops the oldest of all when none of them has finished', () => {
    ['job-1', 'job-2', 'job-3', 'job-4', 'job-5'].forEach(id => addJob(job(id)));

    addJob(job('job-6'));

    expect(jobsNow().map(one => one.id)).toEqual(['job-6', 'job-5', 'job-4', 'job-3', 'job-2']);
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

  it('rehydrates the jobs stored less than an hour ago', async () => {
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify([
        { id: 'job-1', count: 3, startedAt: Date.now() - 60_000 },
        { id: 'job-2', count: 5, startedAt: Date.now() - 30_000 }
      ])
    );
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJobs()).result.current.map(one => one.id)).toEqual(['job-1', 'job-2']);
  });

  /** An older visit stored one job as a bare object; it becomes the only job in the list. */
  it('migrates a single stored job into the list', async () => {
    localStorage.setItem(JOB_KEY, JSON.stringify({ id: 'job-1', count: 3, startedAt: Date.now() - 60_000 }));
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJobs()).result.current).toMatchObject([{ id: 'job-1', count: 3 }]);
  });

  it('drops a downloaded job on reload and keeps the zip still being built', async () => {
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify([
        { id: 'job-1', count: 3, startedAt: Date.now() - 60_000, downloadedAt: Date.now() - 1_000 },
        { id: 'job-2', count: 5, startedAt: Date.now() - 30_000 }
      ])
    );
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJobs()).result.current.map(one => one.id)).toEqual(['job-2']);
    expect(stored().map((one: BulkDownloadJob) => one.id)).toEqual(['job-2']);
  });

  it('drops a job older than an hour, zip and all', async () => {
    localStorage.setItem(JOB_KEY, JSON.stringify([{ id: 'job-1', count: 3, startedAt: Date.now() - 3_700_000 }]));
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJobs()).result.current).toEqual([]);
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });
});
