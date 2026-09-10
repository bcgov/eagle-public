import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getByPeriodId } from './comment';
import { loadConfig } from 'app/config/config';

/**
 * The comment reads, seen from the layer the comments page calls.
 *
 * The total lives in the `/search` envelope's `meta`, and the page number is one-based here but
 * zero-based on the wire. Both are invisible in the rendered table until the pager sends readers to
 * the wrong page or the table claims there are no comments.
 */
describe('comment reads', () => {
  const SEARCH = '/demi-search';
  const original = window.__env;
  let fetchMock: ReturnType<typeof vi.fn>;

  const ROWS = [
    { _id: 'c1', commentId: 2, author: 'Jane', comment: 'Second comment' },
    { _id: 'c2', commentId: 1, comment: 'First comment' },
  ];

  const DEMI_PAGE = JSON.stringify([{ searchResults: ROWS, meta: [{ searchResultsTotal: 783 }] }]);

  function respondWith(body: string): void {
    fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  }

  function requestedUrl(): string {
    return fetchMock.mock.calls[0][0] as string;
  }

  async function setup(): Promise<void> {
    window.__env = { logLevel: 4, SEARCH_API_PATH: SEARCH };
    await loadConfig();
  }

  beforeEach(() => {
    respondWith('[]');
  });

  afterEach(() => {
    window.__env = original;
    vi.unstubAllGlobals();
  });

  describe('getByPeriodId', () => {
    it('reads the count off the envelope demi-search answers with', async () => {
      await setup();
      respondWith(DEMI_PAGE);

      const page = await getByPeriodId('cp-1', 1, 10);

      expect(page?.totalCount).toBe(783);
      expect(page?.currentComments.map((comment) => comment.comment)).toEqual([
        'Second comment',
        'First comment',
      ]);
    });

    // The table numbers its pages from one and both backends number theirs from zero.
    it('asks for the first page when the table is showing page one', async () => {
      await setup();
      respondWith(DEMI_PAGE);

      await getByPeriodId('cp-1', 1, 10);

      expect(new URL(requestedUrl(), 'http://x').searchParams.get('pageNum')).toBe('0');
    });

    it('asks for the fourth page when the table is showing page four', async () => {
      await setup();
      respondWith(DEMI_PAGE);

      await getByPeriodId('cp-1', 4, 10);

      expect(new URL(requestedUrl(), 'http://x').searchParams.get('pageNum')).toBe('3');
    });
  });
});
