import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getTopNewsItems } from 'app/api/search';
import { getRecentUploads, listsQueryOptions } from 'app/api/api';
import { track } from 'app/analytics/analytics';
import type { News } from 'app/models/news';
import type { RecentUpload, RecentUploadDocument } from 'app/models/recent-upload';
import { idToListName, longDate } from 'app/utils/utils';
import { ActivityCard } from 'app/components/activity-card';
import { DocumentLink } from 'app/components/table/document-link';
import { searchUrl } from 'app/routes/legacy-search';
import { HomeSearch } from './home-search';
import { BrowseStrip } from './browse-strip';
import './home.css';

const INTRO =
  "British Columbia's environmental assessment process provides opportunities for Indigenous Nations, government agencies and the public to influence the outcome of environmental assessments in British Columbia.";

/** The wait the home page shows while a feed loads. */
function FeedSpinner() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div
        className="spinner-border text-primary"
        style={{ width: '3rem', height: '3rem' }}
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

/**
 * The sort the document tables land on. `datePosted` is the only date those tables hold a column
 * for, and the one the API sorts documents by, so it is also the sort their header can show. The
 * feed's own `dateUploaded` is not a sortable field there, so the preset does not claim it.
 */
const NEWEST_FIRST = '-datePosted';

/** The project's All Documents table, newest first. Takes the Eagle `_id`: no route resolves a DEMI id. */
function documentsHref(eagleProjectId: string): string {
  return `/p/${eagleProjectId}/documents?sortBy=${NEWEST_FIRST}`;
}

/** One project in the feed: its newest documents, and the ways into the full list. */
function UploadRow({ upload, lists }: { upload: RecentUpload; lists: any[] }) {
  const documents = upload.documents ?? [];
  // A project Eagle has no row for has nowhere to link to, so its name stays plain text.
  const projectHref = upload.eagleProjectId ? documentsHref(upload.eagleProjectId) : null;
  const rowDate = longDate(upload.dateUploaded);

  function trackClick(
    doc: RecentUploadDocument | null,
    target: 'project' | 'document' | 'all-documents',
  ): void {
    track('Recent Upload Clicked', {
      // Not a route, so the DEMI id still names the project when Eagle has no row.
      project_id: upload.eagleProjectId ?? upload.projectId,
      project_name: upload.projectName,
      document_id: doc?.id ?? null,
      target,
    });
  }

  return (
    <li>
      <h3 className="home-recent-uploads__project">
        {projectHref ? (
          <Link to={projectHref} onClick={() => trackClick(null, 'project')}>
            {upload.projectName}
          </Link>
        ) : (
          upload.projectName
        )}
      </h3>
      <small className="d-block text-muted mb-3">{rowDate}</small>

      {documents.length > 0 && (
        <ul className="home-recent-uploads__docs">
          {documents.map((doc) => {
            const typeName = idToListName(doc.type, lists);
            const docDate = longDate(doc.dateUploaded);
            // `-` is what an unresolved List id reads as, and the row already carries the date the
            // newest documents share; either one missing just shortens the meta line.
            const type = typeName === '-' ? null : typeName;
            const date = docDate === rowDate ? null : docDate;
            return (
              <li key={doc.id}>
                <DocumentLink
                  document={{
                    _id: doc.id,
                    displayName: doc.displayName,
                    documentFileName: doc.documentFileName ?? undefined,
                  }}
                  onClick={() => trackClick(doc, 'document')}
                >
                  {doc.displayName}
                </DocumentLink>
                {(type || date) && (
                  <small className="d-block text-muted">
                    {type}
                    {type && date && ' \u00b7 '}
                    {date && <span className="text-nowrap">{date}</span>}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {projectHref && (
        <div className="d-flex flex-wrap gap-2 mt-3">
          <Link
            className="btn btn-sm btn-outline-primary"
            to={projectHref}
            aria-label={`All documents for ${upload.projectName}`}
            onClick={() => trackClick(null, 'all-documents')}
          >
            All documents
          </Link>
        </div>
      )}
    </li>
  );
}

/** The projects that received a document most recently. Nothing to show means no section. */
function RecentUploads() {
  // A document's type is a `List` id, and the rest of the app already caches the rows under this
  // key, so the first project page opened does not ask for them again.
  const { data: lists = [], isPending: listsPending } = useQuery(listsQueryOptions());
  const {
    data: uploads = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['recentUploads'],
    queryFn: () => getRecentUploads(),
    // demi-search caches the feed for five minutes, the window the client's default staleTime holds.
    // A failed feed drops the section, so retrying only holds the spinner up.
    retry: false,
  });

  if (isError || (!isPending && uploads.length === 0)) {
    return null;
  }

  return (
    <section className="home-recent-uploads">
      <div className="home-feed-panel">
        <h2>Recent Uploads</h2>
        {isPending || listsPending ? (
          <FeedSpinner />
        ) : (
          <ul className="home-recent-uploads__list">
            {uploads.map((upload) => (
              <UploadRow key={upload.projectId} upload={upload} lists={lists} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function Home() {
  const { data: results = [], isPending } = useQuery<News[]>({
    queryKey: ['topNewsItems'],
    queryFn: getTopNewsItems,
  });

  return (
    <div className="home">
      <section className="home-band" aria-label="Environmental Assessments">
        <div className="home-band__inner">
          <h1 className="home-band__title">Environmental Assessments</h1>
          <p className="home-band__intro">{INTRO}</p>
          <HomeSearch />
        </div>
      </section>

      <div className="home-body">
        <section className="home-body__feed">
          <div className="home-feed-panel home-news-feed">
            <h2>Recent Activities &amp; Updates</h2>
            {isPending ? (
              <FeedSpinner />
            ) : results.length > 0 ? (
              <table className="table" id="tableTop">
                {results
                  .filter((item) => item.active)
                  .map((item) => (
                    <tbody key={item._id}>
                      <ActivityCard rowData={item} />
                    </tbody>
                  ))}
              </table>
            ) : null}
            <div className="mt-4 text-center">
              <Link
                className="btn slide-r-btn btn-outline-primary d-inline-flex align-items-center gap-2"
                to={searchUrl('activities')}
              >
                <span>View All Activities &amp; Updates</span>
                <i className="material-icons">&#xE5C8;</i>
              </Link>
            </div>
          </div>
        </section>

        <div className="home-body__rail">
          <RecentUploads />
        </div>
      </div>

      <BrowseStrip />
    </div>
  );
}
