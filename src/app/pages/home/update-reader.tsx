import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router';
import { demiProjectQueryOptions } from 'app/api/api';
import {
  feedRowToUpdate,
  homeFeedQueryOptions,
  updateQueryOptions,
  type HomeUpdate,
  type Update,
} from 'app/api/updates';
import { Modal } from 'app/components/modal/modal';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { UpdateBody } from 'app/components/update-detail/update-detail';
import { updateMeta } from 'app/components/update-detail/update-meta';
import { KIND_LABELS, projectDocumentsHref } from './home-shared';

function ReaderBody({ update }: { update: Update }) {
  // The project read adds the location; until it lands the line is project and date alone.
  const { data: project } = useQuery(demiProjectQueryOptions(update.projectId ?? ''));

  return (
    <>
      <span className="home-reader__kind home-reader__kind--update">
        {update.category ?? KIND_LABELS.update}
      </span>
      <p className="home-reader__meta">{updateMeta(update, project?.address)}</p>
      <div className="home-reader__scroll">
        <UpdateBody update={update} />
      </div>
      {update.projectId ? (
        <div className="home-reader__foot">
          <Link className="home-reader__primary" to={`/p/${update.projectId}/overview`}>
            View Project
          </Link>
          <Link className="home-reader__secondary" to={projectDocumentsHref(update.projectId)}>
            All project documents
          </Link>
        </div>
      ) : (
        update.subject && (
          <div className="home-reader__foot">
            <p className="home-reader__subject">About: {update.subject}</p>
          </div>
        )
      )}
    </>
  );
}

/** demi-search names no project for a hidden Update, so only one the app already knows is linked. */
function Unavailable({ projectId }: { projectId: string | null }) {
  return (
    <div className="home-reader__scroll">
      <p className="home-note">
        <span className="home-note__title">This update is no longer available.</span>
        <span className="home-note__detail">
          {projectId ? (
            <Link to={`/p/${projectId}/overview`}>Go to the project</Link>
          ) : (
            <Link to="/">See recent updates</Link>
          )}
        </span>
      </p>
    </div>
  );
}

/**
 * The full text of one update, in a dialog over the home page. Mount it keyed by id, so the
 * Documents accordion starts collapsed on every open.
 */
export function UpdateReader({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const feedRow = queryClient
    .getQueryData<HomeUpdate[]>(homeFeedQueryOptions().queryKey)
    ?.find((u) => u.id === id);
  const fromFeed = feedRow ? feedRowToUpdate(feedRow) : undefined;
  const knownProjectId =
    feedRow?.projectId ?? (location.state as { projectId?: string } | null)?.projectId ?? null;
  // Opened from the feed, the row shows at once and stays if the full read fails.
  const { data, isPending, isError } = useQuery({
    ...updateQueryOptions(id),
    placeholderData: fromFeed,
  });
  const update = data ?? (isError ? fromFeed : undefined);

  const title = update?.headline ?? (isPending ? 'Loading update' : 'Update not available');

  return (
    <Modal open onClose={onClose} title={title} className="home-reader">
      {update ? (
        <ReaderBody update={update} />
      ) : isPending ? (
        <div className="home-reader__scroll" aria-busy="true">
          <Skeleton lines={4} />
        </div>
      ) : isError ? (
        <div className="home-reader__scroll">
          <p className="home-note">
            <span className="home-note__title">This update is unavailable right now.</span>
            <span className="home-note__detail">Try again in a moment.</span>
          </p>
        </div>
      ) : (
        <Unavailable projectId={knownProjectId} />
      )}
    </Modal>
  );
}
