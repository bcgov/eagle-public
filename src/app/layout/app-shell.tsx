import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Header } from './header';
import { Footer } from './footer';
import { ToastContainer } from 'app/components/toast-container';
import { Gate } from './gate';
import { useGateOpen } from 'app/state/gate';
import { page } from 'app/analytics/analytics';
import './app-shell.css';

/**
 * Human-readable page name from a URL path, with project IDs removed.
 * '/projects' => 'Projects', '/p/abc123/documents' => 'Documents', '/search' => 'Search'
 */
function getPageName(path: string): string {
  if (!path || path === '/') return 'Home';

  const cleanPath = path.split('?')[0].replace(/^\//, '');
  const segments = cleanPath.split('/');

  const filteredSegments = segments.filter(segment => {
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
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(' > ');
}

export function AppShell() {
  const { pathname, search } = useLocation();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const gateOpen = useGateOpen();
  const isProjectsRoute = pathname.startsWith('/projects');

  useEffect(() => {
    const path = pathname + search;
    page(getPageName(path), { path });
  }, [pathname, search]);

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
      <a className="skip-to-main" href="#main-content">
        Skip to main content
      </a>
      <div className="app-wrapper">
        <Header />
        <main id="main-content" tabIndex={-1} className={`app-content${isProjectsRoute ? ' projects-route' : ''}`}>
          <div id="scrollTop">
            <Outlet />
          </div>
        </main>
        <Footer className={isProjectsRoute ? 'hide-mobile-projects' : ''} />
      </div>

      <a
        href="#scrollTop"
        className={`btn scroll-top-btn${showScrollButton ? ' visible' : ''}`}
        onClick={scrollToTop}
      >
        <i className="material-icons" aria-label="Button to go to top of the page">arrow_upward</i>
      </a>

      <ToastContainer />
    </div>
  );
}
