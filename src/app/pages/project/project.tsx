import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { getById } from 'app/api/project';
import { listsQueryOptions } from 'app/api/api';
import { safeHtml } from 'app/utils/safe-html';
import { isSafeUrl, openExternal } from 'app/utils/safe-url';
import { DetailsSidebar } from './details-sidebar';
import { EngageBanner } from './engage-banner';
import { useProjectTabMeta, type ProjectTab } from './use-project-tab-meta';
import './project.css';

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
    isPending: projectLoading,
    isSuccess,
  } = useQuery({
    queryKey: ['project', projId],
    enabled: !!projId,
    queryFn: () => {
      const { start, end } = bannerWindow();
      return getById(projId, false, start, end);
    },
  });

  const tabs = useProjectTabMeta(projId, lists, project ?? null);

  const notFound = isError || (isSuccess && !project);

  const banner = project?.commentPeriodForBanner;
  const showBanner = !!banner?.isBannerVisible;

  function goToViewComments(): void {
    if (!banner || !project) return;
    const external = !!(banner.isMet && isSafeUrl(banner.metURL));
    track('Comment Period Banner Clicked', {
      project_id: project._id,
      project_name: project.name,
      status: banner.commentPeriodStatus,
      is_met: external,
      destination: external ? 'external_met' : 'comment_period_details',
    });
    if (external) {
      openExternal(banner.metURL);
    } else {
      navigate(`/p/${project._id}/cp/${banner._id}/details`);
    }
  }

  if (notFound) {
    return (
      <div className="container py-5">
        <h1>Project not found</h1>
        <p>This project is not available. It may have been removed, or the link may be wrong.</p>
        <Link to="/projects">Back to all projects</Link>
      </div>
    );
  }

  return (
    <div className="project" data-sidebar-state={sidebarOpen ? 'open' : 'closed'}>
      <main>
        <div className="project-info">
          <DetailsSidebar
            project={project ?? null}
            loading={projectLoading}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((open) => !open)}
          />
          <div className="content">
            {showBanner &&
              (banner.isMet && isSafeUrl(banner.metURL) ? (
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
                          <button
                            type="button"
                            className="btn btn-outline-warning"
                            onClick={goToViewComments}
                          >
                            <span>View Comment Period</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {(banner.informationLabel || banner.instructions) && (
                      <div className="pcp-banner-description">
                        {banner.informationLabel && (
                          <p>
                            This Public Comment Period is regarding the{' '}
                            <b>{banner.informationLabel}</b>
                          </p>
                        )}
                        {!banner.informationLabel && banner.instructions && (
                          <div
                            id="instructions"
                            dangerouslySetInnerHTML={safeHtml(banner.instructions)}
                          ></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            <div className="main-content">
              <section className="project-tabs">
                <TabBar
                  projId={projId}
                  tabs={tabs.filter((tab) => tab.show)}
                  projectName={project?.name}
                  ariaLabel="Project sections"
                />
                <div className="tab-content">
                  <Outlet context={{ project: project ?? null, projId, lists, projectLoading }} />
                </div>
              </section>
            </div>
          </div>
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
      </main>
    </div>
  );
}

interface TabBarProps {
  projId: string;
  tabs: ProjectTab[];
  projectName?: string;
  /** Names the strip for screen readers. */
  ariaLabel: string;
}

const SCROLL_STEP = 200;

/** Tab strip with scroll arrows, shown only while the strip actually overflows. */
function TabBar({ projId, tabs, projectName, ariaLabel }: TabBarProps) {
  const navTabs = useRef<HTMLUListElement>(null);
  const [arrows, setArrows] = useState({ left: false, right: false });

  useEffect(() => {
    const element = navTabs.current;
    if (!element) return;

    const check = () => {
      const overflows = element.scrollWidth > element.clientWidth;
      setArrows({
        left: overflows && element.scrollLeft > 1,
        right: overflows && element.scrollLeft < element.scrollWidth - element.clientWidth - 1,
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
      {/* Links, not tabs: each one routes, so the ARIA tab pattern would promise keyboard
          behaviour this strip does not have (PUBLIC-156). */}
      <nav aria-label={ariaLabel}>
        <ul className="nav-tabs" ref={navTabs}>
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.key}>
              <NavLink
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                to={tab.key}
                replace
                onClick={() =>
                  track('Project Tab Clicked', {
                    project_id: projId,
                    project_name: projectName ?? null,
                    tab_name: tab.label,
                    tab_path: tab.key,
                  })
                }
              >
                {tab.label}
                {tab.count && <span className="tab-count">{tab.count}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
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
