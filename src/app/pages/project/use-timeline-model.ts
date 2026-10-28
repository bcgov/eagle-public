import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listsQueryOptions,
  type DemiProject,
  type LegislationTransition,
  type ListRef,
} from 'app/api/api';
import { commentPeriodsQueryOptions } from 'app/api/commentperiod';
import { documentFilters, reachableTotal, readDocuments } from 'app/api/document';
import { periodDetailsHref, type CommentPeriod } from 'app/models/commentperiod';
import type { Document } from 'app/models/document';
import {
  phasesOf,
  useDemiProject,
  worksOf,
  type Milestone,
  type Phase,
  type Work,
} from 'app/api/project-phases';
import { Constants } from 'app/utils/constants';
import { documentTabByKey, idsForTerms, type ListTerm } from 'app/utils/document-tabs';
import { actByYear, actFor } from 'app/utils/legislation';
import type { DownloadableDocument } from 'app/utils/utils';
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
  /** Set when the phase is dated by the documents filed under it, not by Track. */
  documentCount?: number;
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
  /** Set on a comment period row. */
  commentPeriod?: { label: string | null; href: string | null };
}

export interface TransitionItem extends ItemBase {
  kind: 'transition';
  transition: TimelineTransition;
}

/** What `isInlineViewable` reads to pick the inline view over the download. */
type DocumentFileFields = Pick<
  DownloadableDocument,
  'documentFileName' | 'internalOriginalName' | 'internalMime'
>;

export interface DocumentItem extends ItemBase, DocumentFileFields {
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
  /** By item id, for the rows that can carry documents: phases, comment periods, decisions. */
  documents: Record<string, RowDocuments>;
  /** Phase tags of project documents no phase row lists, which a page filtered by tag still shows. */
  droppedPhaseTags: Set<string>;
  /** False when the project holds more documents than an anonymous read reaches. */
  documentsComplete: boolean;
  /** True when the project documents could not be read at all. */
  documentsFailed: boolean;
  commentPeriodsFailed: boolean;
  /** True when the separate read of the amendment documents failed. */
  amendmentsFailed: boolean;
}

export interface RowDocuments {
  /** Newest first. */
  documents: TimelineDocument[];
  /** What picked them: a phase tag, a certificate type or name, or the comment period record. A
   * decision with no certificate documents borrows its decision phase's. */
  from: 'phase' | 'certificate' | 'commentPeriod';
}

/** A pre-Track amendment document, its type already named. */
export interface AmendmentDocument extends DocumentFileFields {
  id: string;
  type: string;
  displayName: string;
  datePosted: string;
}

/** A project document: its phase tag dates a phase before Track, and a row lists it. */
export interface TimelineDocument extends DownloadableDocument {
  displayName: string;
  /** The `projectPhase`, `type` and `milestone` List ids. */
  phase: string | null;
  type: string | null;
  milestone: string | null;
  datePosted: string;
}

export interface CommentPeriodSpan {
  id: string;
  start: string;
  end: string | null;
  label: string | null;
  /** The period's details page. */
  href: string | null;
  /** Document ids. */
  relatedDocuments: string[];
}

export interface TimelineInput {
  project: DemiProject;
  documents: AmendmentDocument[];
  projectDocuments?: TimelineDocument[];
  /** How many documents the project holds; more than were read when the read was capped. */
  projectDocumentTotal?: number;
  /** How many rows the read returned, undated ones included; defaults to `projectDocuments`. */
  projectDocumentsRead?: number;
  projectDocumentsFailed?: boolean;
  commentPeriods?: CommentPeriodSpan[];
  commentPeriodsFailed?: boolean;
  amendmentsFailed?: boolean;
  lists: ListRef[];
  today: Date;
}

export const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365.25 * DAY;
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

/** The values TODAY's `projectState` can hold; "Completed" comes from the Eagle phase instead. */
export const POST_CERTIFICATE_STAGES = [
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

/** A date's time in ms, or null for no date. */
export function at(iso: Date | string | null | undefined): number | null {
  if (!iso) return null;
  const time = iso instanceof Date ? iso.getTime() : Date.parse(iso);
  return Number.isNaN(time) || time < EARLIEST ? null : time;
}

/** Whole days from one time to a later one; 0 when `to` is earlier. */
export function days(from: number, to: number): number {
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

/** The stage after the certificate; none unless one was issued, since Eagle also ends a refused
 * project on "Post Decision - Complete". */
function currentStageOf(project: DemiProject, lists: ListRef[], certified: boolean): string | null {
  const issued =
    certified || EAGLE_CERTIFICATE[listName(project.eacDecision, lists) ?? ''] === 'issued';
  if (!issued) return null;
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

interface DocumentPhase {
  name: string;
  row: StageRow | null;
  times: number[];
  documents: TimelineDocument[];
}

/** The dated record of the move into `year` from the Act listed before it. */
function transitionInto(
  year: number,
  listed: number[],
  recorded: LegislationTransition[],
): LegislationTransition | undefined {
  const index = listed.indexOf(year);
  if (index < 1) return undefined;
  return recorded.find(
    (one) => one.fromYear === listed[index - 1] && one.toYear === year && at(one.date) != null,
  );
}

/** When an Act begins here: on the recorded transition into it, but never before it was in force.
 * One with neither never begins. */
function actBegins(year: number, listed: number[], recorded: LegislationTransition[]): number {
  const moved = at(transitionInto(year, listed, recorded)?.date);
  const inForce = at(actByYear(year)?.inForce);
  if (moved == null && inForce == null) return Infinity;
  return Math.max(moved ?? -Infinity, inForce ?? -Infinity);
}

/** The latest of `years` begun by `time`, else the first. */
function actAt(years: number[], time: number, begins: (year: number) => number): number | null {
  const begun = years.filter((year) => begins(year) <= time);
  return begun[begun.length - 1] ?? years[0] ?? null;
}

/** Phase-tagged document dates per Act, then per phase row, and the phase tags of documents no row
 * takes. A date before the Act was in force cannot belong to it, so it is a mis-dated import. */
function documentPhasesOf(
  documents: TimelineDocument[],
  lists: ListRef[],
  blocks: number[],
  begins: (year: number) => number,
): { byYear: Map<number, Map<string, DocumentPhase>>; dropped: Set<string> } {
  const refs = new Map(lists.map((ref) => [ref.id, ref]));
  const byYear = new Map<number, Map<string, DocumentPhase>>();
  const place = (document: TimelineDocument): boolean => {
    const time = at(document.datePosted);
    const ref = document.phase ? refs.get(document.phase) : undefined;
    if (time == null || !ref?.name || !ref.legislation || isOffRail(ref.name)) return false;
    // A 1996 block files its phases under the 2002 List rows.
    const owners = blocks.filter(
      (year) => (actByYear(year)?.phaseRowsYear ?? year) === ref.legislation,
    );
    const year = owners.length ? actAt(owners, time, begins) : actByYear(ref.legislation)?.year;
    if (year == null || time < (at(actByYear(year)?.inForce) ?? -Infinity)) return false;
    const row = stageRowFor(year, ref.name);
    const name = row?.name ?? ref.name;
    if (name === POST_DECISION_ROW) return false;
    const phases = byYear.get(year) ?? new Map<string, DocumentPhase>();
    byYear.set(year, phases);
    const phase = phases.get(phaseSlug(name)) ?? { name, row, times: [], documents: [] };
    phases.set(phaseSlug(name), phase);
    phase.times.push(time);
    phase.documents.push(document);
    return true;
  };
  const dropped = new Set<string>();
  for (const document of documents) {
    if (!place(document) && document.phase) dropped.add(document.phase);
  }
  return { byYear, dropped };
}

/** First and last posting; a lone document dates a point. A leading run under a tenth of the
 * documents, over two years before the rest, is a mis-dated import and dropped. */
function documentSpan(times: number[]): { start: number; end: number | null; count: number } {
  const sorted = [...times].sort((a, b) => a - b);
  let from = 0;
  for (let i = 1; i < sorted.length && i <= sorted.length / 10; i++) {
    if (sorted[i] - sorted[i - 1] > 2 * YEAR) from = i;
  }
  const kept = sorted.slice(from);
  return {
    start: kept[0],
    end: kept.length > 1 ? kept[kept.length - 1] : null,
    count: kept.length,
  };
}

/** A phase name with case, accents and punctuation dropped; names alike here are one row. */
function phaseSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'row';
}

/** Keyed by name, not position, so a saved `?item=` link survives other rows coming or going. */
function phaseRowId(year: number, name: string): string {
  return `phase-${year}-${phaseSlug(name)}`;
}

/** Rows for the phases of an Act only its documents date, in the Act's stage order. */
function documentItemsOf(
  year: number,
  phases: Map<string, DocumentPhase> | undefined,
  trackRows: Set<string>,
): PhaseItem[] {
  const order = stageSetFor(year);
  const rank = (row: StageRow | null) => (row ? order.indexOf(row) : order.length);
  return [...(phases?.values() ?? [])]
    .filter(({ row }) => !(row && trackRows.has(row.name)))
    .sort((a, b) => rank(a.row) - rank(b.row))
    .map(({ name, row, times }) => {
      const { start, end, count } = documentSpan(times);
      return {
        kind: 'phase',
        id: phaseRowId(year, name),
        title: name,
        lane: 'assessment',
        actYear: year,
        start: new Date(start).toISOString(),
        end: end == null ? null : new Date(end).toISOString(),
        branch: false,
        row,
        status: 'done',
        knownRange: null,
        whoseTime: null,
        documentCount: count,
      };
    });
}

/** Builds the timeline from the DEMI project document, its amendment documents and the lists. */
export function buildTimelineModel({
  project,
  documents,
  projectDocuments = [],
  projectDocumentTotal = projectDocuments.length,
  projectDocumentsRead = projectDocuments.length,
  projectDocumentsFailed = false,
  commentPeriods = [],
  commentPeriodsFailed = false,
  amendmentsFailed = false,
  lists,
  today,
}: TimelineInput): TimelineModel {
  const now = today.getTime();
  const works = worksOf(project);
  const listed = blocksOf(project);
  const currentYear = listed[listed.length - 1] ?? NaN;
  const assessments = assessmentsOf(project, works);
  // A Track phase with no Act name belongs to the 2018 block, the only Act Track holds.
  const trackYear = listed.includes(2018) ? 2018 : currentYear;
  const phaseYear = (phase: Phase) => actFor(phase.eaActName)?.year ?? trackYear;
  // An Act a Track phase or a document names but Eagle does not list gets its own band, with no
  // transition.
  const blocks = [
    ...new Set([...listed, ...assessments.flatMap(({ phases }) => phases.map(phaseYear))]),
  ].filter(Number.isFinite);
  const recorded = project.legislationTransitions ?? [];
  const begins = (year: number) => actBegins(year, listed, recorded);
  const { byYear: documentPhases, dropped: droppedPhaseTags } = documentPhasesOf(
    projectDocuments,
    lists,
    blocks,
    begins,
  );
  const years = [...new Set([...blocks, ...documentPhases.keys()])].sort((a, b) => a - b);
  const keyed: Keyed[] = [];
  const push = (item: TimelineItem, key: number) => keyed.push({ item, key });

  const acts: TimelineAct[] = [];
  const transitions: TimelineTransition[] = [];
  let previousLast: number | null = null;
  let cursor = Number.NEGATIVE_INFINITY;
  /** Per Act, the key no phase or comment period of it sorts above. */
  const floors = new Map<number, number>();

  years.forEach((year) => {
    const act = actByYear(year)!;
    const block = blockOf(project, year, currentYear);
    const isCurrent = year === currentYear;
    const listedIndex = listed.indexOf(year);
    const milestones: [string, string, number][] = [];
    const addMilestone = (title: string, iso: unknown) => {
      const time = typeof iso === 'string' ? at(iso) : null;
      if (time != null) milestones.push([title, iso as string, time]);
    };
    if (!isCurrent) addMilestone('Decision date', block.decisionDate);
    addMilestone('180-day review starts', block.review180Start);
    addMilestone('45-day decision period starts', block.review45Start);

    const firstPhases = assessments[0]?.phases ?? [];
    const trackPhases = firstPhases.filter((phase) => phaseYear(phase) === year);
    const trackTimes = trackPhases.flatMap((phase) =>
      [at(phase.startDate), at(phase.endDate)].filter((time): time is number => time != null),
    );
    const whoseTime = whoseTimeOf(trackPhases, now);
    const trackItems = firstPhases.flatMap((phase, i) =>
      phaseYear(phase) === year
        ? [trackPhaseItem(phase, firstPhases, i, year, false, whoseTime, now, 'phase')]
        : [],
    );
    // Every assessment's stages: one only the second assessment dates gets no document row either.
    const trackRows = new Set(
      assessments.flatMap(({ phases }) =>
        phases.flatMap((phase) => {
          const row =
            phaseYear(phase) === year && !isProponentTime(phase.name)
              ? stageRowFor(year, phase.name)
              : null;
          return row ? [row.name] : [];
        }),
      ),
    );
    // A stage Track dates wins over its documents.
    const documentRows = documentItemsOf(year, documentPhases.get(year), trackRows);
    const documentStarts = documentRows.map((item) => at(item.start)!);
    const documentTimes = documentRows.flatMap((item) =>
      [at(item.start), at(item.end)].filter((time): time is number => time != null),
    );
    const ownTimes = [...milestones.map(([, , time]) => time), ...trackTimes, ...documentTimes];
    const firstOwn = ownTimes.length ? Math.min(...ownTimes) : null;

    if (listedIndex > 0) {
      const fromYear = listed[listedIndex - 1];
      const date = transitionInto(year, listed, recorded)?.date ?? null;
      // Nothing moves to an Act before it is in force, so that bounds the range too.
      const lo = Math.max(previousLast ?? -Infinity, at(act.inForce) ?? -Infinity);
      // The first thing that began under the new Act after that.
      const after = [
        ...milestones.map(([, , time]) => time),
        ...trackPhases.map((phase) => at(phase.startDate)),
        ...documentStarts,
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

    const bandKey =
      listedIndex > 0 ? cursor + 1 : Math.max(cursor + 1, (firstOwn ?? cursor) - 3 * DAY);
    cursor = bandKey;
    const datedRows = new Set(
      [...trackRows, ...documentRows.map((item) => item.title)].map(phaseSlug),
    );

    // Eagle's undated history stays beside Track; a stage Track or documents date drops its row.
    const names = (Array.isArray(block.phaseHistory) ? block.phaseHistory : [])
      .map((ref) => listName(ref, lists))
      .filter((name): name is string => !!name && !isOffRail(name));
    const rows = [
      ...new Map(
        names.map((name) => {
          const row = stageRowFor(year, name);
          const title = row?.name ?? name;
          return [phaseSlug(title), { title, row }] as const;
        }),
      ),
    ].filter(([slug, { title }]) => title !== POST_DECISION_ROW && !datedRows.has(slug));
    const knownRange: DateRange = {
      from: firstOwn != null ? iso(firstOwn) : previousLast != null ? iso(previousLast) : null,
      to: ownTimes.length ? iso(Math.max(...ownTimes)) : null,
    };
    // Only an Act the project later left folds its history.
    const collapse = listedIndex < listed.length - 1 && rows.length > 0;
    const historyId = `history-${year}`;
    const historyItems = rows.map(([, { title, row }], i): Keyed => ({
      item: {
        kind: 'phase',
        id: phaseRowId(year, title),
        title,
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
    }));
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
          childIds: historyItems.map(({ item }) => item.id),
          datedMilestones: milestones.length,
          knownRange,
        },
        bandKey + 1,
      );
    }
    // No phase sorts above its band or the history rows, even one dated before the transition.
    const floor = bandKey + historyItems.length + 2;
    floors.set(year, floor);
    // Stage order wins over start date: a phase's early documents do not lift it above the one before.
    let documentKey = floor - 1;
    const documentItems = documentRows.map((item): Keyed => {
      documentKey = Math.max(at(item.start)!, documentKey + 1);
      return { item, key: documentKey };
    });
    const phaseItems = [
      ...historyItems,
      ...documentItems,
      ...trackItems.map(({ item, key }) => ({ item, key: Math.max(key, floor) })),
    ];

    // trackRows holds the second assessment's stages too, which list after this loop.
    const rowsOnProject = new Set([
      ...trackRows,
      ...phaseItems.flatMap(({ item }) =>
        item.kind === 'phase' && item.row ? [item.row.name] : [],
      ),
    ]);
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
    const first = assessment.phases.find((phase) => at(phase.startDate) != null);
    const start = first?.startDate ?? null;
    const id = `branch-${assessment.work?.trackWorkId ?? i}`;
    push(
      {
        kind: 'branchStart',
        id,
        title: 'Second assessment begins',
        lane: 'assessment',
        actYear: first ? phaseYear(first) : trackYear,
        start,
        end: null,
        branch: true,
      },
      (at(start) ?? cursor) - 1,
    );
    const whoseTime = whoseTimeOf(assessment.phases, now);
    assessment.phases.forEach((phase, k) =>
      keyed.push(
        trackPhaseItem(phase, assessment.phases, k, phaseYear(phase), true, whoseTime, now, id),
      ),
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

  // Track amendment works replace the documents from the day the first one was received,
  // by the same UTC day the timeline prints and groups works by.
  const firstTrackAmendment = Math.min(
    ...workItems
      .filter((work) => work.lane === 'amendments')
      .map((work) => at(work.start) ?? Infinity),
  );
  const firstTrackDay = Number.isFinite(firstTrackAmendment) ? iso(firstTrackAmendment) : null;
  for (const document of documents) {
    const time = at(document.datePosted);
    if (time == null || (firstTrackDay != null && iso(time) >= firstTrackDay)) continue;
    push(
      {
        kind: 'document',
        id: `document-${document.id}`,
        title: document.type,
        lane: 'amendments',
        actYear: actAt(years, time, begins),
        start: document.datePosted,
        end: null,
        branch: false,
        documentId: document.id,
        displayName: document.displayName,
        documentFileName: document.documentFileName,
        internalOriginalName: document.internalOriginalName,
        internalMime: document.internalMime,
        outcome: null,
      },
      time,
    );
  }

  for (const period of commentPeriods) {
    const time = at(period.start);
    if (time == null) continue;
    const actYear = actAt(years, time, begins);
    push(
      {
        kind: 'milestone',
        id: periodItemId(period),
        title: 'Public comment period',
        lane: 'assessment',
        actYear,
        start: period.start,
        end: period.end,
        branch: false,
        commentPeriod: { label: period.label, href: period.href },
      },
      // Below its Act's band and the transition into it, as a document-dated phase is.
      Math.max(time, floors.get(actYear ?? NaN) ?? -Infinity),
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
      currentStage: currentStageOf(project, lists, activeCertificate != null),
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
        (transitions.length
          ? transitions.every((one) => one.date)
            ? ' (transitioned)'
            : ' (transitioned, date not recorded)'
          : '')
      : '',
    activeCertificate
      ? `certificate under the ${actName(activeCertificate.actYear ?? currentYear)}${activeCertificate.branch ? ' (second assessment)' : ''}`
      : (lastCert?.title.toLowerCase() ?? ''),
    assessments.length > 1 ? 'two assessments' : '',
    works.length ? `${works.length} ${works.length === 1 ? 'work' : 'works'} in Track` : '',
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
    documents: rowDocumentsOf(items, documentPhases, projectDocuments, commentPeriods, lists),
    droppedPhaseTags,
    documentsComplete: !projectDocumentsFailed && projectDocumentTotal <= projectDocumentsRead,
    documentsFailed: projectDocumentsFailed,
    commentPeriodsFailed,
    amendmentsFailed,
  };
}

function periodItemId(period: CommentPeriodSpan): string {
  return `comment-period-${period.id}`;
}

function newestFirst(documents: TimelineDocument[]): TimelineDocument[] {
  return [...documents].sort((a, b) => (at(b.datePosted) ?? 0) - (at(a.datePosted) ?? 0));
}

/** A name match counts only this close to a decision: later amendment and insurance documents
 * also name the certificate. */
const CERTIFICATE_NAME_WINDOW = 90 * DAY;

/** A decision's documents: those its certificate type, milestone or name marks, each given to the
 * decision dated nearest its posting; else the documents of the Act's decision phase. */
function rowDocumentsOf(
  items: TimelineItem[],
  documentPhases: Map<number, Map<string, DocumentPhase>>,
  documents: TimelineDocument[],
  periods: CommentPeriodSpan[],
  lists: ListRef[],
): Record<string, RowDocuments> {
  const rows: Record<string, RowDocuments> = {};
  const phases = items.filter((item): item is PhaseItem => item.kind === 'phase');
  // A List row tag cannot tell the assessments apart, so its documents list on the main line, or on
  // the branch when only the branch has that stage.
  const mainLine = new Set(
    phases.filter((item) => !item.branch).map((item) => `${item.actYear}-${phaseSlug(item.title)}`),
  );
  for (const item of phases) {
    if (item.branch && mainLine.has(`${item.actYear}-${phaseSlug(item.title)}`)) continue;
    const tagged =
      documentPhases.get(item.actYear ?? NaN)?.get(phaseSlug(item.title))?.documents ?? [];
    rows[item.id] = { documents: newestFirst(tagged), from: 'phase' };
  }

  const byId = new Map(documents.map((document) => [document._id, document]));
  for (const period of periods) {
    const related = period.relatedDocuments.flatMap((id) => byId.get(id) ?? []);
    rows[periodItemId(period)] = {
      documents: newestFirst(related),
      from: 'commentPeriod',
    };
  }

  const certificates = items.filter(
    (item): item is CertificateItem => item.kind === 'certificate' && at(item.start) != null,
  );
  const tab = documentTabByKey(Constants.optionalProjectDocTabs.CERTIFICATE);
  const marks = new Set(idsForTerms([...(tab?.types ?? []), ...(tab?.milestones ?? [])], lists));
  const marked = new Map<string, TimelineDocument[]>();
  for (const document of documents) {
    const time = at(document.datePosted);
    const byMark = marks.has(document.type ?? '') || marks.has(document.milestone ?? '');
    const byName = !byMark && /certificate/i.test(document.displayName);
    if (time == null || !(byMark || byName) || !certificates.length) continue;
    const nearest = certificates.reduce((best, item) =>
      Math.abs(at(item.start)! - time) < Math.abs(at(best.start)! - time) ? item : best,
    );
    if (byName && Math.abs(at(nearest.start)! - time) > CERTIFICATE_NAME_WINDOW) continue;
    marked.set(nearest.id, marked.get(nearest.id) ?? []);
    marked.get(nearest.id)!.push(document);
  }
  for (const item of items) {
    if (item.kind !== 'certificate') continue;
    const own = marked.get(item.id);
    if (own) {
      rows[item.id] = { documents: newestFirst(own), from: 'certificate' };
      continue;
    }
    const order = stageSetFor(item.actYear ?? NaN);
    const decisionRow = order[order.findIndex((row) => row.name === POST_DECISION_ROW) - 1];
    if (item.branch) continue;
    const sameAct = phases.filter(
      (phase) => phase.actYear === item.actYear && phase.title === decisionRow?.name,
    );
    const phase = sameAct.find((one) => !one.branch);
    rows[item.id] = phase ? rows[phase.id] : { documents: [], from: 'phase' };
  }
  return rows;
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
/** Pages in flight at once, to stay under the gateway's rate limit. */
const PARALLEL_PAGES = 4;

/** Every document of the project the filters match, up to DEMI's anonymous depth, each once. */
async function readAllDocuments(
  projId: string,
  filters: Record<string, string[]>,
  signal: AbortSignal,
): Promise<{ rows: Document[]; total: number }> {
  // Offset pages need a fixed order, or rows repeat and go missing between pages. DEMI breaks
  // `datePosted` ties on id.
  const page = (number: number) =>
    readDocuments(
      { projId, page: number, pageSize: PAGE_SIZE, sortBy: 'datePosted', filters },
      signal,
    );
  const first = await page(1);
  const pages = Math.ceil(reachableTotal(first.total, PAGE_SIZE) / PAGE_SIZE);
  const rows = [...first.rows];
  for (let next = 2; next <= pages; next += PARALLEL_PAGES) {
    const batch = Array.from({ length: Math.min(PARALLEL_PAGES, pages - next + 1) }, (_, i) =>
      page(next + i),
    );
    rows.push(...(await Promise.all(batch)).flatMap((one) => one.rows));
  }
  return { rows: [...new Map(rows.map((row) => [row._id, row])).values()], total: first.total };
}

/** A model date as ISO, or null when it is missing or no date. */
function isoOf(date: Date | string | undefined): string | null {
  const time = at(date);
  return time == null ? null : new Date(time).toISOString();
}

interface DocumentRead {
  documents: TimelineDocument[];
  total: number;
  /** Rows read, undated ones included. */
  read: number;
}

/** The project's documents the filters match; undated ones are read but dropped. */
async function readProjectDocuments(
  projId: string,
  filters: Record<string, string[]>,
  signal: AbortSignal,
): Promise<DocumentRead> {
  const { rows, total } = await readAllDocuments(projId, filters, signal);
  const documents = rows.flatMap((document): TimelineDocument[] => {
    const datePosted = isoOf(document.datePosted);
    if (!datePosted) return [];
    return [
      {
        _id: document._id,
        displayName: document.displayName,
        documentFileName: document.documentFileName,
        internalOriginalName: document.internalOriginalName,
        internalMime: document.internalMime,
        datePosted,
        phase: document.projectPhase || null,
        type: document.type || null,
        milestone: document.milestone || null,
      },
    ];
  });
  return { documents, total, read: rows.length };
}

/** The documents of the amendment types, each with its type named. */
function amendmentDocumentsOf(
  documents: TimelineDocument[],
  typeIds: string[],
  lists: ListRef[],
): AmendmentDocument[] {
  return documents.flatMap((document) =>
    document.type && typeIds.includes(document.type)
      ? [
          {
            id: document._id,
            type: listName(document.type, lists) ?? 'Amendment document',
            displayName: document.displayName,
            datePosted: document.datePosted,
            documentFileName: document.documentFileName,
            internalOriginalName: document.internalOriginalName,
            internalMime: document.internalMime,
          },
        ]
      : [],
  );
}

function periodSpans(periods: CommentPeriod[]): CommentPeriodSpan[] {
  return periods.flatMap((period) => {
    const start = isoOf(period.dateStarted);
    if (!start) return [];
    const end = isoOf(period.dateCompleted);
    return {
      id: period._id,
      start,
      // Eagle's blank end reads as no date; an end before the start is no end either.
      end: end && end >= start ? end : null,
      label: period.informationLabel || null,
      href: periodDetailsHref(period),
      relatedDocuments: period.relatedDocuments ?? [],
    };
  });
}

/** The Timeline tab's model for a project, `null` while its reads are in flight. */
export function useTimelineModel(projId: string): TimelineModel | null {
  const project = useDemiProject(projId);
  const listsQuery = useQuery(listsQueryOptions());
  const lists = useMemo(() => listsQuery.data ?? [], [listsQuery.data]);
  const typeIds = useMemo(() => idsForTerms(AMENDMENT_DOCUMENT_TERMS, lists), [lists]);
  // Before Track, Eagle dates a phase only through the documents filed under it.
  const projectDocuments = useQuery({
    queryKey: ['timelineProjectDocuments', projId],
    queryFn: ({ signal }) => readProjectDocuments(projId, {}, signal),
    enabled: !!projId,
  });
  const read = projectDocuments.data;
  // A full read already holds the amendment documents; a capped or failed one needs their own read.
  const amendmentRead =
    !!projId &&
    typeIds.length > 0 &&
    (projectDocuments.isError || (!!read && read.total > read.read));
  const amendments = useQuery({
    queryKey: ['timelineAmendmentDocuments', projId, typeIds],
    queryFn: ({ signal }) =>
      readProjectDocuments(projId, documentFilters({ type: typeIds.join(',') }), signal),
    enabled: amendmentRead,
  });
  const periods = useQuery({ ...commentPeriodsQueryOptions(projId), select: periodSpans });
  const loading =
    project.isPending ||
    listsQuery.isPending ||
    projectDocuments.isLoading ||
    (amendmentRead && amendments.isPending) ||
    periods.isLoading;
  const amendmentSource = amendmentRead ? amendments.data : read;

  return useMemo(
    () =>
      loading
        ? null
        : buildTimelineModel({
            // No DEMI record still draws the tab, from nothing.
            project: project.data ?? {},
            documents: amendmentDocumentsOf(amendmentSource?.documents ?? [], typeIds, lists),
            projectDocuments: read?.documents ?? [],
            projectDocumentTotal: read?.total,
            projectDocumentsRead: read?.read,
            projectDocumentsFailed: projectDocuments.isError,
            commentPeriods: periods.data ?? [],
            commentPeriodsFailed: periods.isError,
            amendmentsFailed: amendmentRead && amendments.isError,
            lists,
            today: new Date(),
          }),
    [
      loading,
      project.data,
      amendmentSource,
      read,
      projectDocuments.isError,
      periods.data,
      periods.isError,
      amendmentRead,
      amendments.isError,
      typeIds,
      lists,
    ],
  );
}
