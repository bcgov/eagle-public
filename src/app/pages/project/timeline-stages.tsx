import { useId, type CSSProperties } from 'react';
import type { TimelineAct } from './use-timeline-model';

/** An Act's phases with their steps; phases the project skipped are greyed and say so. */
export function TimelineStages({ label, rows }: { label: string; rows: TimelineAct['rows'] }) {
  const headingId = useId();
  return (
    <section className="timeline-details__section" aria-labelledby={headingId}>
      <h4 id={headingId} className="timeline-details__label">
        {label}
      </h4>
      <ol className="timeline-stages">
        {rows.map(({ row, onProject }, index) => (
          <li
            key={`${row.name}-${index}`}
            className={`timeline-stages__row${onProject ? '' : ' timeline-stages__row--skipped'}`}
          >
            <span
              className="timeline-stages__swatch"
              aria-hidden="true"
              style={{ '--stage-fill': `var(${row.token}, ${row.hex})` } as CSSProperties}
            />
            <span>
              <span className="timeline-stages__name">
                {row.name}
                {!onProject && ' (not on this project)'}
              </span>
              <span className="timeline-stages__steps">{row.steps.join(' · ')}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
