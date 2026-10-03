import { Link, NavLink, Outlet } from 'react-router';
import { track } from 'app/analytics/analytics';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { DOCUMENT_TABS } from 'app/utils/document-tabs';
import { useDocTabProbes } from './use-doc-tab-probes';
import { useExtendedPage, useProjectContext } from './project-context';
import { useProjectDocumentCount } from './use-project-tab-meta';
import { ExtendedDocumentsEmpty } from './extended/extended-documents-empty';
import { ExtendedExternalDocuments } from './extended/extended-external-documents';
import './documents-page.css';

/** Stand-ins for the segments still being probed, sized like the labels they replace. */
const PLACEHOLDER_WIDTHS = ['7.5rem', '8.5rem', '9.5rem'];

/** The Documents heading and its search help link. */
export function DocumentsHeader() {
  return (
    <div className="documents-page__header">
      <h2 className="documents-page__title">Documents</h2>
      <Link className="documents-page__help" to="/search-help">
        <i className="material-icons" aria-hidden="true">
          help_outline
        </i>
        <span className="link-label">Search help</span>
      </Link>
    </div>
  );
}

/** Documents tab shell: the document-type filter, and whichever document view it selects. */
export function DocumentsPage() {
  const context = useProjectContext();
  const { projId, lists, project } = context;
  const extended = useExtendedPage();

  // Shared with the project tab strip, which needs the same answers.
  const probes = useDocTabProbes(projId, lists);
  const emptyNotice = extended?.documents?.empty;
  // Same query as the strip's count, so this reads its cache.
  const documents = useProjectDocumentCount(emptyNotice ? projId : '');

  // Absolute links: a relative `.` resolves against the open view, which would leave All
  // Documents marked active everywhere. `end` keeps it inactive while a filtered view is open.
  const documentsPath = `/p/${projId}/documents`;

  const tabs = [
    { label: 'All Documents', link: documentsPath, end: true },
    // Segments shown only when the project actually has documents of that kind.
    ...DOCUMENT_TABS.filter((tab) => probes.has[tab.key] === true).map((tab) => ({
      label: tab.label,
      link: `${documentsPath}/${tab.path}`,
      end: false,
    })),
  ];

  // An extended project page with an empty notice points elsewhere for its records rather than
  // showing an empty table. Documents other governments published sit below, never in the table.
  if (extended && emptyNotice && !documents.pending && documents.total === 0) {
    return (
      <>
        <DocumentsHeader />
        <ExtendedDocumentsEmpty content={extended} />
        <ExtendedExternalDocuments content={extended} />
      </>
    );
  }

  return (
    <>
      <DocumentsHeader />

      <nav className="document-type-filter" aria-labelledby="document-type-filter-label">
        <span className="visually-hidden" id="document-type-filter-label">
          Document type
        </span>
        <ul className="document-type-filter__group" aria-busy={probes.probing || undefined}>
          {probes.probing && <span className="visually-hidden">Loading document types</span>}
          {probes.probing &&
            PLACEHOLDER_WIDTHS.map((width) => (
              <li key={width} aria-hidden="true">
                <span
                  className="document-type-filter__segment document-type-filter__segment--loading"
                  style={{ width }}
                >
                  <Skeleton height="0.75rem" />
                </span>
              </li>
            ))}
          {!probes.probing &&
            tabs.map((tab) => (
              <li key={tab.link}>
                <NavLink
                  className={({ isActive }) =>
                    `document-type-filter__segment${isActive ? ' active' : ''}`
                  }
                  to={tab.link}
                  end={tab.end}
                  replace
                  onClick={() =>
                    track('Project Tab Clicked', {
                      project_id: projId,
                      project_name: extended?.displayName ?? project?.name ?? null,
                      tab_name: tab.label,
                      tab_path: tab.link,
                    })
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
      {/* react-router does not inherit outlet context, so the sub-views get it passed on again. */}
      <div className="documents-page__body">
        <Outlet context={context} />
      </div>
      {extended && <ExtendedExternalDocuments content={extended} />}
    </>
  );
}
