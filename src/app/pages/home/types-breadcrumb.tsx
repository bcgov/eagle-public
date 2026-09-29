import type { Ref } from 'react';
import { Link } from 'react-router';

export interface TypesCrumb {
  name: string;
  /** Link back to this level; unused on the current (last) crumb. */
  href?: string;
}

export interface TypesBreadcrumbProps {
  crumbs: readonly TypesCrumb[];
  /** The current level's crumb, focused after a level change. */
  currentRef: Ref<HTMLSpanElement>;
}

/** "All types › Mines › Coal Mines": earlier levels are links, the last one is where you are. */
export function TypesBreadcrumb({ crumbs, currentRef }: TypesBreadcrumbProps) {
  const last = crumbs.length - 1;
  return (
    <nav aria-label="Chart level" className="home-types__breadcrumb">
      <ol>
        {crumbs.map((crumb, i) =>
          i < last ? (
            <li key={i}>
              <Link to={crumb.href ?? '?'} preventScrollReset className="home-types__crumb">
                {crumb.name}
              </Link>
              <span className="home-types__crumb-sep" aria-hidden="true">
                ›
              </span>
            </li>
          ) : (
            <li key={i}>
              <span
                ref={currentRef}
                className="home-types__crumb-current"
                aria-current="location"
                tabIndex={-1}
              >
                {crumb.name}
              </span>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}
