import { inlineCommentPeriod } from 'app/api/notification';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import type { CommentPeriod } from 'app/models/commentperiod';
import type { NotificationFacts } from 'app/models/project';

/**
 * The periods the Engagement tab lists. A notification with no period records, or whose period
 * query failed, falls back to the period held on the notification itself.
 */
export function useEngagementPeriods(
  projId: string,
  notification: NotificationFacts | undefined,
): { periods: CommentPeriod[] | undefined; isPending: boolean } {
  const { data, isPending } = useCommentPeriods(projId);
  const inline =
    (!Array.isArray(data) || data.length === 0) && notification
      ? inlineCommentPeriod(projId, notification)
      : null;
  return { periods: inline ? [inline] : data, isPending };
}
