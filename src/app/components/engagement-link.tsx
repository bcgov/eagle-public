import { useEffect } from 'react';
import { Link } from 'react-router';
import { logger } from 'app/config/logging';
import { engageUrl } from 'app/models/commentperiod';
import { NEW_TAB_SUFFIX, NewTabIcon } from './new-tab-hint';

interface EngagementLinkProps {
  /** The period's ENGAGE fields. A safe `metURL` makes this an external link. */
  isMet?: boolean | null;
  metURL?: string | null;
  /** Where the period lives in EPIC, used whenever it is not ENGAGE-hosted. */
  to?: string | null;
  /** Visible text. Kept a string so the external name can be built from it. */
  label: string;
  className?: string;
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
  onClick,
}: EngagementLinkProps) {
  const externalUrl = engageUrl({ isMet, metURL });
  const dropped = !!isMet && !externalUrl;

  useEffect(() => {
    if (dropped) {
      logger.warn('Ignored a link with an unsupported URL scheme', 'engagement-link', metURL);
    }
  }, [dropped, metURL]);

  if (externalUrl) {
    return (
      <a
        className={className}
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label}${NEW_TAB_SUFFIX}`}
        onClick={onClick}
      >
        <span className="link-label">{label}</span>
        <NewTabIcon />
      </a>
    );
  }

  if (!to) return null;

  return (
    <Link className={className} to={to} onClick={onClick}>
      {label}
    </Link>
  );
}
