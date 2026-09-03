import { isClosed, isNotStarted, isOpen } from 'app/api/commentperiod';
import type { CommentPeriod } from 'app/models/commentperiod';
import { mediumDate } from 'app/utils/utils';
import './comment-period-card.css';

const SKELETON_CARDS = [1, 2];

interface CommentPeriodCardsProps {
  periods: CommentPeriod[] | null | undefined;
  loading: boolean;
  emptyMessage: string;
  onOpen: (period: CommentPeriod) => void;
}

export function CommentPeriodCards({
  periods,
  loading,
  emptyMessage,
  onOpen,
}: CommentPeriodCardsProps) {
  if (loading) {
    return (
      <>
        {SKELETON_CARDS.map((index) => (
          <div className="cp-card cp-card--skeleton" key={index}>
            <div className="cp-card__header">
              <div className="skeleton-cell cp-card__skeleton-status"></div>
              <div className="skeleton-cell cp-card__skeleton-pill"></div>
            </div>
            <div className="cp-card__body">
              <div className="skeleton-cell cp-card__skeleton-title"></div>
              <div className="skeleton-cell cp-card__skeleton-dates"></div>
              <div className="skeleton-cell cp-card__skeleton-text"></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (!periods || periods.length < 1) {
    return <div className="py-2 px-3">{emptyMessage}</div>;
  }

  return (
    <>
      {periods.map((cp) => (
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
              <span className="cp-card__pill cp-card__pill--closed">
                Closed {mediumDate(cp.dateCompleted)}
              </span>
            ) : isNotStarted(cp) ? (
              <span className="cp-card__pill cp-card__pill--pending">
                Starts {mediumDate(cp.dateStarted)}
              </span>
            ) : null}
          </div>
          <div className="cp-card__body">
            <h3 className="cp-card__title">
              {cp.informationLabel || cp.instructions || 'Public Comment Period'}
            </h3>
            {cp.dateStarted && (
              <p className="cp-card__dates">
                {mediumDate(cp.dateStarted)} – {mediumDate(cp.dateCompleted)}
              </p>
            )}
            {cp.additionalText && <p className="cp-card__description">{cp.additionalText}</p>}
            <button className="btn btn-epic-cta" onClick={() => onOpen(cp)}>
              {cp.commentPeriodStatus === 'Open' ? 'Share your thoughts' : 'View Engagement'}
            </button>
          </div>
        </article>
      ))}
    </>
  );
}
