import { useQueries } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { track } from 'app/analytics/analytics';
import { getSearchResults } from 'app/api/search';
import { logger } from 'app/config/logging';
import { Constants } from 'app/utils/constants';
import { createProjectTabModifiers, extractFromSearchResults } from 'app/utils/utils';
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

  // Each optional segment costs one 1-result search; TanStack keys them so revisiting a sub-tab or
  // the project does not re-ask.
  const optionalTabResults = useQueries({
    queries: OPTIONAL_TABS.map(tab => ({
      queryKey: ['project-tab-has-documents', projId, tab.key],
      enabled: !!projId && lists.length > 0,
      queryFn: async () => {
        const response = await getSearchResults(
          '',
          'Document',
          [{ name: 'project', value: projId }],
          1,
          1,
          '',
          createProjectTabModifiers(tab.key, lists),
          true,
          '',
        );
        const results = extractFromSearchResults(response ?? []);
        if (!results) {
          // getSearchResults turns any non-2xx into `null`, so a 502 and a project with no
          // documents of this kind look the same. Hiding the segment is the right degradation, but
          // it should not be invisible.
          logger.error(
            `Could not determine whether the ${tab.key} segment has documents; leaving it hidden`,
            'DocumentsPage',
          );
          return false;
        }
        return results.length > 0;
      },
    })),
  });

  // Absolute links: a relative `.` resolves against the open view, which would leave All
  // Documents marked active everywhere. `end` keeps it inactive while a filtered view is open.
  const documentsPath = `/p/${projId}/documents`;
  // Every probe resolves on its own, so rendering each segment as its answer lands makes them pop
  // in one at a time. Hold the group as placeholders until they have all settled. A disabled query
  // also reports `isPending`, so a failed `List` fetch would otherwise leave this shimmering for
  // good; with no lists there is nothing left to wait for.
  const probing = lists.length > 0 && optionalTabResults.some(result => result.isPending);

  const tabs = [
    { label: 'All Documents', link: documentsPath, end: true },
    ...OPTIONAL_TABS.filter((_, index) => optionalTabResults[index]?.data === true).map(tab => ({
      ...tab,
      link: `${documentsPath}/${tab.link}`,
      end: false,
    })),
  ];

  return (
    <>
      <nav className="document-type-filter" aria-labelledby="document-type-filter-label">
        <span className="document-type-filter__label" id="document-type-filter-label">
          Document type
        </span>
        <ul className="document-type-filter__group" aria-busy={probing || undefined}>
          {probing && <span className="visually-hidden">Loading document types</span>}
          {probing &&
            PLACEHOLDER_WIDTHS.map(width => (
              <li key={width} aria-hidden="true">
                <span
                  className="document-type-filter__segment document-type-filter__segment--loading"
                  style={{ width }}
                >
                  <span className="placeholder placeholder-wave"></span>
                </span>
              </li>
            ))}
          {!probing &&
            tabs.map(tab => (
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
