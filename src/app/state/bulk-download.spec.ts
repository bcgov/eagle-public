import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fetchData, SearchParamObject } from 'app/api/search';
import {
  clearJob,
  clearSelection,
  selectAllMatching,
  selectedCount,
  selectedTableIds,
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
    expect(selectedCount('documents')).toBe(0);
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

    expect(selectedCount('documents')).toBe(0);
    expect(selectedCount('search')).toBe(1);
    expect(selectedTableIds()).toEqual(['search']);
  });

  it('merges every table for the bar, and clears them all at once', () => {
    setSelected('documents', [ALPHA]);
    setSelected('search', [BETA]);

    expect([...selectionOf().keys()]).toEqual(['doc-a', 'doc-b']);

    clearSelection();

    expect(selectionOf().size).toBe(0);
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

    await selectAllMatching('documents', params);

    const sent = vi.mocked(fetchData).mock.calls[0][0];
    expect(sent.pageSize).toBe(100);
    expect(sent.currentPage).toBe(1);
    expect(sent.filters).toEqual({ milestone: 'ms-1' });
    expect([...selectionOf('documents').values()]).toEqual([
      { id: 'doc-a', displayName: 'Alpha' },
      { id: 'doc-b', displayName: 'Beta' }
    ]);
  });

  it('selects nothing when the search comes back empty', async () => {
    // SearchResults defaults `data` to 0, not an empty array, when the response carried no results.
    vi.mocked(fetchData).mockResolvedValue({ data: 0, totalSearchCount: 0 } as any);

    await selectAllMatching('documents', new SearchParamObject('documents'));

    expect(selectedCount('documents')).toBe(0);
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
    setJob({ id: 'job-1', tableId: 'documents', count: 3, startedAt: Date.now() });

    expect(JSON.parse(localStorage.getItem(JOB_KEY)!)).toMatchObject({ id: 'job-1', count: 3 });
    expect(renderHook(() => useJob()).result.current).toMatchObject({ id: 'job-1' });
  });

  it('forgets the job on clear', () => {
    setJob({ id: 'job-1', tableId: 'documents', count: 3, startedAt: Date.now() });

    clearJob();

    expect(localStorage.getItem(JOB_KEY)).toBeNull();
    expect(renderHook(() => useJob()).result.current).toBeNull();
  });

  it('rehydrates a job stored less than an hour ago', async () => {
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify({ id: 'job-1', tableId: 'documents', count: 3, startedAt: Date.now() - 60_000 })
    );
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJob()).result.current).toMatchObject({ id: 'job-1' });
  });

  it('drops a job older than an hour, zip and all', async () => {
    localStorage.setItem(
      JOB_KEY,
      JSON.stringify({ id: 'job-1', tableId: 'documents', count: 3, startedAt: Date.now() - 3_700_000 })
    );
    vi.resetModules();

    const store = await import('./bulk-download');

    expect(renderHook(() => store.useJob()).result.current).toBeNull();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });
});
