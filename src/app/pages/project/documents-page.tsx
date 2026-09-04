import { Link, NavLink, Outlet } from 'react-router';
import { track } from 'app/analytics/analytics';
import { Constants } from 'app/utils/constants';
import { useDocTabProbes } from './use-doc-tab-probes';
import { useProjectContext } from './project-context';
import './documents-page.css';

/** Stand-ins for the segments still being probed, sized like the labels they replace. */
const PLACEHOLDER_WIDTHS = ['7.5rem', '8.5rem', '9.5rem'];

/** Segments shown only when the project actually has documents of that kind. */
const OPTIONAL_TABS = [
  { key: Constants.optionalProjectDocTabs.APPLICATION, label: 'Application', link: 'application' },
  { key: Constants.optionalProjectDocTabs.CERTIFICATE, label: 'Certificate', link: 'certificates' },
  { key: Constants.optionalProjectDocTabs.AMENDMENT, label: 'Amendment(s)', link: 'amendments' },
  { key: Constants.optionalProjectDocTabs.COMPLIANCE, label: 'C&E Documents', link: 'compliance' },
];

/** Documents tab shell: the document-type filter, and whichever document view it selects. */
export function DocumentsPage() {
  const context = useProjectContext();
  const { projId, lists, project } = context;

  // Shared with the project tab strip, which needs the same answers.
  const probes = useDocTabProbes(projId, lists);

  // Absolute links: a relative `.` resolves against the open view, which would leave All
  // Documents marked active everywhere. `end` keeps it inactive while a filtered view is open.
  const documentsPath = `/p/${projId}/documents`;

  const tabs = [
    { label: 'All Documents', link: documentsPath, end: true },
    ...OPTIONAL_TABS.filter((tab) => probes.has[tab.key] === true).map((tab) => ({
      ...tab,
      link: `${documentsPath}/${tab.link}`,
      end: false,
    })),
  ];

  return (
    <>
      <div className="documents-page__header">
        <h2 className="documents-page__title">Documents</h2>
        <Link className="documents-page__help" to="/search-help">
          <i className="material-icons" aria-hidden="true">
            help_outline
          </i>
          How to search documents
        </Link>
      </div>

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
                  <span className="placeholder placeholder-wave"></span>
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
                      project_name: project?.name ?? null,
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
      <Outlet context={context} />
    </>
  );
}
