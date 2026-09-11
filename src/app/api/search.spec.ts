import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { fetchData, SearchParamObject } from './search';
import { loadConfig } from 'app/config/config';

/**
 * Search-as-you-type hands each request the query's abort signal. An aborted request has no
 * answer, so it must reject: swallowed, it would look like a search that found nothing and blank
 * the table the user is still typing over.
 */
describe('fetchData cancellation', () => {
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn(
      async () => new Response('[{"searchResults":[],"meta":[]}]', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.__env = { logLevel: 4, SEARCH_API_PATH: '/demi-search' };
    await loadConfig();
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  function params(): SearchParamObject {
    return new SearchParamObject('search', 'caribou', 'Document');
  }

  it('passes the signal it is given down to the request', async () => {
    const controller = new AbortController();

    await fetchData(params(), controller.signal);

    expect(fetchMock.mock.calls.at(-1)?.[1]?.signal).toBe(controller.signal);
  });

  it('rejects when the request is aborted, rather than reporting no results', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(fetchData(params(), new AbortController().signal)).rejects.toThrow(/aborted/i);
  });

  it('still reports no results when the request fails for any other reason', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const results = await fetchData(params());

    expect(results.data).toEqual([]);
  });
});
