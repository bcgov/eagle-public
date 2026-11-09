import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  closedCommentPeriodsQueryOptions,
  closedLastMonthCount,
  isClosed,
  openCommentPeriodsQueryOptions,
  recentlyClosedPeriods,
  statusLabel,
} from 'app/api/commentperiod';
import { EngagementLink } from 'app/components/engagement-link';
import { Skeleton } from 'app/components/skeleton/skeleton';
import {
  pacificLongDay,
  periodDetailsHref,
  periodName,
  type CommentPeriod,
} from 'app/models/commentperiod';
import { searchUrl } from 'app/routes/legacy-search';

const MORE_PERIODS_HREF = searchUrl('commentPeriods');

const SKELETON_CARDS = [1, 2];

function PeriodCard({ period }: { period: CommentPeriod }) {
  const closed = isClosed(period);
  const statusId = useId();
  return (
    <li className={closed ? 'home-period home-period--closed' : 'home-period'}>
      <span id={statusId} className="home-period__left">
        {closed ? statusLabel(period) : period.daysRemaining}
      </span>
      <EngagementLink
        className="home-period__name"
        aria-describedby={closed ? statusId : undefined}
        isMet={period.isMet}
        metURL={period.metURL}
        to={periodDetailsHref(period)}
        label={periodName(period)}
      />
      <span className="home-period__window">
        {pacificLongDay(period.dateStarted)} – {pacificLongDay(period.dateCompleted)}
      </span>
    </li>
  );
}

function closedSentence(closed: CommentPeriod[] | null): string {
  if (closed === null) return '';
  const count = closedLastMonthCount(closed);
  return ` ${count === 0 ? 'None' : count} closed in the last 30 days.`;
}

function PeriodsBody() {
  const { data, isPending, isError } = useQuery(openCommentPeriodsQueryOptions());
  const { data: closed = null, isPending: isClosedPending } = useQuery(
    closedCommentPeriodsQueryOptions(),
  );

  // Open rows need not wait, since closed ones append below them; the empty text does.
  if (isPending || (isClosedPending && data?.length === 0)) {
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
  const rows = [...data, ...recentlyClosedPeriods(closed ?? [], data)];
  return (
    <>
      {data.length === 0 && (
        <p className="home-note">
          No comment periods are open right now.{rows.length === 0 && closedSentence(closed)}
        </p>
      )}
      {rows.length > 0 && (
        <ul className="home-periods__list">
          {rows.map((period) => (
            <PeriodCard key={period._id} period={period} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Comment periods open now, then the ones that closed recently. */
export function OpenForComment() {
  return (
    <section className="home-periods" aria-labelledby="home-periods-heading">
      <h2 id="home-periods-heading" className="home-heading">
        Open for comment
      </h2>
      <p className="home-band__body">Current and recent public comment periods</p>
      <PeriodsBody />
      <p className="home-periods__more">
        <Link to={MORE_PERIODS_HREF}>Upcoming and recently closed periods</Link>
      </p>
    </section>
  );
}
