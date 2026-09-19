import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from './breadcrumbs';
import './page-masthead.css';

interface PageMastheadProps {
  /** The page's h1. A node, so a page can stand a placeholder in while the name loads. */
  title: ReactNode;
  /** Root first, current page last. Left off on the site root, which leads nowhere. */
  breadcrumbs?: Crumb[];
  /** One line under the title. */
  meta?: ReactNode;
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
          </div>
          {actions && <div className="page-masthead__actions">{actions}</div>}
        </div>

        {children}
      </div>
    </section>
  );
}
