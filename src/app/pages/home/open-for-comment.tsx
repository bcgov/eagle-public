import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { demiProjectQueryOptions } from 'app/api/api';
import { openCommentPeriodsQueryOptions } from 'app/api/commentperiod';
import { EngagementLink } from 'app/components/engagement-link';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { CommentPeriod } from 'app/models/commentperiod';
import { searchUrl } from 'app/routes/legacy-search';
import { longDate } from 'app/utils/utils';

// No record type lists comment periods yet; notifications with a pending period are the nearest.
const MORE_PERIODS_HREF = `${searchUrl('notifications')}&pcp=pending`;

const SKELETON_CARDS = [1, 2];

/** The period's project as the row carries it: an Eagle id, or a populated project. */
function projectIdOf(period: CommentPeriod): string {
  const project = period.project as unknown;
  if (typeof project === 'string') return project;
  return (project as { _id?: string } | null)?._id ?? '';
}

function PeriodCard({ period }: { period: CommentPeriod }) {
  const projectId = projectIdOf(period);
  // The open-periods read carries no project name, so the card asks the project document for it.
  const { data: project } = useQuery(demiProjectQueryOptions(projectId));
  const name = project?.name ?? period.informationLabel ?? 'Comment period';

  return (
    <li className="home-period">
      <span className="home-period__left">{period.daysRemaining}</span>
      <EngagementLink
        className="home-period__name"
        isMet={period.isMet}
        metURL={period.metURL}
        to={projectId ? `/p/${projectId}/cp/${period._id}/details` : null}
        label={name}
      />
      <span className="home-period__window">
        {longDate(period.dateStarted)} – {longDate(period.dateCompleted)}
      </span>
    </li>
  );
}

function closedSentence(count: number | null): string {
  if (count === null) return '';
  return ` ${count === 0 ? 'None' : count} closed in the last 30 days.`;
}

function PeriodsBody() {
  const { data, isPending, isError } = useQuery(openCommentPeriodsQueryOptions());

  if (isPending) {
    return (
      <ul className="home-periods__list" aria-busy="true">
        <li className="visually-hidden">Loading</li>
        {SKELETON_CARDS.map((index) => (
          <li className="home-period home-period--skeleton" key={index}>
            <Skeleton width="35%" />
            <Skeleton width="70%" />
            <Skeleton width="55%" />
          </li>
        ))}
      </ul>
    );
  }
  if (isError) {
    return (
      <p className="home-note">
        <span className="home-note__title">Comment periods are unavailable right now.</span>
        <span className="home-note__detail">Try again in a moment.</span>
      </p>
    );
  }
  if (data.periods.length === 0) {
    return (
      <p className="home-note">
        No comment periods are open right now.{closedSentence(data.closedCount)}
      </p>
    );
  }
  return (
    <ul className="home-periods__list">
      {data.periods.map((period) => (
        <PeriodCard key={period._id} period={period} />
      ))}
    </ul>
  );
}

/** Comment periods open now. Every one is an ENGAGE engagement, so the cards link out. */
export function OpenForComment() {
  return (
    <section className="home-periods" aria-labelledby="home-periods-heading">
      <h2 id="home-periods-heading" className="home-heading">
        Open for comment
      </h2>
      <PeriodsBody />
      <p className="home-periods__more">
        <Link to={MORE_PERIODS_HREF}>Upcoming and recently closed periods</Link>
      </p>
    </section>
  );
}
