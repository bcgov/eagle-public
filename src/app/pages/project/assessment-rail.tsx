import { useId, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { offRailPhase, actYear, type RailStage } from './assessment-stages';
import { actFor } from 'app/utils/legislation';
import type { ProjectNavState } from './project-context';
import './assessment-rail.css';

interface AssessmentRailProps {
  project: Project | null;
  /** The Act's stages, from `useRailStages`, so the caller's text and the rail read one value. */
  stages: RailStage[];
  /** The project fetch is still in flight, so no stage is known yet. */
  loading?: boolean;
  /** Drop the title row; the project summary's head row carries the links. */
  headless?: boolean;
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

/** A rail stage with an optional line under its name, such as "Current stage". */
export type RailStep = RailStage & { aside?: string };

export function SimpleRail({ stages }: { stages: RailStep[] }) {
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
          {stage.state === 'done' && <span className="visually-hidden">Completed</span>}
          {stage.dates && <span className="assessment-rail__phase-dates">{stage.dates}</span>}
          {stage.aside && (
            // On the current stage `aria-current` already says so.
            <span
              className="assessment-rail__phase-aside"
              aria-hidden={stage.state === 'current' || undefined}
            >
              {stage.aside}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

interface RailFrameProps {
  title: string;
  /** Read only with the title row. */
  project?: Project | null;
  /** No title row: `title` only names the section, and the page shows the links elsewhere. */
  headless?: boolean;
  children: ReactNode;
}

/** The project's Act and a link to its full timeline. */
export function TimelineLinks({ project }: { project: Project }) {
  return (
    <div className="assessment-rail__head-right">
      {actYear(project) > 0 && <p className="assessment-rail__act">{project.legislation}</p>}
      <Link
        className="assessment-rail__timeline"
        to={`/p/${project._id}/timeline`}
        state={{ scrollToTabs: true } satisfies ProjectNavState}
      >
        View timeline
        <i className="material-icons assessment-rail__timeline-icon" aria-hidden="true">
          arrow_forward
        </i>
      </Link>
    </div>
  );
}

/** A rail's section: its own heading, the project's Act and a link to the full timeline. */
export function RailFrame({ title, project, headless = false, children }: RailFrameProps) {
  const headingId = useId();
  if (headless) {
    return (
      <section className="assessment-rail" aria-label={title}>
        {children}
      </section>
    );
  }
  return (
    <section className="assessment-rail" aria-labelledby={headingId}>
      <div className="assessment-rail__head">
        <h2 id={headingId} className="assessment-rail__title">
          {title}
        </h2>
        {project && <TimelineLinks project={project} />}
      </div>
      {children}
    </section>
  );
}

/** The project's place in the environmental assessment process, with a link to its full timeline. */
export function AssessmentRail({
  project,
  stages,
  loading = false,
  headless = false,
}: AssessmentRailProps) {
  const act = actFor(project?.legislation);
  if (act?.stages === 'none') return null;

  const offRail = offRailPhase(project);

  return (
    <RailFrame title="Assessment progress" project={project} headless={headless}>
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

      {!loading && <SimpleRail stages={stages} />}

      {offRail && (
        <p className="assessment-rail__caption">
          This project&rsquo;s current phase is {offRail}, which sits outside the stages shown here.
        </p>
      )}
    </RailFrame>
  );
}
