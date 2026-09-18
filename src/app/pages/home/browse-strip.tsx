import { Link } from 'react-router';
import { searchUrl } from 'app/routes/legacy-search';

/**
 * The masthead carries four items, so the rest of the site is reached from here. This strip is the
 * only link on the site to /process, /legislation and /compliance-oversight: keep all three.
 */
const ENTRIES: { label: string; to: string; icon: string }[] = [
  { label: 'Map Explorer', to: '/projects', icon: 'map' },
  { label: 'All projects', to: searchUrl('projects'), icon: 'format_list_bulleted' },
  { label: 'Project notifications', to: searchUrl('notifications'), icon: 'notifications' },
  { label: 'The assessment process', to: '/process', icon: 'timeline' },
  { label: 'Legislation', to: '/legislation', icon: 'account_balance' },
  { label: 'Compliance oversight', to: '/compliance-oversight', icon: 'assignment_turned_in' },
];

export function BrowseStrip() {
  return (
    <nav className="home-browse" aria-label="Browse">
      <ul className="home-browse__list">
        {ENTRIES.map((entry) => (
          <li key={entry.to}>
            <Link className="home-browse__link" to={entry.to}>
              <i className="material-icons home-browse__icon" aria-hidden="true">
                {entry.icon}
              </i>
              {/* The label carries the underline, so the icon is never struck through. */}
              <span className="home-browse__label">{entry.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
