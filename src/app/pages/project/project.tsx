import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useMatch, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { track } from 'app/analytics/analytics';
import { getById } from 'app/api/project';
import { listsQueryOptions } from 'app/api/api';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { searchUrl } from 'app/routes/legacy-search';
import { ExtendedPageContext, type ProjectContext } from './project-context';
import { ProjectMasthead } from './project-masthead';
import { ProjectPanel } from './project-panel';
import { useExtendedTabMeta, useProjectTabMeta, type ProjectTab } from './use-project-tab-meta';
import { BlockList } from './extended/blocks/block-list';
import { bannerFor, extendedPageFor } from './extended/extended-page';
import { extendedPanelParts } from './extended/extended-shell';
import type { ExtendedPage } from './extended/types';
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
    isPending,
    isSuccess,
  } = useQuery({
    queryKey: ['project', projId],
    enabled: !!projId,
    queryFn: () => {
      const { start, end } = bannerWindow();
      return getById(projId, false, start, end);
    },
  });

  const extended = extendedPageFor(projId);
  const shell = {
    project: project ?? null,
    projId,
    lists,
    isPending,
    // An extended page's content is static, so a failed read still leaves a page worth showing.
    notFound: (isError && !extended) || (isSuccess && !project),
  };

  // Two components, so each page runs only its own tab queries.
  return extended ? (
    <ExtendedProjectShell {...shell} extended={extended} />
  ) : (
    <EaoProjectShell {...shell} />
  );
}

/** The open tab stays in the strip even when its rule would hide it, so the page never loses it. */
function useVisibleTabs(tabs: ProjectTab[]): ProjectTab[] {
  const activeTab = useMatch('/p/:projId/:tab/*')?.params['tab'];
  return tabs.filter((tab) => tab.show || tab.key === activeTab);
}

type ShellBaseProps = Omit<ProjectShellProps, 'tabs' | 'extended' | 'isNotification'>;

function EaoProjectShell(props: ShellBaseProps) {
  const tabs = useVisibleTabs(useProjectTabMeta(props.projId, props.lists, props.project));
  return <ProjectShell {...props} tabs={tabs} />;
}

function ExtendedProjectShell(props: ShellBaseProps & { extended: ExtendedPage }) {
  const tabs = useVisibleTabs(
    useExtendedTabMeta(props.projId, props.extended, props.lists, props.project),
  );
  return <ProjectShell {...props} tabs={tabs} />;
}

/** The open tab's `banner` blocks, full width between the strip and the tab. */
function TabBanner({
  extended,
  project,
  basePath,
}: {
  extended: ExtendedPage;
  project: Project | null;
  basePath: string;
}) {
  const segment = useMatch(`${basePath}/:segment/*`)?.params['segment'] ?? '';
  const banner = bannerFor(extended, segment);
  if (!banner.length) return null;
  return (
    <BlockList
      blocks={banner}
      context={{ segment, content: extended, project, basePath, level: 2, labelled: true }}
    />
  );
}

interface ProjectShellProps {
  project: Project | null;
  projId: string;
  /** The record is a project notification: its links hang off `/pn/`, not `/p/`. */
  isNotification?: boolean;
  /** The project has an extended page: whichever masthead and panel parts and tabs it sets. */
  extended?: ExtendedPage | null;
  lists: ProjectContext['lists'];
  /** The tabs to show, already filtered. */
  tabs: ProjectTab[];
  isPending: boolean;
  notFound: boolean;
}

/** Masthead, summary panel, tab strip and the open tab: the frame every project-like page shares. */
export function ProjectShell({
  project,
  projId,
  isNotification = false,
  extended = null,
  lists,
  tabs,
  isPending,
  notFound,
}: ProjectShellProps) {
  const basePath = `${isNotification ? '/pn' : '/p'}/${projId}`;

  if (notFound) {
    return isNotification ? (
      <div className="container py-5">
        <h1>Project notification not found</h1>
        <p>
          This project notification is not available. It may have been removed, or the link may be
          wrong.
        </p>
        <Link to={searchUrl('notifications')}>Back to all project notifications</Link>
      </div>
    ) : (
      <div className="container py-5">
        <h1>Project not found</h1>
        <p>This project is not available. It may have been removed, or the link may be wrong.</p>
        <Link to="/projects">Back to all projects</Link>
      </div>
    );
  }

  const context: ProjectContext = {
    project,
    projId,
    basePath,
    isNotification,
    lists,
    projectLoading: isPending,
  };

  return (
    <ExtendedPageContext value={extended}>
      <div className="project-page">
        <ProjectMasthead
          project={project}
          projId={projId}
          isNotification={isNotification}
          loading={isPending}
          extended={extended}
        />

        <div className="project-page__panel">
          <div className="page-container">
            <ProjectPanel
              project={project}
              lists={lists}
              loading={isPending}
              isNotification={isNotification}
              parts={extended ? extendedPanelParts(extended, project) : undefined}
            />
          </div>
        </div>

        <div className="project-page__tabs project-tabs">
          <div className="page-container">
            <TabBar
              projId={projId}
              tabs={tabs}
              projectName={extended?.displayName ?? project?.name}
              isNotification={isNotification}
            />
          </div>
        </div>

        {/* Full width between the strip and the tab, so it lives here rather than in the tab. */}
        {extended && <TabBanner extended={extended} project={project} basePath={basePath} />}

        {/* Not a landmark: the app shell's <main> already holds the whole page. */}
        <div className="page-container project-page__content">
          <Outlet context={context} />
        </div>
      </div>
    </ExtendedPageContext>
  );
}

interface TabBarProps {
  projId: string;
  tabs: ProjectTab[];
  projectName?: string;
  isNotification: boolean;
}

const SCROLL_STEP = 200;

/** Tab strip with scroll arrows, shown only while the strip actually overflows. */
function TabBar({ projId, tabs, projectName, isNotification }: TabBarProps) {
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
      <nav aria-label={isNotification ? 'Project notification sections' : 'Project sections'}>
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
                    record_type: isNotification ? 'notification' : 'project',
                  })
                }
              >
                {tab.label}
                {tab.count && (
                  <>
                    <span className="visually-hidden">,</span>{' '}
                    <span className="tab-count">{tab.count}</span>
                  </>
                )}
                {/* Held open so the strip does not jump when the count lands. */}
                {!tab.count && tab.countPending && (
                  <Skeleton className="tab-count tab-count--loading" width="1.5rem" />
                )}
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
