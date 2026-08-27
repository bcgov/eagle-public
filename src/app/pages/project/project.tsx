import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { getById } from 'app/api/project';
import { getSearchResults } from 'app/api/search';
import { listsQueryOptions } from 'app/config/config';
import { logger } from 'app/config/logging';
import { Constants } from 'app/utils/constants';
import { createProjectTabModifiers, extractFromSearchResults } from 'app/utils/utils';
import { safeHtml } from 'app/utils/safe-html';
import { DetailsSidebar } from './details-sidebar';
import { EngageBanner } from './engage-banner';
import './project.css';

/** Always-visible tabs, in the order the Angular template rendered them. */
const FIXED_TABS = [
  { label: 'Project Details', link: 'project-details' },
  { label: 'Commenting', link: 'commenting' },
  { label: 'Documents', link: 'documents' }
];

/** Tabs shown only when the project actually has documents of that kind. */
const OPTIONAL_TABS = [
  { key: Constants.optionalProjectDocTabs.APPLICATION, label: 'Application', link: 'application' },
  { key: Constants.optionalProjectDocTabs.CERTIFICATE, label: 'Certificate', link: 'certificates' },
  { key: Constants.optionalProjectDocTabs.AMENDMENT, label: 'Amendment(s)', link: 'amendments' }
];

/** Comment periods near today, the window the banner draws from. */
function bannerWindow(): { start: string; end: string } {
  const start = new Date();
  const end = new Date();
  start.setDate(start.getDate() - 21);
  end.setDate(end.getDate() + 14);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Angular's `date:'MMMM d'`, e.g. "August 27". */
function monthAndDay(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function ProjectPage() {
  const { projId = '' } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: lists = [] } = useQuery(listsQueryOptions());

  const {
    data: project,
    isError,
    isSuccess
  } = useQuery({
    queryKey: ['project', projId],
    enabled: !!projId,
    queryFn: () => {
      const { start, end } = bannerWindow();
      return getById(projId, false, start, end);
    }
  });

  // Each optional tab costs one 1-result search; TanStack keys them so revisiting a tab or the
  // project does not re-ask.
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
          ''
        );
        const results = extractFromSearchResults(response ?? []);
        if (!results) {
          // getSearchResults turns any non-2xx into `null`, so a 502 and a project with no
          // documents of this kind look the same. Hiding the tab is the right degradation, but
          // it should not be invisible.
          logger.error(
            `Could not determine whether the ${tab.key} tab has documents; leaving it hidden`,
            'ProjectPage'
          );
          return false;
        }
        return results.length > 0;
      }
    }))
  });

  useEffect(() => {
    if (isError || (isSuccess && !project)) {
      window.alert("Uh-oh, couldn't load project");
      navigate('/projects');
    }
  }, [isError, isSuccess, project, navigate]);

  const tabs = [
    ...FIXED_TABS,
    ...OPTIONAL_TABS.filter((_, index) => optionalTabResults[index]?.data === true)
  ];

  const banner = project?.commentPeriodForBanner;
  const showBanner = !!banner?.isBannerVisible;

  function goToViewComments(): void {
    if (!banner || !project) return;
    const external = !!(banner.isMet && banner.metURL);
    track('Comment Period Banner Clicked', {
      project_id: project._id,
      project_name: project.name,
      status: banner.commentPeriodStatus,
      is_met: external,
      destination: external ? 'external_met' : 'comment_period_details'
    });
    if (external) {
      window.open(banner.metURL, '_blank');
    } else {
      navigate(`/p/${project._id}/cp/${banner._id}/details`);
    }
  }

  return (
    <div className="project" data-sidebar-state={sidebarOpen ? 'open' : 'closed'}>
      <main>
        <div className="project-info">
          <DetailsSidebar
            project={project ?? null}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(open => !open)}
          />
          <div className="content">
            {showBanner &&
              (banner.isMet && banner.metURL ? (
                <EngageBanner data={banner} />
              ) : (
                <div className="pcp-banner col-sm-12">
                  <div className="pcp-banner-content">
                    <div className="pcp-banner-header">
                      <div className="pcp-banner-info">
                        <h2>Public Comment Period is {banner.commentPeriodStatus}</h2>
                        <h5>
                          {monthAndDay(banner.dateStarted)} - {banner.endDateDisplay}
                        </h5>
                      </div>
                      {banner.commentPeriodStatus === 'Open' && (
                        <div className="pcp-banner-actions">
                          <button type="button" className="btn btn-outline-warning" onClick={goToViewComments}>
                            <span>View Comment Period</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {(banner.informationLabel || banner.instructions) && (
                      <div className="pcp-banner-description">
                        {banner.informationLabel && (
                          <p>
                            This Public Comment Period is regarding the <b>{banner.informationLabel}</b>
                          </p>
                        )}
                        {!banner.informationLabel && banner.instructions && (
                          <div id="instructions" dangerouslySetInnerHTML={safeHtml(banner.instructions)}></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            <div className="main-content">
              <section className="project-tabs">
                <TabBar projId={projId} tabs={tabs} projectName={project?.name} />
                <div className="tab-content">
                  <Outlet context={{ project: project ?? null, projId, lists }} />
                </div>
              </section>
            </div>

            <section className="people">
              <div className="container">
                <h2 className="mb-4">Contact Us</h2>
                <div className="d-flex flex-column flex-md-row gap-3 gap-md-5">
                  <div className="flex-md-1">
                    <p className="fw-bold mb-2">Project Assessment Team</p>
                    <p className="d-flex align-items-center mb-2">
                      <i className="material-icons me-2" aria-hidden="true">
                        email
                      </i>
                      <a href="mailto:eao.operations@gov.bc.ca">EAO.operations@gov.bc.ca</a>
                    </p>
                    <p className="d-flex align-items-center mb-2 text-muted">
                      <i className="material-icons me-2" aria-hidden="true">
                        phone
                      </i>
                      -
                    </p>
                  </div>
                  <div className="flex-md-1 contact-divider">
                    <p className="fw-bold mb-2">Compliance &amp; Enforcement</p>
                    <p className="d-flex align-items-center mb-2">
                      <i className="material-icons me-2" aria-hidden="true">
                        email
                      </i>
                      <a href="mailto:eao.compliance@gov.bc.ca">EAO.compliance@gov.bc.ca</a>
                    </p>
                    <p className="d-flex align-items-center mb-2">
                      <i className="material-icons me-2" aria-hidden="true">
                        phone
                      </i>
                      250-387-0131
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

interface TabBarProps {
  projId: string;
  tabs: { label: string; link: string }[];
  projectName?: string;
}

const SCROLL_STEP = 200;

/** Tab strip with scroll arrows, shown only while the strip actually overflows. */
function TabBar({ projId, tabs, projectName }: TabBarProps) {
  const navTabs = useRef<HTMLUListElement>(null);
  const [arrows, setArrows] = useState({ left: false, right: false });

  useEffect(() => {
    const element = navTabs.current;
    if (!element) return;

    const check = () => {
      const overflows = element.scrollWidth > element.clientWidth;
      setArrows({
        left: overflows && element.scrollLeft > 1,
        right: overflows && element.scrollLeft < element.scrollWidth - element.clientWidth - 1
      });
    };

    check();
    element.addEventListener('scroll', check);
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', check);
      observer.disconnect();
    };
  }, [tabs.length]);

  function scrollBy(distance: number): void {
    navTabs.current?.scrollBy({ left: distance, behavior: 'smooth' });
  }

  return (
    <div className="tabs-container">
      <ul className="nav-tabs" role="tablist" ref={navTabs}>
        {tabs.map(tab => (
          <li className="nav-item" role="presentation" key={tab.link}>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              role="tab"
              to={tab.link}
              replace
              id={tab.link === 'project-details' ? 'project-details-tab' : undefined}
              aria-controls={tab.link === 'project-details' ? 'project-details-panel' : undefined}
              onClick={() =>
                track('Project Tab Clicked', {
                  project_id: projId,
                  project_name: projectName ?? null,
                  tab_name: tab.label,
                  tab_path: tab.link
                })
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
      {arrows.left && (
        <button
          type="button"
          className="tab-arrow tab-arrow-left"
          aria-label="Scroll tabs left"
          style={{ display: 'flex' }}
          onClick={() => scrollBy(-SCROLL_STEP)}
        >
          &#8249;
        </button>
      )}
      {arrows.right && (
        <button
          type="button"
          className="tab-arrow tab-arrow-right"
          aria-label="Scroll tabs right"
          style={{ display: 'flex' }}
          onClick={() => scrollBy(SCROLL_STEP)}
        >
          &#8250;
        </button>
      )}
    </div>
  );
}
