import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { demiProjectQueryOptions } from 'app/api/api';
import { homeFeedQueryOptions, updateQueryOptions, type HomeUpdate } from 'app/api/updates';
import { Modal } from 'app/components/modal/modal';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { safeHtml } from 'app/utils/safe-html';
import { fileName, isSafeUrl } from 'app/utils/safe-url';
import { longDate } from 'app/utils/utils';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import { KIND_LABELS, projectDocumentsHref } from './home-shared';

/** An update carries one `documentUrl` and no name, type or date, so the accordion lists one link. */
function Documents({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="home-reader__docs">
      <button
        type="button"
        className="home-reader__docs-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((was) => !was)}
      >
        <span>Documents (1)</span>
        <i className="material-icons" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </i>
      </button>
      {open && (
        <ul id={listId} className="home-reader__docs-list">
          <li>
            <a className="home-reader__doc" href={url} target="_blank" rel="noopener noreferrer">
              <i className="material-icons" aria-hidden="true">
                insert_drive_file
              </i>
              <span>{fileName(url) ?? 'Project documents'}</span>
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}

function ReaderBody({ update }: { update: HomeUpdate }) {
  // The project read adds the location; until it lands the line is project and date alone.
  const { data: project } = useQuery(demiProjectQueryOptions(update.projectId ?? ''));
  const meta = [update.projectName, project?.address, longDate(update.date)].filter(Boolean);
  const document = update.documentUrl && isSafeUrl(update.documentUrl) ? update.documentUrl : null;

  return (
    <>
      <span className={`home-reader__kind home-reader__kind--${update.kind}`}>
        {KIND_LABELS[update.kind]}
      </span>
      <p className="home-reader__meta">{meta.join(' · ')}</p>
      <div className="home-reader__scroll">
        {update.content && (
          <div
            className="home-reader__content"
            dangerouslySetInnerHTML={safeHtml(sanitizeWordHtml(update.content))}
          ></div>
        )}
        {document && <Documents url={document} />}
      </div>
      {update.projectId && (
        <div className="home-reader__foot">
          <Link className="home-reader__primary" to={`/p/${update.projectId}/overview`}>
            View Project
          </Link>
          <Link className="home-reader__secondary" to={projectDocumentsHref(update.projectId)}>
            All project documents
          </Link>
        </div>
      )}
    </>
  );
}

/**
 * The full text of one update, in a dialog over the home page. Mount it keyed by id, so the
 * Documents accordion starts collapsed on every open.
 */
export function UpdateReader({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const feedKey = homeFeedQueryOptions().queryKey;
  // Opened from the feed, the row is already in hand; only a cold `/updates/:id` load asks.
  const {
    data: update,
    isPending,
    isError,
  } = useQuery({
    ...updateQueryOptions(id),
    initialData: () => queryClient.getQueryData<HomeUpdate[]>(feedKey)?.find((u) => u.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(feedKey)?.dataUpdatedAt,
  });

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
        <div className="home-reader__scroll">
          <p className="home-note">
            This update is not available. It may have been removed, or the link may be wrong.
          </p>
        </div>
      )}
    </Modal>
  );
}
