import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { NEW_TAB_SUFFIX } from 'app/components/engagement-link';
import { adminUrl, bannerColour, env } from 'app/config/config';
import './site-header.css';

/** The masthead, left to right after the mark and the site name. Staff Login is added last. */
const NAV_LINKS = [
  { label: 'Map Explorer', to: '/projects' },
  { label: 'Search', to: '/projects-list' },
  { label: 'Contact Us', to: '/contact' },
];

const SITE_TITLE = 'Environmental Assessment Office Project Information Centre';

/** The desktop breakpoint, the same 768px the media query in site-header.css uses. */
const DESKTOP_QUERY = '(min-width: 768px)';

/** The map page's filter bar is fixed against this (pages/projects/projlist-filters.css). */
function setHeaderHeight(header: HTMLElement | null): void {
  const height = header ? `${header.offsetHeight}px` : '0px';
  document.documentElement.style.setProperty('--header-total-height', height);
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const togglerRef = useRef<HTMLButtonElement>(null);

  const envName = env();
  const colour = bannerColour();
  const hasValidColour = !!colour && colour !== 'no-banner-colour-set';
  const showBanner = envName === 'local' || (!!envName && hasValidColour);

  function closeMenu(): void {
    setMenuOpen(false);
  }

  // Staff Login opens a new tab, so this tab keeps focus. Without this it would land on <body>
  // once the panel closes under it; hand it back to the toggler, the same place Escape does.
  function closeStaffLogin(): void {
    togglerRef.current?.focus();
    setMenuOpen(false);
  }

  // A navigation the panel did not start — the back button, a link on the page — would leave it
  // open. Adjusting during render rather than in an effect keeps it from painting open once first.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest('.eao-header')) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setMenuOpen(false);
      togglerRef.current?.focus();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // The media query already shows every link above 768px; resetting the state stops the panel
  // coming back open the next time the window narrows.
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMenuOpen(false);
      }
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setHeaderHeight(headerRef.current);
    let timeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setHeaderHeight(headerRef.current), 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname, showBanner, menuOpen]);

  return (
    <header className="eao-header" id="header" ref={headerRef}>
      {showBanner && (
        <div className={`env-banner ${colour}`}>
          This is the&nbsp;<strong>{envName}</strong>&nbsp;environment. The content you are viewing
          is not final and subject to change.
        </div>
      )}
      <div className="eao-header__row">
        {/* Mark and name are one link, so home is a single stop rather than two in a row. */}
        <Link className="eao-header__home" to="/" onClick={closeMenu}>
          <img className="eao-header__mark" src="/assets/images/BCID_H_rgb_rev.svg" alt="" />
          <span className="eao-header__line" aria-hidden="true" />
          <span className="eao-header__title">EPIC</span>
          <span className="visually-hidden">{` ${SITE_TITLE}`}</span>
        </Link>
        <button
          className="eao-header__toggler"
          type="button"
          ref={togglerRef}
          onClick={() => setMenuOpen((open) => !open)}
          aria-controls="mainNav"
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          <i className="material-icons" aria-hidden="true">
            {menuOpen ? 'close' : 'menu'}
          </i>
        </button>
        <nav
          className={`eao-header__nav${menuOpen ? ' eao-header__nav--open' : ''}`}
          id="mainNav"
          aria-label="Main"
        >
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} className="eao-header__link" to={link.to} onClick={closeMenu}>
              {link.label}
            </NavLink>
          ))}
          {/* No sign-in of its own here: staff sign in to eagle-admin, as from the footer. */}
          <a
            className="eao-header__link eao-header__link--action"
            href={adminUrl()}
            target="_blank"
            rel="noopener"
            title="Staff Login"
            onClick={closeStaffLogin}
          >
            {/* Words first: the panel shows them, the bar clips them so the name still reads. */}
            <span className="eao-header__action-label">Staff Login</span>
            <span className="visually-hidden">{NEW_TAB_SUFFIX}</span>
            {/* Material's `login` glyph, inline: it is not in the bundled Material Icons font.
                It stands in for the words on the bar, and is hidden in the panel below them. */}
            <svg
              className="eao-header__action-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}
