import { useNavigate } from 'react-router';
import { isClosed, isNotStarted, isOpen } from 'app/api/commentperiod';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import type { CommentPeriod } from 'app/models/commentperiod';
import { openExternal } from 'app/utils/safe-url';
import { mediumDate } from 'app/utils/utils';
import { useProjectContext } from './project-context';
import './engagement-tab.css';

const SKELETON_CARDS = [1, 2];

/** The pill beside the status label: how long is left, or when the period ran. */
function pill(cp: CommentPeriod): { text: string; modifier: string } | null {
  if (isOpen(cp)) return { text: cp.daysRemaining, modifier: 'open' };
  if (isClosed(cp)) return { text: `Closed ${mediumDate(cp.dateCompleted)}`, modifier: 'closed' };
  if (isNotStarted(cp))
    return { text: `Starts ${mediumDate(cp.dateStarted)}`, modifier: 'pending' };
  return null;
}

export function EngagementTab() {
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
    <div className="engagement-tab">
      <h2 className="engagement-tab__title">Engagement</h2>

      {isPending ? (
        <ul className="engagement-tab__list" aria-busy="true">
          <li className="visually-hidden">Loading</li>
          {SKELETON_CARDS.map((index) => (
            <li className="engagement-tab__card placeholder-wave" key={index} aria-hidden="true">
              <span className="placeholder col-4"></span>
              <span className="placeholder col-8"></span>
              <span className="placeholder col-6"></span>
            </li>
          ))}
        </ul>
      ) : !commentPeriods || commentPeriods.length < 1 ? (
        <p className="engagement-tab__empty">
          No comment periods are currently scheduled for this project.
        </p>
      ) : (
        <ul className="engagement-tab__list">
          {commentPeriods.map((cp) => {
            const badge = pill(cp);
            return (
              <li className="engagement-tab__card" key={cp._id}>
                <p className="engagement-tab__status">
                  <span className="engagement-tab__status-label">{cp.commentPeriodStatus}</span>
                  {badge && (
                    <span
                      className={`engagement-tab__pill engagement-tab__pill--${badge.modifier}`}
                    >
                      {badge.text}
                    </span>
                  )}
                </p>
                <h3 className="engagement-tab__card-title">
                  {cp.informationLabel || cp.instructions || 'Public Comment Period'}
                </h3>
                {cp.dateStarted && (
                  <p className="engagement-tab__dates">
                    {mediumDate(cp.dateStarted)} – {mediumDate(cp.dateCompleted)}
                  </p>
                )}
                {cp.additionalText && (
                  <p className="engagement-tab__description">{cp.additionalText}</p>
                )}
                <button type="button" className="engagement-tab__cta" onClick={() => goToCP(cp)}>
                  {isOpen(cp) ? 'Share your thoughts' : 'View Engagement'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
