import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { searchKeywords } from './api';
import { loadConfig } from 'app/config/config';

/**
 * Which backend does a search go to?
 *
 * Project, Document and DocumentChunk move to eagle-search (Azure AI Search) when SEARCH_API_PATH
 * is set; everything else stays on eagle-api. Getting this wrong is invisible in the UI — results
 * still render, they just come from the wrong place, or the kill switch silently fails to work.
 */
describe('search routing', () => {
  const SEARCH = 'https://eagle-search-api-dev.azurewebsites.net';
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('[{"searchResults":[],"meta":[]}]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  async function setup(searchApiPath: string): Promise<void> {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: searchApiPath };
    await loadConfig();
  }

  async function urlFor(dataset: string): Promise<string> {
    fetchMock.mockClear();
    await searchKeywords('cariboo', dataset, [], 1, 10);
    return fetchMock.mock.calls[0][0] as string;
  }

  it('routes Project, Document and DocumentChunk to eagle-search when configured', async () => {
    await setup(SEARCH);
    for (const dataset of ['Project', 'Document', 'DocumentChunk']) {
      expect(await urlFor(dataset)).toContain(SEARCH);
    }
  });

  it('leaves every other dataset on eagle-api', async () => {
    await setup(SEARCH);
    for (const dataset of ['RecentActivity', 'ProjectNotification', 'Organization']) {
      const url = await urlFor(dataset);
      expect(url).not.toContain(SEARCH);
      expect(url.startsWith('/api/')).toBe(true);
    }
  });

  // The kill switch. Clearing SEARCH_API_PATH must send everything back to eagle-api with no
  // redeploy — a kill switch that has never been exercised is not a kill switch.
  it('falls back to eagle-api when SEARCH_API_PATH is empty', async () => {
    await setup('');
    for (const dataset of ['Project', 'Document', 'DocumentChunk']) {
      const url = await urlFor(dataset);
      expect(url).not.toContain(SEARCH);
      expect(url.startsWith('/api/')).toBe(true);
    }
  });
});
