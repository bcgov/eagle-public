import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { demiProjectQueryOptions, type DemiProject } from 'app/api/api';
import { nextEngagement, type ProjectEngagement } from 'app/api/commentperiod';
import {
  ASSESSMENT_WORK_TYPE,
  firstAssessedOn,
  openPhaseOf,
  subTypeOf,
  typeIdOf,
  type Phase,
  type Work,
} from 'app/api/project-phases';
import { useBcToday } from 'app/components/use-bc-today';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import type { Project } from 'app/models/project';
import { dayOf } from 'app/utils/utils';
import { actYear, POST_DECISION_ROW } from './assessment-stages';
import { phaseDescriptionFor } from './phase-descriptions';
import { projectStandingOf, type ProjectStanding } from './project-standing';
import { at, postDecisionStageOf } from './use-timeline-model';

interface HeadWork {
  work: Work;
  phase: Phase | null;
}

/** What the summary under the masthead shows; `null` for anything the project has no value for. */
interface ProjectSummaryData {
  /** The first DEMI read has not settled yet. */
  pending: boolean;
  /** `null` until the DEMI document is in. */
  standing: ProjectStanding | null;
  /** The active Track work that placed the project, with its open phase. */
  head: HeadWork | null;
  /** "<work type> • <open phase>"; with no open phase the work type (post-decision work) or the
   * Eagle phase. */
  workHeading: string | null;
  category: string | null;
  /** ISO date the project's first assessment phase started. */
  enteredOn: string | null;
  legislation: string | null;
  phaseStart: string | null;
  /** Through its last day in BC. */
  phaseEnd: string | null;
  engagement: ProjectEngagement | null;
  periodsPending: boolean;
  /** EPIC.engage's text for the phase, 2018 Act projects only. */
  phaseDescription: string | null;
  /** Only while the certificate has not expired. */
  certificateExpires: string | null;
}

/** ENGAGE describes only the 2018 Act's assessment phases and what follows the certificate. */
function phaseDescriptionOf(
  standing: ProjectStanding | null,
  phaseName: string | null,
  project: Project | null,
): string | null {
  if (!standing || actYear(project) !== 2018) return null;
  if (standing.standing === 'decided' || standing.standing === 'postDecisionWork') {
    return phaseDescriptionFor(POST_DECISION_ROW);
  }
  const assessing = !standing.work || typeIdOf(standing.work) === ASSESSMENT_WORK_TYPE;
  return standing.standing === 'eaWork' && assessing && phaseName
    ? phaseDescriptionFor(phaseName)
    : null;
}

// Module-level so the selected value is memoised against the cached document, as `selectPins`.
// Clock-free: the hook compares the phase end and certificate expiry to today.
const selectSummary = (doc: DemiProject | null) => {
  const standing = projectStandingOf(doc);
  const work = standing.work;
  const expires = doc?.eacExpires;
  return {
    standing,
    head: work ? { work, phase: openPhaseOf(work) } : null,
    enteredOn: firstAssessedOn(doc),
    subType: subTypeOf(doc),
    eacExpires: expires && at(expires) !== null ? expires : null,
  };
};

/** The summary facts, off the cached DEMI project document (no request of its own) and the
 * project's comment periods. */
export function useProjectSummary(projId: string, project: Project | null): ProjectSummaryData {
  const {
    data: doc,
    isPending,
    isFetched,
  } = useQuery({
    ...demiProjectQueryOptions(projId),
    select: selectSummary,
  });
  const { data: periods, isPending: periodsPending } = useCommentPeriods(projId);
  const engagement = useMemo(() => (periods ? nextEngagement(periods) : null), [periods]);
  const today = useBcToday();

  const standing = doc?.standing ?? null;
  const head = doc?.head ?? null;
  const phase = head?.phase ?? null;
  const phaseStart = phase?.startDate ?? null;
  const end = phase?.endDate;
  const expires = doc?.eacExpires;
  const parts = [project?.type, doc?.subType ?? project?.sector].filter(
    (part): part is string => !!part?.trim(),
  );
  const eaglePhase = project?.currentPhaseName?.name || null;
  const phaseName = phase?.name ?? eaglePhase;
  const workHeading =
    head && phase
      ? `${head.work.workType} • ${phase.name}`
      : standing?.standing === 'postDecisionWork'
        ? (head?.work.workType ?? postDecisionStageOf(eaglePhase) ?? eaglePhase)
        : eaglePhase;

  return {
    pending: isPending && !isFetched,
    standing,
    head,
    workHeading,
    category: [...new Set(parts)].join(' · ') || null,
    enteredOn: doc?.enteredOn ?? null,
    legislation: project?.legislation?.trim() || null,
    phaseStart,
    // Track leaves unfinished phases' planned ends in the past or before the start.
    phaseEnd: end && dayOf(end) >= today && dayOf(end) >= dayOf(phaseStart) ? end : null,
    engagement,
    periodsPending,
    phaseDescription: phaseDescriptionOf(standing, phaseName, project),
    certificateExpires: expires && dayOf(expires) >= today ? expires : null,
  };
}
