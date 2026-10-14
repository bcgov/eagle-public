import { describe, it, expect, afterEach, vi } from 'vitest';
import { native, stubFetch } from 'app/pages/home/home-fetch.spec-helper';
import { getByPeriodId } from './comment';

/**
 * The comment reads, seen from the layer the comments page calls. The total rides in DEMI's
 * `x-total-count` header, and the table's page number goes out as DEMI's one-based `page`.
 */
describe('getByPeriodId', () => {
  const ROWS = [
    { id: 'c1', commentId: 2, author: 'Jane', comment: 'Second comment' },
    { id: 'c2', commentId: 1, comment: 'First comment' },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks DEMI for one counted page of the period's comments, newest first", async () => {
    const requests = stubFetch(() => native(ROWS, 783));

    await getByPeriodId('cp-1', 4, 10);

    expect(requests).toEqual([
      '/demi/api/comments?page=4&pageSize=10&count=true&sort=-dateAdded&period=cp-1',
    ]);
  });

  it('reads the total off the count header', async () => {
    stubFetch(() => native(ROWS, 783));

    expect((await getByPeriodId('cp-1', 1, 10)).totalCount).toBe(783);
  });

  it('keeps each comment under the id the table keys rows on', async () => {
    stubFetch(() => native(ROWS));

    const page = await getByPeriodId('cp-1', 1, 10);

    expect(page.currentComments.map((comment) => [comment._id, comment.comment])).toEqual([
      ['c1', 'Second comment'],
      ['c2', 'First comment'],
    ]);
  });
});
