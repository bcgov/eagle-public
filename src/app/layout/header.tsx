import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { bannerColour, env } from 'app/config/config';
import './header.css';

function updateHeaderHeight(): void {
  const headerElement = document.querySelector('.app-header') as HTMLElement | null;
  const totalHeight = headerElement ? `${headerElement.offsetHeight}px` : '0px';
  document.documentElement.style.setProperty('--header-total-height', totalHeight);
}

export function Header() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  function closeMenus(): void {
    setMenuOpen(false);
    setOpenDropdown(null);
  }

  const envName = env();
  const colour = bannerColour();
  const hasValidColour = !!colour && colour !== 'no-banner-colour-set';
  const showBanner = envName === 'local' || (!!envName && hasValidColour);

  // What Bootstrap's dropdown JS did before it was dropped: a click outside shuts the open menu,
  // and Escape shuts it and hands focus back to the toggle.
  useEffect(() => {
    if (!openDropdown) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest('.nav-item.dropdown')) {
        setOpenDropdown(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        document.getElementById(openDropdown)?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openDropdown]);

  useEffect(() => {
    updateHeaderHeight();
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateHeaderHeight, 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname, showBanner]);

  return (
    <header
      className={`app-header${pathname.startsWith('/projects') ? ' app-header--flex' : ''}${pathname.startsWith('/p/') ? ' app-header--solid' : ''}`}
      id="header"
    >
      <nav className="navbar navbar-expand-md justify-content-between">
        <Link
          className="navbar-brand"
          title="Environmental Assessment Office Project Information Centre"
          tabIndex={0}
          to="/"
          onClick={closeMenus}
        >
          <span className="navbar-brand__title">EPIC</span>
        </Link>
        <button
          className="navbar-toggler"
          tabIndex={0}
          type="button"
          title="Toggle Main Navigation"
          onClick={() => setMenuOpen((open) => !open)}
          aria-controls="mainNav"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <i className="material-icons">menu</i>
          <span>MENU</span>
        </button>
        <div className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`} id="mainNav">
          <ul className="navbar-nav">
            <li className="nav-item">
              <Link
                className="nav-link"
                to="/projects"
                title="Find EAO Projects in British Columbia"
                onClick={closeMenus}
              >
                <span>Map View</span>
              </Link>
            </li>
            <li className={`nav-item dropdown${openDropdown === 'searchProjects' ? ' show' : ''}`}>
              <button
                className="nav-link dropdown-toggle"
                id="searchProjects"
                type="button"
                onClick={() =>
                  setOpenDropdown((open) => (open === 'searchProjects' ? null : 'searchProjects'))
                }
                aria-haspopup="true"
                aria-expanded={openDropdown === 'searchProjects'}
              >
                <span>Project Information</span>
                <span className="caret"></span>
              </button>
              <div
                className={`dropdown-menu dropdown-menu-end${openDropdown === 'searchProjects' ? ' show' : ''}`}
                aria-labelledby="searchProjects"
              >
                <Link
                  className="dropdown-item"
                  to="/projects-list"
                  title="List Projects"
                  onClick={closeMenus}
                >
                  <div className="dd-item-header">
                    <span className="icon align-middle">
                      <i className="material-icons">list</i>
                    </span>
                    <strong>List of Projects</strong>
                  </div>
                  <span className="dd-item-desc">
                    Access all information relating to projects that have been involved with an
                    environmental assessment in British Columbia
                  </span>
                </Link>
                <Link
                  className="dropdown-item"
                  to="/project-notifications"
                  title="Project Notifications"
                  onClick={closeMenus}
                >
                  <div className="dd-item-header">
                    <span className="icon align-middle">
                      <i className="material-icons">view_list</i>
                    </span>
                    <strong>List of Project Notifications</strong>
                  </div>
                  <span className="dd-item-desc">
                    Access information related to Project Notifications
                  </span>
                </Link>
                <Link
                  className="dropdown-item"
                  to="/search"
                  title="Search Documents"
                  onClick={closeMenus}
                >
                  <div className="dd-item-header">
                    <span className="icon align-middle">
                      <i className="material-icons">search</i>
                    </span>
                    <strong>All Documents</strong>
                  </div>
                  <span className="dd-item-desc">
                    Access a list of all documents associated with any projects involved with an
                    environmental assessment in British Columbia
                  </span>
                </Link>
              </div>
            </li>
            <li className={`nav-item dropdown${openDropdown === 'aboutMMTI' ? ' show' : ''}`}>
              <button
                className="nav-link dropdown-toggle"
                id="aboutMMTI"
                type="button"
                onClick={() =>
                  setOpenDropdown((open) => (open === 'aboutMMTI' ? null : 'aboutMMTI'))
                }
                aria-haspopup="true"
                aria-expanded={openDropdown === 'aboutMMTI'}
              >
                <span>The EA Process</span>
                <span className="caret"></span>
              </button>
              <div
                className={`dropdown-menu dropdown-menu-end${openDropdown === 'aboutMMTI' ? ' show' : ''}`}
                aria-labelledby="aboutMMTI"
              >
                <Link className="dropdown-item" to="/legislation" onClick={closeMenus}>
                  <strong>Legislation</strong>
                  <span className="dd-item-desc">
                    Learn about the legislation and regulations that apply to environmental
                    assessments in the province of British Columbia.
                  </span>
                </Link>
                <Link className="dropdown-item" to="/process" onClick={closeMenus}>
                  <strong>Process &amp; Procedures</strong>
                  <span className="dd-item-desc">
                    Learn more about how the Environmental Assessment Office neutrally administers a
                    process that holds all participants accountable.
                  </span>
                </Link>
                <Link className="dropdown-item" to="/compliance-oversight" onClick={closeMenus}>
                  <strong>Compliance Oversight</strong>
                  <span className="dd-item-desc">
                    Learn about how we collaborate with other agencies to coordinate oversight of
                    environmental assessment projects.
                  </span>
                </Link>
                <a
                  className="dropdown-item"
                  href="https://www2.gov.bc.ca/gov/content?id=525CA0BFCC5441C2B8FABCCF7B14004D"
                  target="_blank"
                  rel="noopener"
                  onClick={closeMenus}
                >
                  <strong>Dispute Resolution</strong>
                  <span className="dd-item-desc">
                    Learn about dispute resolution between First Nations and the Province.
                  </span>
                </a>
              </div>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/contact" title="Contact Us" onClick={closeMenus}>
                <span>Contact Us</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>
      {showBanner && (
        <div className={`env-banner ${colour}`} tabIndex={0}>
          This is the&nbsp;<strong>{envName}</strong>&nbsp;environment. The content you are viewing
          is not final and subject to change.
        </div>
      )}
    </header>
  );
}
