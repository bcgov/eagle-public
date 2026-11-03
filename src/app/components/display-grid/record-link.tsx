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
  /** The intercepted click opens a tab of its own (a PDF in the browser's viewer, say). */
  newTab?: boolean;
  children: ReactNode;
}

/** A record's name as the link to the record, or as plain text where it has no page of its own. */
export function RecordLink({
  href,
  external,
  className,
  title,
  onClick,
  newTab,
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
        {/* An intercepted click downloads in place unless the caller says it opens a tab. */}
        {intercept && !newTab ? null : <NewTabHint />}
      </a>
    );
  }
  return (
    <Link className={className} to={href} title={title} onClick={intercept}>
      {children}
    </Link>
  );
}

/**
 * A record's name with the marker it carries, before it or after it. Only the words sit in
 * `.link-label`, so the hover underline leaves the marker alone.
 */
export function BadgedName({
  badge,
  after,
  children,
}: {
  badge?: ReactNode;
  after?: boolean;
  children: ReactNode;
}) {
  if (!badge) return <>{children}</>;
  const label = <span className="link-label">{children}</span>;
  // A no-break space holds a trailing marker to the name's last word when the name wraps.
  return after ? (
    <>
      {label}
      {'\u00a0'}
      {badge}
    </>
  ) : (
    <>
      {badge} {label}
    </>
  );
}
