import { DecisionLine, SummaryAssessmentRail, SummaryGrid, SummaryHead } from './summary-parts';
import {
  certificateExpiresFact,
  engagementFact,
  phaseDateFacts,
  projectFacts,
  type SummaryPieceProps,
} from './summary-facts';
import { WorkRail } from './work-rail';

/** Type 04, in work after its decision: the work and phase, its rail, then the facts. */
export function SummaryPostDecisionWork({
  summary,
  project,
  projId,
  lists,
  listsLoading,
}: SummaryPieceProps) {
  const decision = summary.standing?.decision;
  const stage = summary.standing?.stage;
  const work = summary.head?.work;

  return (
    <>
      <SummaryHead heading={summary.workHeading} project={project}>
        {decision && <DecisionLine decision={decision} projId={projId} />}
      </SummaryHead>

      {work?.phases.length ? (
        <WorkRail work={work} kind="postDecisionWork" />
      ) : (
        // Eagle-only work: no Track phases, so the Act's stages stand in.
        <SummaryAssessmentRail
          project={project}
          projId={projId}
          lists={lists}
          listsLoading={listsLoading}
        />
      )}

      <SummaryGrid
        facts={projectFacts(summary)}
        status={[
          // Eagle-only work carries no phase dates.
          ...(work ? phaseDateFacts(summary) : []),
          ...(stage ? [{ label: 'Project Stage', value: stage }] : []),
          ...(summary.certificateExpires
            ? [certificateExpiresFact(summary.certificateExpires)]
            : []),
          ...engagementFact(summary.engagement),
        ]}
        statusPending={summary.periodsPending}
        description={summary.phaseDescription}
      />
    </>
  );
}
