import { useState } from 'react';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { Pagination } from 'app/components/table/pagination';
import { DocumentLink } from 'app/components/table/document-link';
import { useTable } from 'app/components/table/use-table';
import { Constants } from 'app/utils/constants';
import { isSafeUrl } from 'app/utils/safe-url';
import { createProjectTabModifiers, idToListName, longDate, mediumDate } from 'app/utils/utils';
import { useProjectContext } from './project-context';
import './decisions-tab.css';

const PAGE_SIZE = 10;

/** Rows a list holds open while its first page is in flight. */
const SKELETON_ROWS = [1, 2, 3];

function regulatorLink(item: unknown): string {
  return typeof item === 'string' && isSafeUrl(item) ? item : Constants.BC_ENERGY_REGULATOR_LINK;
}

/** The type and milestone of a document, as a single line. */
function documentDetail(record: { type?: string; milestone?: string }, lists: any[]): string {
  return [record.type, record.milestone]
    .map((id) => idToListName(id ?? '', lists))
    .filter((name) => name !== '-')
    .join(' · ');
}

/** The EA decision, then the certificate-set documents that record the decisions, newest first. */
export function DecisionsTab() {
  const { projId, project, lists, projectLoading } = useProjectContext();
  const [page, setPage] = useState(1);

  const decision = project?.eacDecision?.name;
  const transferred = decision === 'Regulatory Transfer';

  const result = useTable('decisionDocuments', {
    dataset: 'Document',
    // The certificate modifiers are built from the lists, so the search waits for them.
    enabled: !!projId && lists.length > 0,
    fields: [{ name: 'project', value: projId }],
    currentPage: page,
    pageSize: PAGE_SIZE,
    sortBy: '-datePosted',
    secondarySort: '+displayName',
    queryModifiers: createProjectTabModifiers(Constants.optionalProjectDocTabs.CERTIFICATE, lists),
  });

  // The certificate modifiers are built from the lists, so a query waiting on them is still
  // pending rather than empty.
  const pending = result.loading || lists.length === 0;

  return (
    <section className="decisions-tab">
      <h2 className="decisions-tab__title">Decisions</h2>
      <p className="decisions-tab__intro">
        Every decision the Environmental Assessment Office has made on this project, newest first.
      </p>

      {projectLoading && (
        <div className="decisions-tab__decision" aria-busy="true">
          <span className="visually-hidden">Loading the EA decision</span>
          <Skeleton width="6rem" />
          <Skeleton width="45%" />
        </div>
      )}

      {!projectLoading && project?.eacDecision && (
        <div className="decisions-tab__decision">
          <h3 className="decisions-tab__decision-label">EA decision</h3>
          {transferred ? (
            <p className="decisions-tab__decision-value">
              <a
                href={regulatorLink(project.applicableRegulation?.item)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {project.applicableRegulation?.name || 'BC Energy Regulator'}
              </a>
            </p>
          ) : (
            <>
              <p className="decisions-tab__decision-value">{decision}</p>
              {project.decisionDate && (
                <p className="decisions-tab__decision-date">{longDate(project.decisionDate)}</p>
              )}
            </>
          )}
        </div>
      )}

      {pending && result.data.length === 0 && (
        <ol className="decisions-tab__list" aria-busy="true">
          <li className="visually-hidden">Loading decision documents</li>
          {SKELETON_ROWS.map((row) => (
            <li className="decisions-tab__item" key={row}>
              <p className="decisions-tab__item-date">
                <Skeleton width="5rem" />
              </p>
              <div>
                <Skeleton width="60%" />
                <Skeleton width="35%" />
              </div>
            </li>
          ))}
        </ol>
      )}

      {result.data.length > 0 && (
        <ol className="decisions-tab__list">
          {result.data.map((record) => (
            <li className="decisions-tab__item" key={record._id}>
              <p className="decisions-tab__item-date">{mediumDate(record.datePosted)}</p>
              <div>
                <h3 className="decisions-tab__item-title">{record.displayName}</h3>
                <p className="decisions-tab__item-detail">{documentDetail(record, lists)}</p>
                <DocumentLink document={record}>
                  {record.documentFileName || 'Open document'}
                </DocumentLink>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!pending && result.data.length === 0 && (
        <p>No decision documents have been posted for this project.</p>
      )}

      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalItems={result.totalListItems}
        ariaLabel="Decision documents pagination"
        onPageChange={setPage}
      />
    </section>
  );
}
