import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import {
  offRailPhase,
  actYear,
  simplifiedStages,
  withPhaseDates,
  type PhaseListItem,
  type RailStage,
} from './assessment-stages';
import { actFor } from 'app/utils/legislation';
import type { Phase } from 'app/api/project-phases';
import './assessment-rail.css';

interface AssessmentRailProps {
  project: Project | null;
  lists: PhaseListItem[];
  /** Track work phases from DEMI; null until they arrive, and whenever the feed is off. */
  phases?: Phase[] | null;
  /** The project fetch is still in flight, so no stage is known yet. */
  loading?: boolean;
}

/** The simplified rail always draws seven stages, so the stand-in draws seven too. */
const SKELETON_PHASES = [1, 2, 3, 4, 5, 6, 7];

/** CSS custom properties are not in React's `CSSProperties`, so they need the cast. */
function vars(properties: Record<string, string | number>): CSSProperties {
  return properties as CSSProperties;
}

function fill(stage: RailStage): string {
  return `var(${stage.token}, ${stage.hex})`;
}

function SimpleRail({ stages }: { stages: RailStage[] }) {
  return (
    <ol className="assessment-rail__simple">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className={`assessment-rail__phase assessment-rail__phase--${stage.state}`}
          style={vars({ '--stage': fill(stage) })}
          aria-current={stage.state === 'current' ? 'step' : undefined}
          title={stage.name}
        >
          <span className="assessment-rail__phase-bar" aria-hidden="true" />
          <span className="assessment-rail__phase-name">{stage.name}</span>
          {stage.dates && <span className="assessment-rail__phase-dates">{stage.dates}</span>}
        </li>
      ))}
    </ol>
  );
}
/** The project's place in the environmental assessment process, with a link to its full timeline. */
export function AssessmentRail({
  project,
  lists,
  phases = null,
  loading = false,
}: AssessmentRailProps) {
  const simple = useMemo(
    () => withPhaseDates(simplifiedStages(lists, project), phases),
    [lists, project, phases],
  );

  const act = actFor(project?.legislation);
  if (act?.stages === 'none') return null;

  const year = actYear(project);
  const offRail = offRailPhase(project);

  return (
    <section className="assessment-rail" aria-labelledby="assessment-rail-heading">
      <div className="assessment-rail__head">
        <h2 id="assessment-rail-heading" className="assessment-rail__title">
          Assessment progress
        </h2>
        {project && (
          <div className="assessment-rail__head-right">
            {year > 0 && <p className="assessment-rail__act">{project.legislation}</p>}
            <Link className="assessment-rail__timeline" to={`/p/${project._id}/timeline`}>
              View timeline
              <i className="material-icons assessment-rail__timeline-icon" aria-hidden="true">
                arrow_forward
              </i>
            </Link>
          </div>
        )}
      </div>

      {loading && (
        <>
          <span className="visually-hidden">Loading assessment progress</span>
          <ol className="assessment-rail__simple">
            {SKELETON_PHASES.map((phase) => (
              <li className="assessment-rail__phase" key={phase}>
                <Skeleton height="6px" />
                <Skeleton width="80%" />
              </li>
            ))}
          </ol>
        </>
      )}

      {!loading && <SimpleRail stages={simple} />}

      {offRail && (
        <p className="assessment-rail__caption">
          This project&rsquo;s current phase is {offRail}, which sits outside the stages shown here.
        </p>
      )}
    </section>
  );
}
