import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { demiProjectQueryOptions, type DemiProject } from 'app/api/api';
import { nextEngagement, type ProjectEngagement } from 'app/api/commentperiod';
import {
  currentWorkPhaseOf,
  firstAssessedOn,
  openPhaseOf,
  subTypeOf,
  type Phase,
  type Work,
} from 'app/api/project-phases';
import { useBcToday } from 'app/components/use-bc-today';
import { useCommentPeriods } from 'app/components/use-comment-periods';
import type { Project } from 'app/models/project';
import { projectStandingOf, type ProjectStanding } from './project-standing';

/** What the summary under the masthead shows; `null` for anything the project has no value for. */
interface ProjectSummaryData {
  /** `null` until the DEMI document is in. */
  standing: ProjectStanding | null;
  /** Per standing: work and phase, the exit decision, the stage after the certificate. */
  heading: string | null;
  category: string | null;
  /** ISO date the project's first assessment phase started. */
  enteredOn: string | null;
  legislation: string | null;
  phaseStart: string | null;
  /** Through its last day in BC. */
  phaseEnd: string | null;
  engagement: ProjectEngagement | null;
  periodsPending: boolean;
}

/** The work the summary heads with: an active assessment (Type 01) or post-decision work (04). */
function headWorkOf(
  doc: DemiProject | null,
  standing: ProjectStanding,
): { work: Work; phase: Phase | null } | null {
  if (standing.standing === 'eaWork') return currentWorkPhaseOf(doc);
  if (standing.standing === 'postDecisionWork' && standing.work) {
    return { work: standing.work, phase: openPhaseOf(standing.work) };
  }
  return null;
}

// Module-level so the selected value is memoised against the cached document, as `selectPins`.
// Clock-free: the hook compares the phase end to today.
const selectSummary = (doc: DemiProject | null) => {
  const standing = projectStandingOf(doc);
  return {
    standing,
    head: headWorkOf(doc, standing),
    enteredOn: firstAssessedOn(doc),
    subType: subTypeOf(doc),
  };
};

/** The summary facts, off the cached DEMI project document (no request of its own) and the
 * project's comment periods. */
export function useProjectSummary(projId: string, project: Project | null): ProjectSummaryData {
  const { data: doc } = useQuery({ ...demiProjectQueryOptions(projId), select: selectSummary });
  const { data: periods, isPending: periodsPending } = useCommentPeriods(projId);
  const engagement = useMemo(() => (periods ? nextEngagement(periods) : null), [periods]);
  const today = useBcToday();

  const standing = doc?.standing ?? null;
  const head = doc?.head ?? null;
  const phase = head?.phase ?? null;
  const end = phase?.endDate;
  const parts = [project?.type, doc?.subType ?? project?.sector].filter(
    (part): part is string => !!part?.trim(),
  );
  const workHeading = head
    ? [head.work.workType, phase?.name].filter(Boolean).join(' • ')
    : project?.currentPhaseName?.name || null;
  const heading =
    standing?.standing === 'exited'
      ? (standing.decision?.name ?? 'Closed')
      : standing?.standing === 'decided'
        ? standing.stage
        : workHeading;

  return {
    standing,
    heading,
    category: [...new Set(parts)].join(' · ') || null,
    enteredOn: doc?.enteredOn ?? null,
    legislation: project?.legislation?.trim() || null,
    phaseStart: phase?.startDate ?? null,
    phaseEnd: end && end.slice(0, 10) >= today ? end : null,
    engagement,
    periodsPending,
  };
}
