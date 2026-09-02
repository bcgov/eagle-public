import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBulkDownload, getBulkDownload } from './api';
import { loadConfig } from 'app/config/config';

/**
 * Bulk download rides the DEMI search base path, and its failures have to reach the caller with a
 * status: the bulk bar says "you have reached the download limit" on 429 and "try again" on 503,
 * which it cannot tell apart from a bare Error.
 */
describe('bulk download requests', () => {
  const originalEnv = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '/demi-search' };
    await loadConfig();
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  function respondWith(body: unknown, status = 200): void {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, statusText: String(status) }));
    vi.stubGlobal('fetch', fetchMock);
  }

  it('posts the document ids as JSON to the search base path', async () => {
    respondWith({ id: 'job-1', status: 'queued', documentCount: 2, estimatedPartCount: 1, statusUrl: '/x' }, 202);

    const accepted = await createBulkDownload(['doc-a', 'doc-b']);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/demi-search/bulk-downloads');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ documentIds: ['doc-a', 'doc-b'] });
    expect(accepted).toMatchObject({ id: 'job-1', estimatedPartCount: 1 });
  });

  it('reads a job status by id', async () => {
    respondWith({ id: 'job-1', status: 'ready', partsReady: 2, partCount: 2 });

    const job = await getBulkDownload('job-1');

    expect(fetchMock.mock.calls[0][0]).toBe('/demi-search/bulk-downloads/job-1');
    expect(job.status).toBe('ready');
  });

  it('rejects with the 429 status when the caller is over the in-flight cap', async () => {
    respondWith({ error: 'too many' }, 429);

    await expect(createBulkDownload(['doc-a', 'doc-b'])).rejects.toMatchObject({ name: 'ApiError', status: 429 });
  });

  it('rejects with the 503 status when demi-api is unavailable', async () => {
    respondWith({ error: 'unavailable' }, 503);

    await expect(getBulkDownload('job-1')).rejects.toMatchObject({ name: 'ApiError', status: 503 });
  });
});
