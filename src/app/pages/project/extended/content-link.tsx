import { useContext, type ReactNode } from 'react';
import { Link, matchRoutes, UNSAFE_DataRouterContext } from 'react-router';
import { ExternalLink } from 'app/components/external-link';
import { contentHrefKind } from './content-href';

/** True unless only the catch-all route takes `path`, which sends it home: a file or an API download. */
function isAppPath(routes: Parameters<typeof matchRoutes>[0] | undefined, path: string): boolean {
  if (!routes) return true;
  return matchRoutes(routes, path)?.at(-1)?.route.path !== '*';
}

/**
 * A link from page content. An `https:` page opens in a new tab and says so, mail and phone links
 * open in place, and a site path the app routes is an in-app link; any other site path loads as a
 * document. Any other href renders as plain text, keeping `className`.
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
  // Outside a data router there is no route list; every site path stays an in-app link.
  const routes = useContext(UNSAFE_DataRouterContext)?.router.routes;
  const kind = contentHrefKind(href);
  if (kind === 'external') {
    return (
      <ExternalLink className={className} href={href}>
        {children}
      </ExternalLink>
    );
  }
  if (kind === 'site' && isAppPath(routes, href)) {
    return (
      <Link className={className} to={href}>
        {children}
      </Link>
    );
  }
  if (kind) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }
  return className ? <span className={className}>{children}</span> : <>{children}</>;
}
