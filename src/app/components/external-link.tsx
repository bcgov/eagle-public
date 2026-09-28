import type { ReactNode } from 'react';
import { NewTabHint } from './new-tab-hint';

/** A link that opens in a new tab and says so. `.link-label` keeps the underline off the icon. */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      <span className="link-label">{children}</span>
      <NewTabHint />
    </a>
  );
}
