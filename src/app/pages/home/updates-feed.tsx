import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { homeFeedQueryOptions, type HomeUpdate } from 'app/api/updates';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { searchUrl } from 'app/routes/legacy-search';
import { longDate } from 'app/utils/utils';
import { KIND_LABELS } from './home-shared';

const SKELETON_ROWS = [1, 2, 3, 4, 5];

function CardBody({ update }: { update: HomeUpdate }) {
  return (
    <>
      <span className="home-update__top">
        <span className="home-update__who">
          {/* The spaces keep the parts apart in the link's accessible name. */}
          <span className="home-update__kind">{KIND_LABELS[update.kind]}</span>{' '}
          {update.projectName && <span className="home-update__project">{update.projectName}</span>}
        </span>{' '}
        <span className="home-update__date">{longDate(update.date)}</span>
      </span>{' '}
      <span className="home-update__headline">{update.headline}</span>
    </>
  );
}

/**
 * An update opens the reader. A decision has no update to read, so it goes to its project, or
 * nowhere when it has none.
 */
function UpdateCard({ update }: { update: HomeUpdate }) {
  const className = `home-update home-update--${update.kind}`;
  if (update.kind === 'update') {
    return (
      <li>
        <Link
          className={className}
          to={`/updates/${encodeURIComponent(update.id)}`}
          aria-haspopup="dialog"
        >
          <CardBody update={update} />
        </Link>
      </li>
    );
  }
  return (
    <li>
      {update.projectId ? (
        <Link className={className} to={`/p/${encodeURIComponent(update.projectId)}/overview`}>
          <CardBody update={update} />
        </Link>
      ) : (
        <div className={className}>
          <CardBody update={update} />
        </div>
      )}
    </li>
  );
}

function FeedBody() {
  const { data: updates, isPending, isError } = useQuery(homeFeedQueryOptions());

  if (isPending) {
    return (
      <ul className="home-updates__list" aria-busy="true">
        <li className="visually-hidden">Loading</li>
        {SKELETON_ROWS.map((index) => (
          <li className="home-update home-update--skeleton" key={index}>
            <Skeleton width="25%" />
            <Skeleton width="45%" />
            <Skeleton width="85%" />
          </li>
        ))}
      </ul>
    );
  }
  if (isError) {
    return (
      <p className="home-note">
        <span className="home-note__title">Updates are unavailable right now.</span>
        <span className="home-note__detail">Try again in a moment.</span>
      </p>
    );
  }
  if (updates.length === 0) {
    return <p className="home-note">No updates have been published yet.</p>;
  }
  return (
    <ul className="home-updates__list">
      {updates.map((update) => (
        <UpdateCard key={update.id} update={update} />
      ))}
    </ul>
  );
}

/** The home page's Updates feed: three-line cards for updates and decisions. */
export function UpdatesFeed() {
  return (
    <section className="home-updates" aria-labelledby="home-updates-heading">
      {/* The Subscribe button joins the heading on this row. */}
      <div className="home-updates__head">
        <h2 id="home-updates-heading" className="home-heading">
          Updates
        </h2>
      </div>
      <FeedBody />
      <p className="home-updates__foot">
        <Link className="home-updates__all" to={searchUrl('activities')}>
          View all Activities &amp; Updates
          <i className="material-icons" aria-hidden="true">
            arrow_forward
          </i>
        </Link>
      </p>
    </section>
  );
}
