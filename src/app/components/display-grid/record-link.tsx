import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { NewTabHint } from 'app/components/new-tab-hint';
import { isSafeUrl } from 'app/utils/safe-url';

interface RecordLinkProps {
  href?: string;
  /** Leaves the app, so it gets a real anchor and its own tab rather than a client-side route. */
  external?: boolean;
  className?: string;
  title?: string;
  /** Runs instead of following the href. The anchor keeps it, so copy-link still gets the target. */
  onClick?: () => void;
  children: ReactNode;
}

/** A record's name as the link to the record, or as plain text where it has no page of its own. */
export function RecordLink({
  href,
  external,
  className,
  title,
  onClick,
  children,
}: RecordLinkProps) {
  if (!isSafeUrl(href)) return <>{children}</>;
  const intercept = onClick
    ? (event: MouseEvent) => {
        event.preventDefault();
        onClick();
      }
    : undefined;
  if (external) {
    return (
      <a
        className={className}
        href={href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
        onClick={intercept}
      >
        {children}
        {/* An intercepted click downloads in place, so only a plain anchor announces the new tab. */}
        {intercept ? null : <NewTabHint />}
      </a>
    );
  }
  return (
    <Link className={className} to={href} title={title} onClick={intercept}>
      {children}
    </Link>
  );
}
