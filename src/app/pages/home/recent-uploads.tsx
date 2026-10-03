import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getRecentUploads, listsQueryOptions } from 'app/api/api';
import { track } from 'app/analytics/analytics';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { RecentUpload } from 'app/models/recent-upload';
import { idToListName } from 'app/utils/utils';
import { projectDocumentsHref } from './home-shared';

/** "Sep 12": the rail only lists recent uploads, so the year adds nothing. */
function railDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const SKELETON_ROWS = [1, 2, 3, 4, 5];

/** One project: its name, the document tab its newest upload lands in, and the date. */
function UploadRow({ upload, lists }: { upload: RecentUpload; lists: unknown[] }) {
  const typeName = idToListName(upload.documents?.[0]?.type ?? '', lists);
  // `-` is what an unresolved List id reads as.
  const tab = typeName === '-' ? 'Documents' : typeName;
  const content = (
    <>
      <span className="home-upload__text">
        {/* The spaces keep the parts apart in the link's accessible name. */}
        <span className="home-upload__name">{upload.projectName}</span>{' '}
        <span className="home-upload__tab">{tab}</span>
      </span>{' '}
      <span className="home-upload__date">{railDate(upload.dateUploaded)}</span>
    </>
  );

  return (
    <li>
      {/* A project Eagle has no row for has nowhere to link to. */}
      {upload.eagleProjectId ? (
        <Link
          className="home-upload"
          to={projectDocumentsHref(upload.eagleProjectId)}
          onClick={() =>
            track('Recent Upload Clicked', {
              project_id: upload.eagleProjectId,
              project_name: upload.projectName,
              document_id: null,
              target: 'project',
            })
          }
        >
          {content}
        </Link>
      ) : (
        <div className="home-upload">{content}</div>
      )}
    </li>
  );
}

function UploadsBody() {
  // A document's type is a `List` id; the rest of the app caches the rows under this key.
  const { data: lists = [], isPending: listsPending } = useQuery(listsQueryOptions());
  const {
    data: uploads,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['recentUploads'],
    queryFn: () => getRecentUploads(),
    // demi-search caches the feed for five minutes; a failed read shows its own line in place.
    retry: false,
  });

  if (isPending || (listsPending && !isError)) {
    return (
      <ul className="home-uploads__list" aria-busy="true">
        <li className="visually-hidden">Loading</li>
        {SKELETON_ROWS.map((index) => (
          <li className="home-upload home-upload--skeleton" key={index}>
            <Skeleton width="60%" />
            <Skeleton width="35%" />
          </li>
        ))}
      </ul>
    );
  }
  if (isError) {
    return <p className="home-note">Recent uploads are unavailable right now.</p>;
  }
  if (uploads.length === 0) {
    return <p className="home-note">No documents have been uploaded recently.</p>;
  }
  return (
    <ul className="home-uploads__list">
      {uploads.map((upload) => (
        <UploadRow key={upload.projectId} upload={upload} lists={lists} />
      ))}
    </ul>
  );
}

/** The five projects that received a document most recently (PUBLIC-152). */
export function RecentUploads() {
  return (
    <section className="home-uploads" aria-labelledby="home-uploads-heading">
      <h2 id="home-uploads-heading" className="home-heading">
        Recent Uploads
      </h2>
      <UploadsBody />
    </section>
  );
}
