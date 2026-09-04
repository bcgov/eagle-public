import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { DocumentLink } from 'app/components/table/document-link';
import { useTable } from 'app/components/table/use-table';
import { idToListName, longDate } from 'app/utils/utils';
import { useProjectContext } from './project-context';
import './featured-documents.css';

const PAGE_SIZE = 5;

/** Rows a list holds open while its first page is in flight. */
const SKELETON_ROWS = [1, 2, 3];

/** `internalSize` arrives as a byte count in a string. */
function fileSize(bytes: string | number | undefined): string {
  const value = Number(bytes);
  if (!value) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const step = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** step).toFixed(step ? 1 : 0)} ${units[step]}`;
}

/** The project's starred documents: a fixed top five, no paging or sorting. */
export function FeaturedDocuments() {
  const { projId, lists } = useProjectContext();

  const result = useTable('featuredDocuments', {
    dataset: 'Document',
    enabled: !!projId,
    fields: [{ name: 'project', value: projId }],
    currentPage: 1,
    pageSize: PAGE_SIZE,
    sortBy: '-datePosted',
    queryModifiers: { isFeatured: 'true' },
  });

  if (!result.loading && result.totalListItems === 0) {
    return null;
  }

  return (
    <section aria-labelledby="featured-documents-title">
      <div className="overview-tab__card-header">
        <h2 id="featured-documents-title">Featured documents</h2>
        <Link to={`/p/${projId}/documents`}>
          {result.totalListItems > 0
            ? `All ${result.totalListItems.toLocaleString()} documents`
            : 'All documents'}
        </Link>
      </div>
      {result.loading && result.data.length === 0 ? (
        <ul className="overview-tab__list featured-documents" aria-busy="true">
          <li className="visually-hidden">Loading featured documents</li>
          {SKELETON_ROWS.map((row) => (
            <li key={row}>
              <span className="featured-documents__detail">
                <Skeleton width="70%" />
                <Skeleton width="40%" />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="overview-tab__list featured-documents">
          {result.data.map((document: any) => {
            const name = document.displayName || document.documentFileName;
            return (
              <li key={document._id}>
                <i className="material-icons featured-documents__icon" aria-hidden="true">
                  insert_drive_file
                </i>
                <span className="featured-documents__detail">
                  <DocumentLink document={document}>{name}</DocumentLink>
                  <span className="featured-documents__meta">
                    {[
                      idToListName(document.type, lists),
                      longDate(document.datePosted),
                      fileSize(document.internalSize),
                    ]
                      .filter((part) => part && part !== '-')
                      .join(' · ')}
                  </span>
                </span>
                {/* Second DocumentLink instance: same download behaviour, icon-only target. */}
                <DocumentLink document={document}>
                  <i
                    className="material-icons featured-documents__download-icon"
                    aria-hidden="true"
                  >
                    file_download
                  </i>
                  <span className="visually-hidden">Download {name}</span>
                </DocumentLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
