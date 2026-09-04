import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { getById } from 'app/api/project';
import { listsQueryOptions } from 'app/api/api';
import { isSafeUrl } from 'app/utils/safe-url';
import { EngageBanner } from './engage-banner';
import { ProjectMasthead } from './project-masthead';
import { ProjectPanel } from './project-panel';
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

export function ProjectPage() {
  const { projId = '' } = useParams();

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
  // The ENGAGE banner is the only comment-period banner the shell owns. The in-EPIC comment
  // period callout is rebuilt on the Overview tab in the next change (see TODO.md).
  const showEngage = !!banner?.isBannerVisible && !!banner.isMet && isSafeUrl(banner.metURL);

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
    <div className="project-page">
      <ProjectMasthead project={project ?? null} projId={projId} loading={projectLoading} />

      <main className="project-page__container">
        {showEngage && <EngageBanner data={banner} />}

        <ProjectPanel project={project ?? null} lists={lists} loading={projectLoading} />

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
