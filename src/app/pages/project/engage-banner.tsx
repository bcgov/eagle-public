import type { CommentPeriod } from 'app/models/commentperiod';
import './engage-banner.css';

/** Angular's `date:'MMM d, yyyy':'UTC'` — engagement dates are stored as plain UTC days. */
function utcMediumDate(value: Date): string {
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Banner for a comment period hosted on ENGAGE, linking out to the engagement itself. */
export function EngageBanner({ data }: { data: CommentPeriod }) {
  const status = data.bannerState;

  return (
    <div className={`engage-banner${data.metBannerImageUrl ? ' engage-banner--has-image' : ''}`}>
      {data.metBannerImageUrl && (
        <img
          className="engage-banner__image"
          src={data.metBannerImageUrl}
          alt="Engagement banner"
          fetchPriority="high"
          loading="eager"
        />
      )}
      <div className="engage-banner__card">
        {data.informationLabel && <h2 className="engage-banner__title">{data.informationLabel}</h2>}
        {data.instructions && <p className="engage-banner__description">{data.instructions}</p>}
        {data.dateStarted && data.dateCompleted && (
          <p className="engage-banner__dates">
            <strong>
              Engagement dates: {utcMediumDate(data.dateStarted)} to{' '}
              {utcMediumDate(data.dateCompleted)}
            </strong>
          </p>
        )}
        <div className="engage-banner__status-row">
          <strong>Status:</strong>
          <span
            className={`engage-banner__status-chip engage-banner__status-chip--${status.toLowerCase()}`}
          >
            {status}
          </span>
        </div>
        <a
          className="engage-banner__cta"
          href={data.metURL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {data.bannerCTA}
          <i className="material-icons">open_in_new</i>
        </a>
      </div>
    </div>
  );
}
