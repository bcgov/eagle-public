import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ExternalLink } from 'app/components/external-link';
import { contentHrefKind } from './content-href';

/**
 * A link from page content. An `https:` page opens in a new tab and says so, mail and phone links
 * open in place, and a site path is an in-app link. Any other href renders as plain text.
 */
export function ContentLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  switch (contentHrefKind(href)) {
    case 'external':
      return (
        <ExternalLink className={className} href={href}>
          {children}
        </ExternalLink>
      );
    case 'same-tab':
      return (
        <a className={className} href={href}>
          {children}
        </a>
      );
    case 'site':
      return (
        <Link className={className} to={href}>
          {children}
        </Link>
      );
    default:
      return <>{children}</>;
  }
}
