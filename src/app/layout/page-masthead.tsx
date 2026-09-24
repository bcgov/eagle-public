import type { ReactNode } from 'react';
import { NewTabHint } from 'app/components/new-tab-hint';
import { Breadcrumbs, type Crumb } from './breadcrumbs';
import './page-masthead.css';

interface PageMastheadProps {
  /** The page's h1. A node, so a page can stand a placeholder in while the name loads. */
  title: ReactNode;
  /** Root first, current page last. Left off on the site root, which leads nowhere. */
  breadcrumbs?: Crumb[];
  /** One line under the title. Elides at desktop, so keep it short. */
  meta?: ReactNode;
  /** A sentence or two about the page, under the title. Wraps at the masthead width. */
  lede?: ReactNode;
  /** Controls that sit beside the title. */
  actions?: ReactNode;
  /** What the page puts under the title row, inside the band. */
  children?: ReactNode;
  /** The page is still fetching what the band names. */
  busy?: boolean;
  /** Extra class on the band, for pages that style their own actions or content. */
  className?: string;
}

/** The blue band every page opens with: where you are, what the page is, what you can do here. */
export function PageMasthead({
  title,
  breadcrumbs,
  meta,
  lede,
  actions,
  children,
  busy,
  className,
}: PageMastheadProps) {
  return (
    /* A `section` with no accessible name: the band groups the page's opening content without
       adding a second landmark beside the site header's banner. */
    <section
      className={className ? `page-masthead ${className}` : 'page-masthead'}
      aria-busy={busy || undefined}
    >
      <div className="page-masthead__inner page-container">
        {/* Always rendered: the row holds its height on a page with no trail, so every page's
            title starts at the same place. */}
        <div className="page-masthead__trail">
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        </div>

        <div className="page-masthead__row">
          <div className="page-masthead__titles">
            <h1
              className="page-masthead__title"
              /* One line at desktop, so a long name cannot change the band's height. */
              title={typeof title === 'string' ? title : undefined}
            >
              {title}
            </h1>
            {meta && <p className="page-masthead__meta">{meta}</p>}
            {lede && <p className="page-masthead__lede">{lede}</p>}
          </div>
          {actions && <div className="page-masthead__actions">{actions}</div>}
        </div>

        {children}
      </div>
    </section>
  );
}

interface MastheadLinkProps {
  label: string;
  href: string;
  /** Material icon shown before the label. Ignored on a new-tab link, which carries its own. */
  icon?: string;
  /** Open in a new tab. The accessible name then says so. */
  newTab?: boolean;
}

/** A link in the band's actions row, in the site's one on-dark button style. */
export function MastheadLink({ label, href, icon, newTab }: MastheadLinkProps) {
  return (
    <a
      className="btn-on-dark"
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
    >
      {icon && !newTab && (
        <i className="material-icons" aria-hidden="true">
          {icon}
        </i>
      )}
      <span className="link-label">{label}</span>
      {newTab && <NewTabHint />}
    </a>
  );
}
