import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listsQueryOptions, type DemiProject, type ListRef } from 'app/api/api';
import { documentFilters, reachableTotal, readDocuments } from 'app/api/document';
import {
  phasesOf,
  useDemiProject,
  worksOf,
  type Milestone,
  type Phase,
  type Work,
} from 'app/api/project-phases';
import { idsForTerms, type ListTerm } from 'app/utils/document-tabs';
import { actByYear, actFor } from 'app/utils/legislation';
import {
  POST_DECISION_ROW,
  isOffRail,
  stageRowFor,
  stageSetFor,
  type StageRow,
} from './assessment-stages';

export type LaneId = 'assessment' | 'amendments' | 'other';
export type WorkStatus =
  'completed' | 'closed' | 'withdrawn' | 'terminated' | 'inProgress' | 'suspended';
export type Decision = 'approved' | 'refused';
export type CertificateOutcome = 'issued' | 'refused' | 'terminated';
export type SubstantialStartOutcome =
  'Substantially started' | 'Not substantially started' | 'Not yet decided';

export interface WhoseTime {
  eaoDays: number;
  proponentDays: number;
}

/** A dated or planned milestone of a Track work, as the details checklist lists it. */
export interface TimelineMilestone {
  name: string;
  date: string;
  planned: boolean;
  /** The Track outcome name on a decision milestone. */
  outcome: string | null;
  decision: Decision | null;
  /** Drawn as a stop (red ×): a refusal, or a work that ended without a decision. */
  stop: boolean;
}

interface ItemBase {
  id: string;
  title: string;
  /** Null for rows that sit on no work lane: the Act band, Today. */
  lane: LaneId | null;
  /** The year of the `legislation_<year>` block the item was read from. */
  actYear: number | null;
  start: string | null;
  end: string | null;
  /** On the second assessment's line. */
  branch: boolean;
  /** A history or same-day group this row folds under. */
  parentId?: string;
}

export interface BandItem extends ItemBase {
  kind: 'band';
  actYear: number;
  /** "2002 Act". */
  actName: string;
  phasesUsed: number;
}

export interface PhaseItem extends ItemBase {
  kind: 'phase';
  /** The registry row; null for a stored name no row matches, drawn under its own name. */
  row: StageRow | null;
  status: 'done' | 'current' | 'planned' | 'undated';
  /** For an undated phase, the nearest known dates around it. */
  knownRange: DateRange | null;
  whoseTime: WhoseTime | null;
}

export interface ProponentItem extends ItemBase {
  kind: 'proponent';
  days: number;
  /** The phase the proponent's time leads into. */
  beforePhase: string | null;
  status: 'done' | 'current' | 'planned';
  whoseTime: WhoseTime | null;
}

export interface HistoryItem extends ItemBase {
  kind: 'history';
  childIds: string[];
  datedMilestones: number;
  knownRange: DateRange | null;
}

export interface MilestoneItem extends ItemBase {
  kind: 'milestone';
}

export interface TransitionItem extends ItemBase {
  kind: 'transition';
  transition: TimelineTransition;
}

export interface DocumentItem extends ItemBase {
  kind: 'document';
  documentId: string;
  displayName: string;
  /** Pre-Track documents carry no decision. */
  outcome: null;
}

export interface CertificateItem extends ItemBase {
  kind: 'certificate';
  outcome: CertificateOutcome;
  source: 'track' | 'eagle';
  certificateNumber: string | null;
  whoseTime: WhoseTime | null;
}

export interface BranchStartItem extends ItemBase {
  kind: 'branchStart';
}

export interface WorkItem extends ItemBase {
  kind: 'work';
  trackWorkId: number;
  workTypeId: number;
  /** Track's type name, or the designed name for the five templated types. */
  workType: string;
  status: WorkStatus;
  open: boolean;
  milestones: TimelineMilestone[];
  plannedDecision: string | null;
  decision: Decision | null;
  endedWithoutDecision: boolean;
}

export interface SubstantialStartItem extends ItemBase {
  kind: 'substantialStart';
  deadline: string | null;
  decided: string | null;
  outcome: SubstantialStartOutcome;
}

export interface GroupItem extends ItemBase {
  kind: 'group';
  childIds: string[];
  defaultOpen: boolean;
}

export interface TodayItem extends ItemBase {
  kind: 'today';
  /** A post-certificate stage, or null for "Not recorded". */
  currentStage: string | null;
  openWorks: number;
}

export type TimelineItem =
  | BandItem
  | PhaseItem
  | ProponentItem
  | HistoryItem
  | MilestoneItem
  | TransitionItem
  | DocumentItem
  | CertificateItem
  | BranchStartItem
  | WorkItem
  | SubstantialStartItem
  | GroupItem
  | TodayItem;

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface TimelineAct {
  year: number;
  /** "2002 Act". */
  name: string;
  label: string;
  inForce: string | null;
  current: boolean;
  /** The Act's phases in order, each marked with whether this project went through it. */
  rows: { row: StageRow; onProject: boolean }[];
}

export interface TimelineTransition {
  fromYear: number;
  toYear: number;
  date: string | null;
  /** When no date is recorded: the last old-Act date and the first new-Act date after it. */
  between: DateRange | null;
}

export interface TimelineLane {
  id: 'legislation' | 'assessment' | 'second-assessment' | 'amendments' | 'other';
  label: string;
}

export interface TimelineModel {
  /** In list order. */
  items: TimelineItem[];
  acts: TimelineAct[];
  transitions: TimelineTransition[];
  lanes: TimelineLane[];
  summary: string;
  defaultSelectedId: string | null;
}

/** A pre-Track amendment document, its type already named. */
export interface AmendmentDocument {
  id: string;
  type: string;
  displayName: string;
  datePosted: string;
}

export interface TimelineInput {
  project: DemiProject;
  documents: AmendmentDocument[];
  lists: ListRef[];
  today: Date;
}

const DAY = 24 * 60 * 60 * 1000;
/** Eagle writes a blank date as the epoch, so anything before 1971 is no date. */
const EARLIEST = Date.UTC(1971, 0, 1);

const ASSESSMENT = 6;
const SUBSTANTIAL_START = 10;
const AMENDMENT_TYPES = [7, 15, 16];
const DESIGNED_WORK_NAMES: Record<number, string> = {
  7: 'Amendment',
  9: 'Extension',
  11: 'Transfer',
  15: 'Material alteration',
  16: 'Joint Complex Amendment',
};

const STATUS: Record<NonNullable<Work['workState']>, WorkStatus> = {
  COMPLETED: 'completed',
  CLOSED: 'closed',
  WITHDRAWN: 'withdrawn',
  TERMINATED: 'terminated',
  IN_PROGRESS: 'inProgress',
  SUSPENDED: 'suspended',
};

const SUBSTANTIAL_OUTCOMES: Record<string, SubstantialStartOutcome> = {
  'Project is Substantially Started': 'Substantially started',
  'Project is Not Substantially Started': 'Not substantially started',
};

const POST_CERTIFICATE_STAGES = [
  'Preconstruction',
  'Construction',
  'Operation',
  'Care and Maintenance',
  'Decommissioning',
];

// Track writes "In progress" in the certificate field before a decision.
const CERTIFICATE_NUMBER = /^[A-Z]\d{2}-\d{2}$/;

export const AMENDMENT_DOCUMENT_TERMS: ListTerm[] = [
  { name: 'Amendment Package', legislation: 2002 },
  { name: 'Amendment Package', legislation: 2018 },
  { name: 'Amendment Information', legislation: 2018 },
];

function at(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) || time < EARLIEST ? null : time;
}

function days(from: number, to: number): number {
  return Math.max(0, Math.round((to - from) / DAY));
}

function listName(ref: unknown, lists: ListRef[]): string | null {
  if (typeof ref === 'string') return lists.find((row) => row.id === ref)?.name ?? null;
  const name = (ref as { name?: unknown } | null)?.name;
  return typeof name === 'string' && name ? name : null;
}

function certificateName(actYear: number): string {
  return actYear === 1996 ? 'Project Approval Certificate' : 'Environmental Assessment Certificate';
}

function certificateTitle(outcome: CertificateOutcome, actYear: number): string {
  if (outcome === 'terminated') return 'Assessment terminated';
  return `${certificateName(actYear)} ${outcome}`;
}

function decisionOf(outcome: string | null): Decision | null {
  if (!outcome) return null;
  if (/refus|denied|not (issued|approved|granted)|reject/i.test(outcome)) return 'refused';
  return 'approved';
}

function isProponentTime(name: string): boolean {
  return /\(proponent time\)/i.test(name);
}

/** The project's Act blocks, oldest first. A project with no list reads as its one current Act. */
function blocksOf(project: DemiProject): number[] {
  const listed = (project.legislationYearList ?? []).filter((year) => actByYear(year));
  if (listed.length) return [...new Set(listed)].sort((a, b) => a - b);
  const current = Number(project.currentLegislationYear?.replace('legislation_', ''));
  const year = actByYear(current)?.year ?? actFor(project.legislation)?.year;
  return year ? [year] : [];
}

function blockOf(project: DemiProject, year: number, current: number) {
  return project[`legislation_${year}`] ?? (year === current ? project : {});
}

interface Assessment {
  work: Work | null;
  phases: Phase[];
}

/** One assessment per type-6 work, oldest first; else the project's own `phases`. */
function assessmentsOf(project: DemiProject, works: Work[]): Assessment[] {
  const assessmentWorks = works
    .filter((work) => work.workTypeId === ASSESSMENT && work.phases.length)
    .sort((a, b) => (at(a.startDate) ?? 0) - (at(b.startDate) ?? 0));
  if (assessmentWorks.length) return assessmentWorks.map((work) => ({ work, phases: work.phases }));
  const phases = phasesOf(project);
  return phases.length ? [{ work: null, phases }] : [];
}

function phaseStatus(phase: Phase, now: number): 'done' | 'current' | 'planned' {
  const start = at(phase.startDate);
  const end = at(phase.endDate);
  if (phase.isCompleted ?? (end != null && end <= now)) return 'done';
  return start != null && start <= now ? 'current' : 'planned';
}

function whoseTimeOf(phases: Phase[], now: number): WhoseTime | null {
  const time = { eaoDays: 0, proponentDays: 0 };
  let dated = false;
  for (const phase of phases) {
    const start = at(phase.startDate);
    if (start == null || start > now) continue;
    dated = true;
    const spent = days(start, Math.min(at(phase.endDate) ?? now, now));
    if (isProponentTime(phase.name)) time.proponentDays += spent;
    else time.eaoDays += spent;
  }
  return dated ? time : null;
}

function milestonesOf(work: Work, status: WorkStatus, open: boolean, end: string | null) {
  const milestones: TimelineMilestone[] = work.milestones.flatMap((milestone: Milestone) => {
    const date = milestone.actualDate ?? milestone.anticipatedDate;
    if (!date) return [];
    const decision = milestone.position === 'END' ? decisionOf(milestone.outcome) : null;
    return [
      {
        name: milestone.name,
        date,
        planned: !milestone.actualDate,
        outcome: decision ? milestone.outcome : null,
        decision,
        stop: decision === 'refused',
      },
    ];
  });
  const decided = milestones.some((milestone) => milestone.decision && !milestone.planned);
  const endedWithoutDecision = !open && !decided && status !== 'completed';
  if (endedWithoutDecision && end) {
    const name =
      status === 'closed'
        ? 'Ended with no decision'
        : status === 'withdrawn'
          ? 'Withdrawn'
          : 'Terminated';
    milestones.push({ name, date: end, planned: false, outcome: null, decision: null, stop: true });
  }
  return { milestones, endedWithoutDecision };
}

function workItem(work: Work): WorkItem {
  const status: WorkStatus =
    (work.workState && STATUS[work.workState]) ??
    (work.isActive || !work.decisionDate ? 'inProgress' : 'completed');
  const open = status === 'inProgress' || status === 'suspended';
  const actual = work.milestones
    .map((milestone) => milestone.actualDate)
    .filter((date): date is string => !!date);
  const end = open ? null : (work.decisionDate ?? actual[actual.length - 1] ?? null);
  const { milestones, endedWithoutDecision } = milestonesOf(work, status, open, end);
  const planned = milestones.filter((milestone) => milestone.planned);
  const endMilestone = [...work.milestones]
    .reverse()
    .find((milestone) => milestone.position === 'END' && milestone.outcome);
  return {
    kind: 'work',
    id: `work-${work.trackWorkId}`,
    title: work.title ?? work.workType,
    lane: AMENDMENT_TYPES.includes(work.workTypeId) ? 'amendments' : 'other',
    actYear: 2018,
    start: work.startDate,
    end,
    branch: false,
    trackWorkId: work.trackWorkId,
    workTypeId: work.workTypeId,
    workType: DESIGNED_WORK_NAMES[work.workTypeId] ?? work.workType,
    status,
    open,
    milestones,
    plannedDecision: open
      ? (planned[planned.length - 1]?.date ??
        (work.milestones.length ? null : work.anticipatedDecisionDate))
      : null,
    decision: decisionOf(work.outcome ?? endMilestone?.outcome ?? null),
    endedWithoutDecision,
  };
}

/** Deadline from Track's certificate expiry, decision from the type-10 work, else Eagle's flag. */
function substantialStart(project: DemiProject, works: Work[]): SubstantialStartItem | null {
  const work = works.find((one) => one.workTypeId === SUBSTANTIAL_START);
  let deadline: string | null = null;
  let decided: string | null = null;
  let outcome: SubstantialStartOutcome = 'Not yet decided';
  if (work) {
    deadline = at(project.eacExpires) != null ? (project.eacExpires ?? null) : null;
    const end = [...work.milestones]
      .reverse()
      .find((milestone) => milestone.position === 'END' && milestone.outcome);
    const named = end?.outcome ? SUBSTANTIAL_OUTCOMES[end.outcome] : undefined;
    if (named && end?.actualDate) {
      outcome = named;
      decided = end.actualDate;
    }
  } else if (at(project.substantiallyDate) != null) {
    decided = project.substantiallyDate ?? null;
    outcome = project.substantially ? 'Substantially started' : 'Not substantially started';
  } else {
    return null;
  }
  return {
    kind: 'substantialStart',
    id: 'substantial-start',
    title: 'Substantial start',
    lane: 'other',
    actYear: null,
    start: decided ?? deadline,
    end: null,
    branch: false,
    deadline,
    decided,
    outcome,
  };
}

const EAGLE_CERTIFICATE: Record<string, CertificateOutcome> = {
  'Certificate Issued': 'issued',
  'Certificate Refused': 'refused',
  Terminated: 'terminated',
};

/** Track first: a finished "EAC Decision" phase and a real certificate number; else Eagle. */
function lastCertificate(
  project: DemiProject,
  assessment: Assessment | undefined,
  currentYear: number,
  lists: ListRef[],
): Pick<CertificateItem, 'outcome' | 'source' | 'start' | 'actYear' | 'certificateNumber'> | null {
  const number = project.eaCertificate?.trim() ?? '';
  const decisionPhase = assessment?.phases.find(
    (phase) => stageRowFor(2018, phase.name)?.name === 'Referral and Decision',
  );
  if (decisionPhase?.isCompleted && CERTIFICATE_NUMBER.test(number)) {
    const date = at(project.eacSigned) != null ? project.eacSigned! : decisionPhase.endDate;
    return {
      outcome: 'issued',
      source: 'track',
      start: date,
      actYear: 2018,
      certificateNumber: number,
    };
  }
  const work = assessment?.work;
  if (work?.decisionDate && decisionOf(work.outcome) === 'refused') {
    return {
      outcome: 'refused',
      source: 'track',
      start: work.decisionDate,
      actYear: 2018,
      certificateNumber: null,
    };
  }
  const eagle = EAGLE_CERTIFICATE[listName(project.eacDecision, lists) ?? ''];
  if (eagle && at(project.decisionDate) != null) {
    return {
      outcome: eagle,
      source: 'eagle',
      start: project.decisionDate!,
      actYear: currentYear,
      certificateNumber: CERTIFICATE_NUMBER.test(number) ? number : null,
    };
  }
  return null;
}

function currentStageOf(project: DemiProject, lists: ListRef[]): string | null {
  if (POST_CERTIFICATE_STAGES.includes(project.projectState ?? '')) return project.projectState!;
  const phase = listName(project.currentPhaseName, lists) ?? '';
  return phase === 'Complete' || phase === 'Post Decision - Complete' ? 'Completed' : null;
}

function actName(year: number): string {
  return `${year} Act`;
}

interface Keyed {
  item: TimelineItem;
  key: number;
}

/** Builds the timeline from the DEMI project document, its amendment documents and the lists. */
export function buildTimelineModel({
  project,
  documents,
  lists,
  today,
}: TimelineInput): TimelineModel {
  const now = today.getTime();
  const works = worksOf(project);
  const years = blocksOf(project);
  const currentYear = years[years.length - 1] ?? NaN;
  const assessments = assessmentsOf(project, works);
  // Track holds only the 2018 Act, so its phases belong to the 2018 block.
  const trackYear = years.includes(2018) ? 2018 : currentYear;
  const keyed: Keyed[] = [];
  const push = (item: TimelineItem, key: number) => keyed.push({ item, key });

  const acts: TimelineAct[] = [];
  const transitions: TimelineTransition[] = [];
  let previousLast: number | null = null;
  let cursor = Number.NEGATIVE_INFINITY;

  years.forEach((year, index) => {
    const act = actByYear(year)!;
    const block = blockOf(project, year, currentYear);
    const isCurrent = year === currentYear;
    const milestones: [string, string, number][] = [];
    const addMilestone = (title: string, iso: unknown) => {
      const time = typeof iso === 'string' ? at(iso) : null;
      if (time != null) milestones.push([title, iso as string, time]);
    };
    if (!isCurrent) addMilestone('Decision date', block.decisionDate);
    addMilestone('180-day review starts', block.review180Start);
    addMilestone('45-day decision period starts', block.review45Start);

    const trackPhases = year === trackYear ? (assessments[0]?.phases ?? []) : [];
    const trackTimes = trackPhases.flatMap((phase) =>
      [at(phase.startDate), at(phase.endDate)].filter((time): time is number => time != null),
    );
    const ownTimes = [...milestones.map(([, , time]) => time), ...trackTimes];
    const firstOwn = ownTimes.length ? Math.min(...ownTimes) : null;

    if (index > 0) {
      const fromYear = years[index - 1];
      const recorded = project.legislationTransitions?.find(
        (one) => one.fromYear === fromYear && one.toYear === year,
      );
      const date = at(recorded?.date) != null ? recorded!.date : null;
      // Nothing moves to an Act before it is in force, so that bounds the range too.
      const lo = Math.max(previousLast ?? -Infinity, at(act.inForce) ?? -Infinity);
      // The first thing that began under the new Act after that.
      const after = [
        ...milestones.map(([, , time]) => time),
        ...trackPhases.map((phase) => at(phase.startDate)),
      ].filter((time): time is number => time != null && time >= lo);
      const between: DateRange | null = date
        ? null
        : {
            from: Number.isFinite(lo) ? new Date(lo).toISOString().slice(0, 10) : null,
            to: after.length ? new Date(Math.min(...after)).toISOString().slice(0, 10) : null,
          };
      const transition: TimelineTransition = { fromYear, toYear: year, date, between };
      transitions.push(transition);
      const key = at(date) ?? (Number.isFinite(lo) ? lo : cursor + 1);
      cursor = key;
      push(
        {
          kind: 'transition',
          id: `transition-${fromYear}-${year}`,
          title: `Transitioned to the ${actName(year)}`,
          lane: 'assessment',
          actYear: year,
          start: date,
          end: null,
          branch: false,
          transition,
        },
        key,
      );
    }

    const bandKey = index > 0 ? cursor + 1 : (firstOwn ?? cursor) - 3 * DAY;
    cursor = bandKey;
    const phaseItems: Keyed[] = [];

    if (trackPhases.length) {
      const whoseTime = whoseTimeOf(trackPhases, now);
      trackPhases.forEach((phase, i) => {
        phaseItems.push(
          trackPhaseItem(phase, trackPhases, i, year, false, whoseTime, now, 'phase'),
        );
      });
    } else {
      const names = (Array.isArray(block.phaseHistory) ? block.phaseHistory : [])
        .map((ref) => listName(ref, lists))
        .filter((name): name is string => !!name && !isOffRail(name));
      const rows = [
        ...new Map(
          names.map((name) => {
            const row = stageRowFor(year, name);
            return [row?.name ?? name, row] as const;
          }),
        ),
      ].filter(([name]) => name !== POST_DECISION_ROW);
      const knownRange: DateRange = {
        from: firstOwn != null ? iso(firstOwn) : previousLast != null ? iso(previousLast) : null,
        to: ownTimes.length ? iso(Math.max(...ownTimes)) : null,
      };
      const collapse = index < years.length - 1 && rows.length > 0;
      const historyId = `history-${year}`;
      rows.forEach(([name, row], i) => {
        phaseItems.push({
          item: {
            kind: 'phase',
            id: `phase-${year}-${i}`,
            title: name,
            lane: 'assessment',
            actYear: year,
            start: null,
            end: null,
            branch: false,
            row,
            status: 'undated',
            knownRange,
            whoseTime: null,
            ...(collapse ? { parentId: historyId } : {}),
          },
          key: bandKey + i + 2,
        });
      });
      if (collapse) {
        push(
          {
            kind: 'history',
            id: historyId,
            title: `${actName(year)} phases`,
            lane: 'assessment',
            actYear: year,
            start: null,
            end: null,
            branch: false,
            childIds: phaseItems.map(({ item }) => item.id),
            datedMilestones: milestones.length,
            knownRange,
          },
          bandKey + 1,
        );
      }
    }

    const rowsOnProject = new Set(
      phaseItems.flatMap(({ item }) => (item.kind === 'phase' && item.row ? [item.row.name] : [])),
    );
    acts.push({
      year,
      name: actName(year),
      label: act.label,
      inForce: act.inForce,
      current: isCurrent,
      rows: stageSetFor(year).map((row) => ({ row, onProject: rowsOnProject.has(row.name) })),
    });
    push(
      {
        kind: 'band',
        id: `band-${year}`,
        title: `Under the Environmental Assessment Act (${year})`,
        lane: null,
        actYear: year,
        actName: actName(year),
        start: act.inForce,
        end: null,
        branch: false,
        phasesUsed: rowsOnProject.size,
      },
      bandKey,
    );
    keyed.push(...phaseItems);
    milestones.forEach(([title, date, time], i) =>
      push(
        {
          kind: 'milestone',
          id: `milestone-${year}-${i}`,
          title,
          lane: 'assessment',
          actYear: year,
          start: date,
          end: null,
          branch: false,
        },
        time,
      ),
    );
    if (ownTimes.length) previousLast = Math.max(...ownTimes);
    cursor = Math.max(cursor, ...phaseItems.map(({ key }) => key));
  });

  // Every assessment after the first is a branch: the earlier one ended without a certificate.
  assessments.slice(1).forEach((assessment, i) => {
    const start = assessment.phases.find((phase) => at(phase.startDate) != null)?.startDate ?? null;
    const id = `branch-${assessment.work?.trackWorkId ?? i}`;
    push(
      {
        kind: 'branchStart',
        id,
        title: 'Second assessment begins',
        lane: 'assessment',
        actYear: trackYear,
        start,
        end: null,
        branch: true,
      },
      (at(start) ?? cursor) - 1,
    );
    const whoseTime = whoseTimeOf(assessment.phases, now);
    assessment.phases.forEach((phase, k) =>
      keyed.push(trackPhaseItem(phase, assessment.phases, k, trackYear, true, whoseTime, now, id)),
    );
  });

  const certificates: CertificateItem[] = [];
  assessments.slice(0, -1).forEach((assessment, i) => {
    const ends = assessment.phases.map((phase) => phase.endDate).filter(Boolean) as string[];
    const date = assessment.work?.decisionDate ?? ends[ends.length - 1] ?? null;
    certificates.push({
      kind: 'certificate',
      id: `certificate-${i}`,
      title: certificateTitle('terminated', trackYear),
      lane: 'assessment',
      actYear: trackYear,
      start: date,
      end: null,
      branch: i > 0,
      outcome: 'terminated',
      source: 'track',
      certificateNumber: null,
      whoseTime: whoseTimeOf(assessment.phases, now),
    });
  });
  const last = lastCertificate(project, assessments[assessments.length - 1], currentYear, lists);
  if (last) {
    const lastAssessment = assessments[assessments.length - 1];
    certificates.push({
      kind: 'certificate',
      id: 'certificate',
      title: certificateTitle(last.outcome, last.actYear ?? currentYear),
      lane: 'assessment',
      end: null,
      branch: assessments.length > 1,
      whoseTime: lastAssessment ? whoseTimeOf(lastAssessment.phases, now) : null,
      ...last,
    });
  }
  certificates.forEach((item) => push(item, (at(item.start) ?? cursor) + 2));
  const activeCertificate = [...certificates].reverse().find((item) => item.outcome === 'issued');

  const substantial = activeCertificate ? substantialStart(project, works) : null;
  if (substantial) push(substantial, (at(substantial.start) ?? now) + 1);

  const workItems = works
    .filter((work) => work.workTypeId !== ASSESSMENT && work.workTypeId !== SUBSTANTIAL_START)
    .map(workItem)
    .sort((a, b) => (at(a.start) ?? 0) - (at(b.start) ?? 0));
  const byDay = new Map<string, WorkItem[]>();
  for (const work of workItems) {
    const day = work.start?.slice(0, 10) ?? '';
    byDay.set(day, [...(byDay.get(day) ?? []), work]);
  }
  for (const [day, group] of byDay) {
    const key = at(day) ?? cursor;
    if (day && group.length > 1) {
      const id = `group-${day}`;
      group.forEach((work, i) => {
        work.parentId = id;
        push(work, key + 2 + i);
      });
      push(
        {
          kind: 'group',
          id,
          title: `${group.length} works received the same day`,
          lane: group[0].lane,
          actYear: 2018,
          start: day,
          end: null,
          branch: false,
          childIds: group.map((work) => work.id),
          defaultOpen: group.length < 3,
        },
        key + 1,
      );
    } else {
      group.forEach((work) => push(work, key));
    }
  }

  // Track amendment works replace the documents from the day the first one was received.
  const firstTrackAmendment = Math.min(
    ...workItems
      .filter((work) => work.lane === 'amendments')
      .map((work) => at(work.start) ?? Infinity),
  );
  for (const document of documents) {
    const time = at(document.datePosted);
    if (time == null || time >= firstTrackAmendment) continue;
    const inForce = years.filter((year) => (at(actByYear(year)?.inForce) ?? 0) <= time);
    push(
      {
        kind: 'document',
        id: `document-${document.id}`,
        title: document.type,
        lane: 'amendments',
        actYear: inForce[inForce.length - 1] ?? years[0] ?? null,
        start: document.datePosted,
        end: null,
        branch: false,
        documentId: document.id,
        displayName: document.displayName,
        outcome: null,
      },
      time,
    );
  }

  const openWorks = workItems.filter((work) => work.open);
  push(
    {
      kind: 'today',
      id: 'today',
      title: 'Today',
      lane: null,
      actYear: currentYear || null,
      start: today.toISOString().slice(0, 10),
      end: null,
      branch: false,
      currentStage: currentStageOf(project, lists),
      openWorks: openWorks.length,
    },
    Math.max(now, ...keyed.map(({ key }) => key)) + 5,
  );

  // An undated first Act keys its band and rows at -Infinity, so ties put the band first.
  const bandFirst = (a: TimelineItem, b: TimelineItem) =>
    a.actYear === b.actYear ? Number(b.kind === 'band') - Number(a.kind === 'band') : 0;
  const items = keyed
    .map((entry, order) => ({ ...entry, order }))
    .sort((a, b) => a.key - b.key || bandFirst(a.item, b.item) || a.order - b.order)
    .map(({ item }) => item);

  const lanes: TimelineLane[] = [
    { id: 'legislation', label: 'Legislation' },
    { id: 'assessment', label: assessments.length > 1 ? 'First assessment' : 'Project' },
    ...(assessments.length > 1
      ? [{ id: 'second-assessment', label: 'Second assessment' } as const]
      : []),
    ...(items.some((item) => item.lane === 'amendments')
      ? [{ id: 'amendments', label: 'Amendments' } as const]
      : []),
    ...(items.some((item) => item.lane === 'other')
      ? [{ id: 'other', label: 'Other work' } as const]
      : []),
  ];

  const lastCert = certificates[certificates.length - 1];
  const summary = [
    project.name,
    years.length
      ? years.map(actName).join(' → ') +
        (years.length > 1
          ? transitions.every((one) => one.date)
            ? ' (transitioned)'
            : ' (transitioned, date not recorded)'
          : '')
      : '',
    activeCertificate
      ? `certificate under the ${actName(activeCertificate.actYear ?? currentYear)}${activeCertificate.branch ? ' (second assessment)' : ''}`
      : (lastCert?.title.toLowerCase() ?? ''),
    assessments.length > 1 ? 'two assessments' : '',
    works.length ? `${works.length} works in Track` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    items,
    acts,
    transitions,
    lanes,
    summary,
    defaultSelectedId: openWorks[0]?.id ?? activeCertificate?.id ?? lastCert?.id ?? null,
  };
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function trackPhaseItem(
  phase: Phase,
  phases: Phase[],
  index: number,
  actYear: number,
  branch: boolean,
  whoseTime: WhoseTime | null,
  now: number,
  idPrefix: string,
): Keyed {
  const start = at(phase.startDate);
  const end = at(phase.endDate);
  const base = {
    lane: 'assessment' as const,
    actYear,
    start: phase.startDate,
    end: phase.endDate,
    branch,
    whoseTime,
    status: phaseStatus(phase, now),
  };
  const key = start ?? 0;
  if (isProponentTime(phase.name)) {
    const next = phases.slice(index + 1).find((one) => !isProponentTime(one.name));
    return {
      item: {
        kind: 'proponent',
        id: `${idPrefix}-proponent-${index}`,
        title: 'With the proponent',
        days: start != null && end != null ? days(start, end) : 0,
        beforePhase: next ? (stageRowFor(actYear, next.name)?.name ?? next.name) : null,
        ...base,
      },
      key,
    };
  }
  const row = stageRowFor(actYear, phase.name);
  return {
    item: {
      kind: 'phase',
      id: `${idPrefix}-${index}`,
      title: row?.name ?? phase.name,
      row,
      knownRange: null,
      ...base,
    },
    key,
  };
}

const PAGE_SIZE = 100;

/** Every amendment document of the project, read a page at a time up to DEMI's anonymous depth. */
async function readAmendmentDocuments(
  projId: string,
  typeIds: string[],
  lists: ListRef[],
  signal: AbortSignal,
): Promise<AmendmentDocument[]> {
  const filters = documentFilters({ type: typeIds.join(',') });
  const rows = [];
  let total = Infinity;
  for (let page = 1; rows.length < total; page++) {
    const next = await readDocuments({ projId, page, pageSize: PAGE_SIZE, filters }, signal);
    total = reachableTotal(next.total, PAGE_SIZE);
    if (!next.rows.length) break;
    rows.push(...next.rows);
  }
  return rows.map((document) => ({
    id: document._id,
    type: listName(document.type, lists) ?? 'Amendment document',
    displayName: document.displayName,
    datePosted: new Date(document.datePosted).toISOString(),
  }));
}

/** The Timeline tab's model for a project, `null` while its reads are in flight. */
export function useTimelineModel(projId: string): TimelineModel | null {
  const project = useDemiProject(projId);
  const listsQuery = useQuery(listsQueryOptions());
  const lists = useMemo(() => listsQuery.data ?? [], [listsQuery.data]);
  const typeIds = useMemo(() => idsForTerms(AMENDMENT_DOCUMENT_TERMS, lists), [lists]);
  const documents = useQuery({
    queryKey: ['timelineAmendmentDocuments', projId, typeIds],
    queryFn: ({ signal }) => readAmendmentDocuments(projId, typeIds, lists, signal),
    enabled: !!projId && typeIds.length > 0,
  });
  const loading = project.isPending || listsQuery.isPending || documents.isLoading;

  return useMemo(
    () =>
      loading
        ? null
        : buildTimelineModel({
            // No DEMI record still draws the tab, from nothing.
            project: project.data ?? {},
            documents: documents.data ?? [],
            lists,
            today: new Date(),
          }),
    [loading, project.data, documents.data, lists],
  );
}
