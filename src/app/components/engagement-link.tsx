import { Link } from 'react-router';
import { logger } from 'app/config/logging';
import { isSafeUrl } from 'app/utils/safe-url';
import './engagement-link.css';

const NEW_TAB_SUFFIX = ' (opens in new tab)';

/** The mark every link that leaves the tab carries. Decorative: the name says it in words. */
export function NewTabIcon() {
  return (
    <i className="material-icons new-tab-hint__icon" aria-hidden="true">
      open_in_new
    </i>
  );
}

/** The icon plus screen-reader text, for links whose label is markup rather than a string. */
export function NewTabHint() {
  return (
    <>
      <NewTabIcon />
      <span className="visually-hidden">{NEW_TAB_SUFFIX}</span>
    </>
  );
}

interface EngagementLinkProps {
  /** The period's ENGAGE fields. A safe `metURL` makes this an external link. */
  isMet?: boolean | null;
  metURL?: string | null;
  /** Where the period lives in EPIC, used whenever it is not ENGAGE-hosted. */
  to?: string | null;
  /** Visible text. Kept a string so the external name can be built from it. */
  label: string;
  className?: string;
  title?: string;
  /** Analytics. A plain click only: middle-click and ctrl-click never reach it. */
  onClick?: () => void;
}

/**
 * The one control that opens a comment period. ENGAGE-hosted periods get a real anchor, so the URL
 * shows on hover, middle-click and "copy link" work, and assistive tech announces the new tab.
 * Everything else gets a router link. Renders nothing when the period has neither destination.
 */
export function EngagementLink({
  isMet,
  metURL,
  to,
  label,
  className,
  title,
  onClick,
}: EngagementLinkProps) {
  if (isMet) {
    if (isSafeUrl(metURL)) {
      return (
        <a
          className={className}
          href={metURL}
          title={title}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label}${NEW_TAB_SUFFIX}`}
          onClick={onClick}
        >
          {label}
          <NewTabIcon />
        </a>
      );
    }
    logger.warn('Ignored a link with an unsupported URL scheme', 'engagement-link', metURL);
  }

  if (!to) return null;

  return (
    <Link className={className} to={to} title={title} onClick={onClick}>
      {label}
    </Link>
  );
}
