import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { searchKeywords } from './api';
import { loadConfig } from 'app/config/config';

/**
 * Every dataset the app searches goes to demi-search. Getting this wrong is invisible in the UI —
 * results still render, they just come from somewhere else or not at all.
 */
describe('search routing', () => {
  const SEARCH = 'https://eagle-search-api-dev.azurewebsites.net';
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(
      async () => new Response('[{"searchResults":[],"meta":[]}]', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  async function urlFor(dataset: string): Promise<string> {
    fetchMock.mockClear();
    await searchKeywords('cariboo', dataset, [], 1, 10);
    return fetchMock.mock.calls[0][0] as string;
  }

  /** Every dataset the app reads. */
  const DATASETS = [
    'Project',
    'Document',
    'DocumentChunk',
    'List',
    'Organization',
    'RecentActivity',
    'ProjectNotification',
    'CommentPeriod',
    'Comment',
  ];

  it('sends every dataset to demi-search', async () => {
    window.__env = { logLevel: 4, SEARCH_API_PATH: SEARCH };
    await loadConfig();

    for (const dataset of DATASETS) {
      expect(await urlFor(dataset)).toBe(
        `${SEARCH}/search?dataset=${dataset}&keywords=cariboo&pageNum=0&pageSize=10&projectLegislation=default&populate=false&fuzzy=false`,
      );
    }
  });
});
