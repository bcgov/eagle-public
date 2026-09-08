import * as api from './api';
import { Comment } from 'app/models/comment';

// get all comments for the specified comment period id (without documents)
export async function getByPeriodId(
  periodId: string,
  pageNum: number | null = null,
  pageSize: number | null = null,
  getCount = false,
): Promise<{ totalCount: number | null; currentComments: Comment[] } | null> {
  const res = await api.getCommentsByPeriodId(
    pageNum ? pageNum - 1 : null,
    pageSize,
    getCount,
    periodId,
  );
  if (!res) {
    return null;
  }
  return {
    totalCount: res.totalCount,
    currentComments: res.comments.map((comment: any) => new Comment(comment)),
  };
}

export async function add(orig: Comment): Promise<Comment | null> {
  // make a (deep) copy of the passed-in comment so we don't change it
  const comment = JSON.parse(JSON.stringify(orig));

  // ID must not exist on POST
  delete comment._id;

  const res = await api.addComment(comment);
  return res ? new Comment(res) : null;
}
