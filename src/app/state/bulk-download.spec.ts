import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fetchData, SearchParamObject } from 'app/api/search';
import { clearToasts, useToasts } from './toast';
import {
  clearJob,
  clearSelection,
  selectAllMatching,
  SELECT_ALL_FAILED_MESSAGE,
  SELECT_ALL_MAX,
  setJob,
  setSelected,
  toggleSelected,
  useJob,
  useSelection
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
 * The job id is the capability token for the zip, so it outlives a reload: the bar resumes polling
 * instead of losing a download that is still building.
 */
describe('bulk download job', () => {
  beforeEach(() => {
    localStorage.clear();
    clearJob();
  });

  it('persists the job it is given', () => {
    setJob({ id: 'job-1', count: 3, startedAt: Date.now() });

    expect(JSON.parse(localStorage.getItem(JOB_KEY)!)).toMatchObject({ id: 'job-1', count: 3 });
    expect(renderHook(() => useJob()).result.current).toMatchObject({ id: 'job-1' });
  });

  it('forgets the job on clear', () => {
    setJob({ id: 'job-1', count: 3, startedAt: Date.now() });

    clearJob();

    expect(localStorage.getItem(JOB_KEY)).toBeNull();
    expect(renderHook(() => useJob()).result.current).toBeNull();
  });

  it('rehydrates a job stored less than an hour ago', async () => {
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify({ id: 'job-1', count: 3, startedAt: Date.now() - 60_000 })
    );
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJob()).result.current).toMatchObject({ id: 'job-1' });
  });

  it('drops a job older than an hour, zip and all', async () => {
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify({ id: 'job-1', count: 3, startedAt: Date.now() - 3_700_000 })
    );
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJob()).result.current).toBeNull();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });
});
