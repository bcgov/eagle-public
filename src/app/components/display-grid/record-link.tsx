import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { isSafeUrl } from 'app/utils/safe-url';

interface RecordLinkProps {
  href?: string;
  /** Leaves the app, so it gets a real anchor and its own tab rather than a client-side route. */
  external?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** A record's name as the link to the record, or as plain text where it has no page of its own. */
export function RecordLink({ href, external, className, title, children }: RecordLinkProps) {
  if (!isSafeUrl(href)) return <>{children}</>;
  if (external) {
    return (
      <a className={className} href={href} title={title} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link className={className} to={href} title={title}>
      {children}
    </Link>
  );
}
