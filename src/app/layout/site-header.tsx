import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { bannerColour, env } from 'app/config/config';
import './site-header.css';

/** The masthead, left to right after the mark and the site name. */
const NAV_LINKS = [
  { label: 'Map Explorer', to: '/projects' },
  { label: 'Search', to: '/search' },
  { label: 'About', to: '/about' },
];

/** The desktop breakpoint, the same 768px the media queries in site-header.css use. */
const DESKTOP_QUERY = '(min-width: 768px)';

/** The map page's filter bar is fixed against this (pages/projects/projlist-filters.css). */
function setHeaderHeight(header: HTMLElement): void {
  document.documentElement.style.setProperty('--header-total-height', `${header.offsetHeight}px`);
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

  // Watching the element, not the window, also catches the title rewrapping once BC Sans loads.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    setHeaderHeight(header);
    const observer = new ResizeObserver(() => setHeaderHeight(header));
    observer.observe(header, { box: 'border-box' });
    return () => observer.disconnect();
  }, []);

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
          <img
            className="eao-header__mark"
            src="/assets/images/BCID_H_rgb_rev_header.png"
            width={340}
            height={120}
            alt=""
          />
          <span className="eao-header__line" aria-hidden="true" />
          <span className="eao-header__title">EAO Project Information Centre</span>
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
        </nav>
      </div>
    </header>
  );
}
