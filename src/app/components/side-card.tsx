import type { ReactNode } from 'react';
import './record-layout.css';

/** A card in a record page's aside: a header with the title and an optional link, then rows. */
export function SideCard({
  title,
  titleId,
  action,
  children,
}: {
  title: string;
  titleId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="side-card" aria-labelledby={titleId}>
      <div className="side-card__header">
        <h2 id={titleId}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
