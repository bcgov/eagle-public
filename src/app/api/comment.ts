import * as api from './api';
import * as documentApi from './document';
import { Comment } from 'app/models/comment';
import { startLoading, stopLoading } from 'app/state/loading-state';

export async function getCountById(commentPeriodId: string): Promise<number> {
  return api.getCountCommentsById(commentPeriodId);
}

// get all comments for the specified comment period id (without documents)
export async function getByPeriodId(periodId: string, pageNum: number | null = null, pageSize: number | null = null, getCount = false): Promise<{ totalCount: string | null; currentComments: Comment[] } | null> {
  const loadingId = pageNum && pageNum > 1 ? 'comments-list' : 'comments';
  startLoading(loadingId, pageNum ? `Loading page ${pageNum}` : 'Loading comments');

  try {
    const res = await api.getCommentsByPeriodId(pageNum ? pageNum - 1 : null, pageSize, getCount, periodId);
    if (!res) {
      return null;
    }
    return {
      totalCount: res.headers.get('x-total-count'),
      currentComments: (res.body as any[]).map((comment: any) => new Comment(comment))
    };
  } finally {
    stopLoading(loadingId);
  }
}

// get a specific comment by its id (including documents)
export async function getById(commentId: string): Promise<Comment> {
  const res = await api.getComment(commentId);
  const comments = res.body as any[];
  if (!comments || comments.length === 0) {
    return null as unknown as Comment;
  }
  const comment = new Comment(comments[0]);
  // Safety check for null documents or an empty array of documents.
  if (comments[0].documents === null || (comments[0].documents && comments[0].documents.length === 0)) {
    return comment;
  }
  comment.documentsList = await documentApi.getByMultiId(comment.documents);
  return comment;
}

export async function add(orig: Comment): Promise<Comment | null> {
  // make a (deep) copy of the passed-in comment so we don't change it
  const comment = JSON.parse(JSON.stringify(orig));

  // ID must not exist on POST
  delete comment._id;

  const res = await api.addComment(comment);
  return res ? new Comment(res) : null;
}
