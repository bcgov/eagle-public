import type { DemiProject } from 'app/api/api';
import { activeWorkOf, ASSESSMENT_WORK_TYPE, worksOf, type Work } from 'app/api/project-phases';
import { at, decisionOf, postDecisionStageOf, stageAfterCertificateOf } from './use-timeline-model';

/** Where a project sits against EAO regulation: comms' Types 01 to 04, in that order. */
type Standing = 'eaWork' | 'exited' | 'decided' | 'postDecisionWork';

export interface StandingDecision {
  name: string;
  date: string | null;
  source: 'eagle' | 'track';
}

export interface ProjectStanding {
  standing: Standing;
  /** The active Track work that placed the project, `null` when no work did. */
  work: Work | null;
  /** The stage after the certificate, from the Eagle phase or else Track's project state; `decided`
   * and `postDecisionWork` only. */
  stage: string | null;
  decision: StandingDecision | null;
}

// Track work type ids; the text varies (type 10 reads "Substantial Start Determination" live).
const EA_WORK_TYPES = [1, 2, 3, 5, 6];
const POST_DECISION_WORK_TYPES = [7, 9, 10, 11, 15, 16];

// "In Progress", "Further Assessment Required" and "Exemption Order Rescinded" stay out: no decision.
const DECISIONS: Record<string, 'exit' | 'decided'> = {
  Withdrawn: 'exit',
  'Application Withdrawn': 'exit',
  Terminated: 'exit',
  'Assessment Terminated': 'exit',
  'Administrative Closure': 'exit',
  'Regulatory Transfer': 'exit',
  'Certificate Expired': 'exit',
  'Certificate Refused': 'exit',
  'Certificate Cancelled': 'exit',
  'Not Designated Reviewable': 'exit',
  'Project Designated Non-Reviewable': 'exit',
  'Certificate Not Required': 'exit',
  'Certificate End of Life': 'exit',
  'Certificate Issued': 'decided',
  'Pre-EA Act Approval': 'decided',
  'Exemption Order': 'decided',
  'Certificate Reinstated': 'decided',
};

const POST_DECISION_WORK_PHASES = [
  'Amendment',
  'Substantial Start',
  'Extension',
  'Suspension',
  'Transfer of Certificate/Order',
];

/** A populated list reference's name; a bare id has no name to read. */
function refName(ref: unknown): string | null {
  const name = (ref as { name?: unknown } | null | undefined)?.name;
  return typeof name === 'string' && name.trim() ? name : null;
}

/** A decision date that reads as a real day; Eagle stores a blank one as the epoch. */
function decisionDateOf(date: string | null | undefined): string | null {
  return date && at(date) !== null ? date : null;
}

const decidedAt = (work: Work) => at(work.decisionDate) ?? -Infinity;

/** The decision of the latest finished assessment, for when Eagle's record lags Track. */
function trackDecisionOf(works: Work[]): { decision: StandingDecision; refused: boolean } | null {
  const work = works
    .filter(
      (one) =>
        one.workTypeId === ASSESSMENT_WORK_TYPE &&
        one.workState === 'COMPLETED' &&
        one.outcome !== null,
    )
    .reduce<Work | null>(
      (latest, one) => (!latest || decidedAt(one) > decidedAt(latest) ? one : latest),
      null,
    );
  const outcome = work && decisionOf(work.outcome);
  if (!work || !outcome) return null;
  const refused = outcome === 'refused';
  return {
    refused,
    decision: {
      name: refused ? 'Certificate Refused' : 'Certificate Issued',
      date: decisionDateOf(work.decisionDate),
      source: 'track',
    },
  };
}

/** First match wins: active Track work, exit decision, Closed with no decision, Eagle-only work
 * phase, any decision evidence; else (a missing document too) still in EA work. */
export function projectStandingOf(doc: DemiProject | null | undefined): ProjectStanding {
  const works = worksOf(doc);
  const active = activeWorkOf(doc);
  const eagleDecision = refName(doc?.eacDecision);
  const eagleKind = eagleDecision ? DECISIONS[eagleDecision] : undefined;
  // Eagle's own decision always wins; Track fills in only while Eagle has none.
  const track = eagleKind ? null : trackDecisionOf(works);
  const projectState = doc?.projectState ?? '';
  const phase = refName(doc?.currentPhaseName);
  const phaseStage = postDecisionStageOf(phase);
  const stage = stageAfterCertificateOf(phase, projectState);
  const decision: StandingDecision | null =
    eagleDecision && eagleKind
      ? { name: eagleDecision, date: decisionDateOf(doc?.decisionDate), source: 'eagle' }
      : (track?.decision ?? null);
  const as = (standing: Standing, work: Work | null = null) => ({
    standing,
    work,
    stage: standing === 'decided' || standing === 'postDecisionWork' ? stage : null,
    decision,
  });

  if (active && EA_WORK_TYPES.includes(active.workTypeId)) return as('eaWork', active);
  if (active && POST_DECISION_WORK_TYPES.includes(active.workTypeId)) {
    return as('postDecisionWork', active);
  }
  if (eagleKind === 'exit' || track?.refused) return as('exited');
  const decidedOnRecord = eagleKind === 'decided' || track !== null;
  if (projectState === 'Closed' && !decidedOnRecord) return as('exited');
  if (!works.length && phaseStage && POST_DECISION_WORK_PHASES.includes(phaseStage)) {
    return as('postDecisionWork');
  }
  if (stage || decidedOnRecord) return as('decided');
  return as('eaWork');
}
