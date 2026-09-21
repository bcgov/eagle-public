import { useEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import type { GetScrollRestorationKeyFunction } from 'react-router';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { DownloadPanel } from 'app/components/download-panel';
import { ToastContainer } from 'app/components/toast-container';
import { Gate } from './gate';
import { useGateOpen } from 'app/state/gate';
import { page } from 'app/analytics/analytics';
import { hashToPath } from 'app/routes/legacy-search';
import './app-shell.css';

/**
 * Human-readable page name from a URL path, with project IDs removed.
 * '/projects' => 'Projects', '/p/abc123/documents' => 'Documents', '/search' => 'Search'
 */
function getPageName(path: string): string {
  if (!path || path === '/') return 'Home';

  const cleanPath = path.split('?')[0].replace(/^\//, '');
  const segments = cleanPath.split('/');

  const filteredSegments = segments.filter((segment) => {
    // Skip segments that look like IDs (UUIDs or long alphanumeric)
    if (/^[0-9a-f-]{20,}$/i.test(segment)) return false;
    // Skip 'p' prefix for project routes
    if (segment === 'p') return false;
    // Skip 'cp' prefix for comment period routes
    if (segment === 'cp') return false;
    return segment.length > 0;
  });

  if (filteredSegments.length === 0) return 'Project';

  return filteredSegments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(' > ');
}

/**
 * Scroll key per page visit, not per history entry or per path: a link to a page opens it at the
 * top, back and forward restore, and a tab or filter change on the same page keeps the position.
 */
function createScrollKey(): GetScrollRestorationKeyFunction {
  const keyByEntry = new Map<string, string>();
  let last: { page: string; key: string } | null = null;
  return (location, matches) => {
    const page = matches[1]?.pathname ?? location.pathname;
    let key = keyByEntry.get(location.key);
    if (!key) {
      // The router reads the outgoing entry's key just before a new entry's, so `last` is the
      // page being left.
      key = last?.page === page ? last.key : `${page}#${location.key}`;
      keyByEntry.set(location.key, key);
    }
    last = { page, key };
    return key;
  };
}

export function AppShell() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const gateOpen = useGateOpen();
  const isProjectsRoute = pathname.startsWith('/projects');
  const [scrollKey] = useState(createScrollKey);

  // Ref guard, not a dep-array change: React StrictMode re-runs this effect once on mount
  // (setup, cleanup, setup) in dev without an intervening path change, which would otherwise
  // double-post the same page view. Skipping a repeat of the same path absorbs that without
  // ever skipping a real navigation.
  const lastTrackedPath = useRef<string | null>(null);
  useEffect(() => {
    const path = pathname + search;
    if (lastTrackedPath.current === path) return;
    lastTrackedPath.current = path;
    page(getPageName(path), { path });
  }, [pathname, search]);

  // The Angular app addressed pages through the hash: /#/projects-list. Turn one back into a real
  // path so the route loaders can redirect it like any other legacy address. The hash is gone
  // after this, so it runs once.
  useEffect(() => {
    const path = hashToPath(hash);
    if (path) navigate(path, { replace: true });
  }, [hash, navigate]);

  useEffect(() => {
    // Show button when scrolled down more than 300px
    const handleScroll = () => setShowScrollButton(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function scrollToTop(event: React.MouseEvent): void {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!gateOpen) {
    return <Gate />;
  }

  return (
    <div className="app-root">
      <ScrollRestoration getKey={scrollKey} />
      <a className="skip-to-main" href="#main-content">
        Skip to main content
      </a>
      <div className="app-wrapper">
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className={`app-content${isProjectsRoute ? ' projects-route' : ''}`}
        >
          <div id="scrollTop">
            <Outlet />
          </div>
        </main>
        <SiteFooter />
      </div>

      <a
        href="#scrollTop"
        className={`btn scroll-top-btn${showScrollButton ? ' visible' : ''}`}
        onClick={scrollToTop}
      >
        <i className="material-icons" aria-label="Button to go to top of the page">
          arrow_upward
        </i>
      </a>

      <DownloadPanel />
      <ToastContainer />
    </div>
  );
}
