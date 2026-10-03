import { Link } from 'react-router';
import './breadcrumbs.css';

export interface Crumb {
  label: string;
  /** Where the crumb leads. The last crumb is the page you are on, so its target is ignored. */
  to?: string;
}

interface BreadcrumbsProps {
  /** Ordered, root first. The last entry names the current page. */
  items: Crumb[];
}

/** The trail that leads back out of a page. Rides the blue band, so its ink is inverted. */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="breadcrumbs__item">
            {index === items.length - 1 || !item.to ? (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
