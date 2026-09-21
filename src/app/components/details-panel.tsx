import type { ReactNode } from 'react';
import './details-panel.css';

/**
 * The card a record's details sit in: heading, a line or two about the record, then a
 * `dl.details-panel__facts` of `Fact`s.
 */
export function DetailsPanel({
  title,
  titleId,
  children,
}: {
  title: ReactNode;
  /** Id for the h2 that names the section. */
  titleId: string;
  children: ReactNode;
}) {
  return (
    <section className="details-panel" aria-labelledby={titleId}>
      <h2 id={titleId} className="details-panel__title">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One label and value. An empty value reads "-", so a missing field still holds its cell. */
export function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="details-panel__fact">
      <dt>{label}</dt>
      <dd>{children || '-'}</dd>
    </div>
  );
}
