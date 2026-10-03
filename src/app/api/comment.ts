import * as api from './api';
import { Comment } from 'app/models/comment';

// get all comments for the specified comment period id (without documents)
export async function getByPeriodId(
  periodId: string,
  pageNum: number | null = null,
  pageSize: number | null = null,
): Promise<{ totalCount: number | null; currentComments: Comment[] } | null> {
  const res = await api.getCommentsByPeriodId(pageNum ? pageNum - 1 : null, pageSize, periodId);
  if (!res) {
    return null;
  }
  return {
    totalCount: res.totalCount,
    currentComments: res.comments.map((comment: any) => new Comment(comment)),
  };
}
