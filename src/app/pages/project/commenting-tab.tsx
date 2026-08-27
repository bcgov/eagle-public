import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { getAllByProjectId, isClosed, isNotStarted, isOpen } from 'app/api/commentperiod';
import type { CommentPeriod } from 'app/models/commentperiod';
import { mediumDate } from 'app/utils/utils';
import { useProjectContext } from './project-context';
import './commenting-tab.css';

/** Pulls the subject out of the boilerplate instructions text, e.g. "the Draft Application". */
function subjectFromInstructions(instructions: string): { subject: string; fullText: string } {
  const fullText = instructions ? instructions.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const match = fullText.match(/Comment Period on the (.*?) for /);
  return { subject: match ? match[1] : '', fullText };
}

/**
 * Comment periods, deduplicated by id and — for ENGAGE-hosted ones — by the engagement they link
 * to, since the same engagement can be synced into more than one period.
 */
function toCards(periods: CommentPeriod[]): CommentPeriod[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  return periods.filter(period => {
    const { subject, fullText } = subjectFromInstructions(period.instructions);
    period.instructions = subject;
    period.additionalText = period.additionalText || fullText || period.informationLabel;

    if (seenIds.has(period._id)) return false;
    seenIds.add(period._id);
    if (period.isMet && period.metURL) {
      if (seenUrls.has(period.metURL)) return false;
      seenUrls.add(period.metURL);
    }
    return true;
  });
}

const SKELETON_CARDS = [1, 2];

export function CommentingTab() {
  const { projId } = useProjectContext();
  const navigate = useNavigate();

  const { data: commentPeriods, isPending } = useQuery({
    queryKey: ['comment-periods', projId],
    enabled: !!projId,
    queryFn: async () => {
      const res: any = await getAllByProjectId(projId);
      return res?.data ? toCards(res.data) : [];
    }
  });

  function goToCP(commentPeriod: CommentPeriod): void {
    if (commentPeriod.isMet && commentPeriod.metURL) {
      window.open(commentPeriod.metURL, '_blank');
    } else {
      navigate(`/p/${projId}/cp/${commentPeriod._id}`);
    }
  }

  if (isPending) {
    return (
      <>
        {SKELETON_CARDS.map(index => (
          <div className="cp-card cp-card--skeleton" key={index}>
            <div className="cp-card__header">
              <div className="skeleton-cell" style={{ width: '90px', height: '12px', borderRadius: '4px' }}></div>
              <div
                className="skeleton-cell"
                style={{ width: '70px', height: '20px', borderRadius: '999px', marginLeft: 'auto' }}
              ></div>
            </div>
            <div className="cp-card__body">
              <div
                className="skeleton-cell"
                style={{ width: '55%', height: '14px', borderRadius: '4px', marginBottom: '0.5rem' }}
              ></div>
              <div
                className="skeleton-cell"
                style={{ width: '38%', height: '11px', borderRadius: '4px', marginBottom: '0.5rem' }}
              ></div>
              <div className="skeleton-cell" style={{ width: '88%', height: '11px', borderRadius: '4px' }}></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (!commentPeriods || commentPeriods.length < 1) {
    return <div>No comment periods are currently scheduled for this project.</div>;
  }

  return (
    <>
      {commentPeriods.map(cp => (
        <article className="card cp-card" key={cp._id}>
          <div className="cp-card__header">
            <span
              className={`cp-card__status-dot${isOpen(cp) ? ' cp-card__status-dot--open' : ''}${
                isNotStarted(cp) ? ' cp-card__status-dot--pending' : ''
              }${isClosed(cp) ? ' cp-card__status-dot--closed' : ''}`}
            ></span>
            <span className="cp-card__status-label">{cp.commentPeriodStatus}</span>
            {isOpen(cp) ? (
              <span className="cp-card__pill cp-card__pill--open">{cp.daysRemaining}</span>
            ) : isClosed(cp) ? (
              <span className="cp-card__pill cp-card__pill--closed">Closed {mediumDate(cp.dateCompleted)}</span>
            ) : isNotStarted(cp) ? (
              <span className="cp-card__pill cp-card__pill--pending">Starts {mediumDate(cp.dateStarted)}</span>
            ) : null}
          </div>
          <div className="cp-card__body">
            <h3 className="cp-card__title">{cp.informationLabel || cp.instructions || 'Public Comment Period'}</h3>
            {cp.dateStarted && (
              <p className="cp-card__dates">
                {mediumDate(cp.dateStarted)} – {mediumDate(cp.dateCompleted)}
              </p>
            )}
            {cp.additionalText && <p className="cp-card__description">{cp.additionalText}</p>}
            <button className="btn btn-epic-cta" onClick={() => goToCP(cp)}>
              {cp.commentPeriodStatus === 'Open' ? 'Share your thoughts' : 'View Engagement'}
            </button>
          </div>
        </article>
      ))}
    </>
  );
}
