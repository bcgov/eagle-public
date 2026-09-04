import { useNavigate } from 'react-router';
import { CommentPeriodCards } from 'app/components/comment-period-card';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import type { CommentPeriod } from 'app/models/commentperiod';
import { openExternal } from 'app/utils/safe-url';
import { useProjectContext } from './project-context';

export function CommentingTab() {
  const { projId } = useProjectContext();
  const navigate = useNavigate();

  const { data: commentPeriods, isPending } = useCommentPeriods(projId);

  function goToCP(commentPeriod: CommentPeriod): void {
    if (commentPeriod.isMet && commentPeriod.metURL) {
      openExternal(commentPeriod.metURL);
    } else {
      navigate(`/p/${projId}/cp/${commentPeriod._id}`);
    }
  }

  return (
    <CommentPeriodCards
      periods={commentPeriods}
      loading={isPending}
      emptyMessage="No comment periods are currently scheduled for this project."
      onOpen={goToCP}
    />
  );
}
