import type { ReactNode } from 'react';
import './status-pill.css';

export type StatusTone = 'neutral' | 'success' | 'danger' | 'info' | 'warning';

/** A read-only status label, coloured by meaning. */
export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
