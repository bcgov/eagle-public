import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getByPeriodId, getById } from './comment';
import { loadConfig } from 'app/config/config';

/**
 * The comment reads, seen from the layer the comments page calls.
 *
 * The two backends disagree about where the total lives - eagle-api counts into an
 * `x-total-count` header, demi-search into the `/search` envelope's `meta` - and the page number
 * is one-based here but zero-based on the wire. Both are invisible in the rendered table until
 * the pager sends readers to the wrong page or the table claims there are no comments.
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

  function respondWith(body: string, headers: Record<string, string> = {}): void {
    fetchMock = vi.fn(async () => new Response(body, { status: 200, headers }));
    vi.stubGlobal('fetch', fetchMock);
  }

  function requestedUrl(): string {
    return fetchMock.mock.calls[0][0] as string;
  }

  async function setup(searchApiPath: string): Promise<void> {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: searchApiPath };
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
    it('reads the count off the header when eagle-api answers', async () => {
      await setup('');
      respondWith(JSON.stringify(ROWS), { 'x-total-count': '783' });

      const page = await getByPeriodId('cp-1', 1, 10, true);

      expect(page?.totalCount).toBe(783);
      expect(page?.currentComments.map((comment) => comment.comment)).toEqual([
        'Second comment',
        'First comment',
      ]);
    });

    it('reads the count off the envelope when demi-search answers', async () => {
      await setup(SEARCH);
      respondWith(DEMI_PAGE);

      const page = await getByPeriodId('cp-1', 1, 10, true);

      expect(page?.totalCount).toBe(783);
      expect(page?.currentComments.map((comment) => comment.comment)).toEqual([
        'Second comment',
        'First comment',
      ]);
    });

    // The table numbers its pages from one and both backends number theirs from zero.
    it('asks for the first page when the table is showing page one', async () => {
      await setup(SEARCH);
      respondWith(DEMI_PAGE);

      await getByPeriodId('cp-1', 1, 10, true);

      expect(new URL(requestedUrl(), 'http://x').searchParams.get('pageNum')).toBe('0');
    });

    it('asks for the fourth page when the table is showing page four', async () => {
      await setup(SEARCH);
      respondWith(DEMI_PAGE);

      await getByPeriodId('cp-1', 4, 10, true);

      expect(new URL(requestedUrl(), 'http://x').searchParams.get('pageNum')).toBe('3');
    });
  });

  describe('getById', () => {
    it('returns the comment with its attachments resolved', async () => {
      await setup('');
      let call = 0;
      fetchMock = vi.fn(async () => {
        const body =
          call++ === 0
            ? JSON.stringify([{ _id: 'c1', comment: 'With an attachment', documents: ['doc-1'] }])
            : JSON.stringify([{ _id: 'doc-1', internalOriginalName: 'attachment.pdf' }]);
        return new Response(body, { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);

      const comment = await getById('c1');

      expect(comment.comment).toBe('With an attachment');
      expect(
        comment.documentsList.map((document: { internalOriginalName: string }) => {
          return document.internalOriginalName;
        }),
      ).toEqual(['attachment.pdf']);
    });

    it('answers null when nothing matches the id', async () => {
      await setup('');
      respondWith(JSON.stringify([]));

      expect(await getById('missing')).toBeNull();
    });
  });
});
