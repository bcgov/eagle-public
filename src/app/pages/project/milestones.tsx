import { useId } from 'react';
import { dayDate } from './timeline-list';
import type { TimelineMilestone } from './use-timeline-model';

const DECISIONS = { approved: 'Approved', refused: 'Refused' } as const;

function nameOf(milestone: TimelineMilestone): string {
  return milestone.decision && !milestone.planned
    ? `${milestone.name}: ${DECISIONS[milestone.decision]}`
    : milestone.name;
}

/** A work's milestones as a checklist: done, stopped, or planned with a hollow dot. */
export function Milestones({ milestones }: { milestones: TimelineMilestone[] }) {
  const headingId = useId();
  return (
    <section className="timeline-details__section" aria-labelledby={headingId}>
      <h4 id={headingId} className="timeline-details__label">
        Milestones · {milestones.length}
      </h4>
      <ol className="milestones">
        {milestones.map((milestone, index) => {
          const state = milestone.planned ? 'planned' : milestone.stop ? 'stop' : 'done';
          return (
            <li
              key={`${milestone.name}-${index}`}
              className={`milestones__item milestones__item--${state}`}
            >
              <span className="milestones__mark" aria-hidden="true">
                <span className="milestones__dot">
                  {state !== 'planned' && (
                    <i className="material-icons">{state === 'stop' ? 'close' : 'check'}</i>
                  )}
                </span>
              </span>
              <span className="milestones__text">
                <span className="milestones__name">{nameOf(milestone)}</span>
                <span className="milestones__date">
                  {dayDate(milestone.date)}
                  {milestone.planned && (
                    <>
                      <span className="visually-hidden">, </span>
                      <span className="milestones__planned">Planned</span>
                    </>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
