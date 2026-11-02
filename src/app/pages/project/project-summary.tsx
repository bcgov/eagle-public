import { Skeleton } from 'app/components/skeleton/skeleton';
import type { Project } from 'app/models/project';
import { AssessmentRail } from './assessment-rail';
import type { PhaseListItem } from './assessment-stages';
import { SummaryDecided } from './summary-decided';
import { SummaryEaWork } from './summary-ea-work';
import { SummaryExited } from './summary-exited';
import { SkeletonBox, SummaryHead } from './summary-parts';
import { PHASE_FACT_LABELS, PROJECT_FACT_LABELS } from './summary-facts';
import { SummaryPostDecisionWork } from './summary-post-decision-work';
import { useProjectSummary } from './use-project-summary';
import './project-summary.css';

interface ProjectSummaryProps {
  project: Project | null;
  projId: string;
  /** Every List row; the rail picks the projectPhase ones out. */
  lists: PhaseListItem[];
  /** The shell's project fetch is still in flight. */
  loading?: boolean;
  /** The List rows are still in flight; only the rail waits on them. */
  listsLoading?: boolean;
}

const PIECES = {
  eaWork: SummaryEaWork,
  exited: SummaryExited,
  decided: SummaryDecided,
  postDecisionWork: SummaryPostDecisionWork,
};

/** A standard project's summary under the masthead, drawn by the project's standing (Types 01-04). */
export function ProjectSummary({
  project,
  projId,
  lists,
  loading = false,
  listsLoading = false,
}: ProjectSummaryProps) {
  const summary = useProjectSummary(projId, project);
  // The standing picks the layout, so the DEMI document is waited on too. A failed read falls
  // back to Type 01 on Eagle's record.
  const pending = loading || summary.pending;
  const kind = summary.standing?.standing ?? 'eaWork';
  const Piece = PIECES[kind];

  return (
    <section
      className="project-summary"
      aria-label="Project status"
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <span className="visually-hidden">Loading project status</span>
          <SummaryHead heading={null} project={project}>
            <Skeleton width="40%" className="project-summary__head-skeleton" />
          </SummaryHead>
          <AssessmentRail project={project} stages={[]} loading headless />
          <div className="project-summary__grid">
            <SkeletonBox labels={PROJECT_FACT_LABELS} />
            <SkeletonBox labels={PHASE_FACT_LABELS} />
          </div>
        </>
      ) : (
        <Piece
          summary={summary}
          project={project}
          projId={projId}
          lists={lists}
          listsLoading={listsLoading}
        />
      )}
    </section>
  );
}
