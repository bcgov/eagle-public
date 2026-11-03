import { useId, type CSSProperties } from 'react';
import { stagesAfterCertificateFor, type TimelineAct } from './use-timeline-model';

export const STAGE_NOT_RECORDED_NOTE = 'Current stage: Not recorded';
export const STAGES_UNDATED_NOTE = 'Only the current stage is recorded. Stages are not dated.';

/**
 * The stages after the certificate. Only the current one is recorded and none is dated, so no
 * bar stands for a length of time; an unknown or missing stage marks none.
 */
export function StagesAfterCertificate({ current }: { current: string | null }) {
  const headingId = useId();
  const stages = stagesAfterCertificateFor(current);
  const at = current ? stages.indexOf(current) : -1;
  return (
    <section className="timeline-after" aria-labelledby={headingId}>
      <div className="timeline-after__header">
        <h3 id={headingId} className="timeline-after__title">
          Stage after the certificate
        </h3>
        {at < 0 ? (
          <p className="timeline-after__note timeline-after__note--missing">
            {STAGE_NOT_RECORDED_NOTE}
          </p>
        ) : (
          <p className="timeline-after__note">{STAGES_UNDATED_NOTE}</p>
        )}
      </div>
      <ol className="timeline-after__stages">
        {stages.map((stage, index) => {
          const classes = [
            'timeline-after__stage',
            index <= at && 'timeline-after__stage--reached',
            index === at && 'timeline-after__stage--current',
          ];
          return (
            <li
              key={stage}
              className={classes.filter(Boolean).join(' ')}
              aria-current={index === at ? 'step' : undefined}
            >
              <span className="timeline-after__bar" aria-hidden="true" />
              <span className="timeline-after__name">{stage}</span>
              {index < at && <span className="visually-hidden">Completed</span>}
              {index === at && (
                // `aria-current` already says so.
                <span className="timeline-after__aside" aria-hidden="true">
                  Current stage
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

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
