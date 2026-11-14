import type { ReactNode } from 'react';
import {
  ASSESSMENT_WORK_TYPE,
  typeIdOf,
  useProjectEaCertificate,
  useProjectPhases,
} from 'app/api/project-phases';
import { useBcToday } from 'app/components/use-bc-today';
import { dayOf, longDateUtc } from 'app/utils/utils';
import { AssessmentRail } from './assessment-rail';
import { dateLabel, POST_DECISION_STAGE, useRailStages } from './assessment-stages';
import { eaDecisionDetail } from './ea-decision-detail';
import { SummaryGrid, SummaryHead, SummaryLine } from './summary-parts';
import {
  engagementFact,
  phaseDateFacts,
  projectFacts,
  type SummaryPieceProps,
} from './summary-facts';
import { UNDECIDED } from './use-project-tab-meta';
import { at } from './use-timeline-model';
import { WorkRail } from './work-rail';

/** Where the work stands: the next stage and the expected decision, else when this phase began. */
function standingLine(
  next: string | null,
  decidesOn: string | null,
  phaseStart: string | null,
  today: string,
): ReactNode {
  const month = dateLabel(null, at(decidesOn));
  if (next) {
    return (
      <>
        <strong>Next</strong>: {next}
        {month ? `, with a decision expected in ${month}.` : '.'}
      </>
    );
  }
  if (month) return `Decision expected in ${month}.`;
  const since = phaseStart && dayOf(phaseStart) <= today ? longDateUtc(phaseStart) : '';
  return since ? `In this phase since ${since}.` : null;
}

/** Type 01, in EA work: the work and phase, its rail, the facts and ENGAGE's phase text. */
export function SummaryEaWork({
  summary,
  project,
  projId,
  lists,
  listsLoading,
}: SummaryPieceProps) {
  const phases = useProjectPhases(projId);
  const eaCertificate = useProjectEaCertificate(projId);
  const work = summary.head?.work;
  const decision = project?.eacDecision?.name;
  const today = useBcToday();
  const open = summary.head?.phase ?? null;
  const stages = useRailStages(project, lists, phases, { trackPhase: open });
  const onWorkRail = !!work && typeIdOf(work) !== ASSESSMENT_WORK_TYPE;

  // The next stage on whichever rail is drawn, so the sentence and the rail agree.
  const names = onWorkRail ? work.phases.map((phase) => phase.name) : stages.map((s) => s.name);
  const current = onWorkRail
    ? work.phases.findIndex((phase) => phase === open)
    : stages.findIndex((stage) => stage.state === 'current');
  const after = current >= 0 ? (names[current + 1] ?? null) : null;
  // Past the decision is not a next step of the assessment.
  const next = after === POST_DECISION_STAGE ? null : after;
  // Track's anticipated decision, else the planned end of the work's last phase; today or later.
  const decidesOn =
    [work?.anticipatedDecisionDate, work?.phases.at(-1)?.endDate].find(
      (date): date is string => !!date && dayOf(date) >= today,
    ) ?? null;
  const line =
    listsLoading && !onWorkRail ? null : standingLine(next, decidesOn, summary.phaseStart, today);

  return (
    <>
      <SummaryHead heading={summary.workHeading ?? 'Stage not recorded'} project={project}>
        {line && <SummaryLine>{line}</SummaryLine>}
      </SummaryHead>

      {onWorkRail ? (
        <WorkRail work={work} kind="eaWork" />
      ) : (
        <AssessmentRail project={project} stages={stages} loading={listsLoading} headless />
      )}

      <SummaryGrid
        facts={projectFacts(summary)}
        status={[
          ...phaseDateFacts(summary),
          ...engagementFact(summary.engagement),
          ...(decision && decision !== UNDECIDED
            ? [
                {
                  label: 'EA decision',
                  value: decision,
                  detail: eaDecisionDetail(project?.decisionDate, eaCertificate, projId),
                },
              ]
            : []),
        ]}
        statusPending={summary.periodsPending}
        description={summary.phaseDescription}
      />
    </>
  );
}
