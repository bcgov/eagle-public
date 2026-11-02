import { LifecycleRail } from './lifecycle-rail';
import { DecisionLine, SummaryGrid, SummaryHead } from './summary-parts';
import {
  certificateExpiresFact,
  engagementFact,
  projectFacts,
  type SummaryPieceProps,
} from './summary-facts';

/** Type 03, past its decision with no work open: the stage it is in, then the facts. */
export function SummaryDecided({ summary, project, projId }: SummaryPieceProps) {
  const decision = summary.standing?.decision;
  const stage = summary.standing?.stage ?? null;

  return (
    <>
      <SummaryHead heading={stage ?? 'Decision made'} project={project}>
        {decision && <DecisionLine decision={decision} projId={projId} />}
      </SummaryHead>

      <LifecycleRail stage={stage} />

      <SummaryGrid
        facts={projectFacts(summary)}
        status={[
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
