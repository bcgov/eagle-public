import * as api from './api';
import { Comment } from 'app/models/comment';

/** A comment as DEMI's `/comments` answers it. */
interface NativeComment {
  id: string;
  [field: string]: unknown;
}

/** One page of a comment period's comments, newest first, with the total; `pageNum` is one-based. */
export async function getByPeriodId(
  periodId: string,
  pageNum: number | null = null,
  pageSize: number | null = null,
): Promise<{ totalCount: number | null; currentComments: Comment[] }> {
  const { rows, total } = await api.listNative<NativeComment>('comments', {
    filters: { period: periodId },
    page: pageNum ?? undefined,
    pageSize: pageSize ?? undefined,
    count: true,
    // DEMI sorts comments on `dateAdded` only; the old `-commentId` followed the same order.
    sort: '-dateAdded',
  });
  return {
    totalCount: total ?? null,
    currentComments: rows.map(({ id, ...comment }) => new Comment({ ...comment, _id: id })),
  };
}
