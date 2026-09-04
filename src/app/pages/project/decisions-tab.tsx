import { useState } from 'react';
import { Pagination } from 'app/components/table/pagination';
import { DocumentLink } from 'app/components/table/document-link';
import { useTable } from 'app/components/table/use-table';
import { Constants } from 'app/utils/constants';
import { createProjectTabModifiers, idToListName, longDate, mediumDate } from 'app/utils/utils';
import { useProjectContext } from './project-context';
import './decisions-tab.css';

const BC_ENERGY_REGULATOR_LINK = 'https://www.bc-er.ca/data-reports/data-centre/';

const PAGE_SIZE = 10;

/** The type and milestone of a document, as a single line. */
function documentDetail(record: { type?: string; milestone?: string }, lists: any[]): string {
  return [record.type, record.milestone]
    .map((id) => idToListName(id ?? '', lists))
    .filter((name) => name !== '-')
    .join(' · ');
}

/** The EA decision, then the certificate-set documents that record the decisions, newest first. */
export function DecisionsTab() {
  const { projId, project, lists } = useProjectContext();
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

  return (
    <section className="decisions-tab">
      <h2 className="decisions-tab__title">Decisions</h2>
      <p className="decisions-tab__intro">
        Every decision the Environmental Assessment Office has made on this project, newest first.
      </p>

      {project?.eacDecision && (
        <div className="decisions-tab__decision">
          <h3 className="decisions-tab__decision-label">EA decision</h3>
          {transferred ? (
            <p className="decisions-tab__decision-value">
              <a
                href={project.applicableRegulation?.item || BC_ENERGY_REGULATOR_LINK}
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

      {!result.loading && result.data.length === 0 && (
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
