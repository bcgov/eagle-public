import { useQuery } from '@tanstack/react-query';
import { demiProjectQueryOptions } from './api';

/** One Track work phase, as DEMI mirrors it. Fields DEMI did not send stay off the object. */
export interface Phase {
  name: string;
  startDate: string | null;
  endDate: string | null;
  isCompleted?: boolean;
  eaActName?: string;
  sortOrder?: number;
}

export const WORK_STATES = [
  'IN_PROGRESS',
  'SUSPENDED',
  'WITHDRAWN',
  'TERMINATED',
  'CLOSED',
  'COMPLETED',
] as const;
export type WorkState = (typeof WORK_STATES)[number];

export const MILESTONE_POSITIONS = ['START', 'INTERMEDIATE', 'END'] as const;
export type MilestonePosition = (typeof MILESTONE_POSITIONS)[number];

const MILESTONE_DATES = ['actualDate', 'anticipatedDate'] as const;
const WORK_DATES = ['startDate', 'decisionDate', 'anticipatedDecisionDate'] as const;

/** Per date the source holds as unknown, its DEMI `notAfter` day. */
export type Undated<K extends string> = Partial<Record<K, string>>;

/** One event of a work. `outcome` is the Track outcome name. */
export interface Milestone {
  name: string;
  position: MilestonePosition;
  /** The Track event type id. */
  eventType: number | null;
  actualDate: string | null;
  anticipatedDate: string | null;
  outcome: string | null;
  numberOfDays: number | null;
  /** Dates the source holds as unknown, not missing, each with the last day it can be. */
  undated?: Undated<(typeof MILESTONE_DATES)[number]>;
}

/** One work on the project document's `works`: Track's, or a non-Track one keyed by `workId`. */
export interface Work {
  trackWorkId: number | null;
  workTypeId: number | null;
  /** Set only on a non-Track work. */
  workId?: string;
  /** DEMI's type code (`assessment`, `amendment`), set only on a non-Track work. */
  workTypeCode?: string;
  actYear?: number;
  workType: string;
  title: string | null;
  eaAct: string | null;
  startDate: string | null;
  isActive: boolean;
  workState: WorkState | null;
  decisionDate: string | null;
  anticipatedDecisionDate: string | null;
  outcome: string | null;
  phases: Phase[];
  milestones: Milestone[];
  undated?: Undated<(typeof WORK_DATES)[number]>;
}

type Row = Record<string, unknown>;
/** A payload row of `T`, every key unchecked. */
type Raw<T> = Partial<Record<keyof T, unknown>>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function isoDate(value: unknown): string | null {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function integer(value: unknown): number | null {
  return Number.isInteger(value) ? (value as number) : null;
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return values.includes(value as T) ? (value as T) : null;
}

/** The object rows of `rows`, or none when it is not an array. */
function rowsOf(rows: unknown): Row[] {
  return Array.isArray(rows)
    ? rows.filter((row): row is Row => !!row && typeof row === 'object' && !Array.isArray(row))
    : [];
}

/** The `keys` DEMI's `undated` object bounds with a `notAfter` day; `undefined` for none. */
function undatedOf<K extends string>(value: unknown, keys: readonly K[]): Undated<K> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = value as Record<string, { notAfter?: unknown } | null | undefined>;
  const undated: Undated<K> = {};
  for (const key of keys) {
    const notAfter = isoDate(entries[key]?.notAfter);
    if (notAfter) undated[key] = notAfter;
  }
  return Object.keys(undated).length ? undated : undefined;
}

function phaseOf(row: Raw<Phase>): Phase | null {
  const name = text(row.name);
  if (!name) return null;
  const phase: Phase = { name, startDate: isoDate(row.startDate), endDate: isoDate(row.endDate) };
  if (typeof row.isCompleted === 'boolean') phase.isCompleted = row.isCompleted;
  const eaActName = text(row.eaActName);
  if (eaActName) phase.eaActName = eaActName;
  const sortOrder = integer(row.sortOrder);
  if (sortOrder !== null) phase.sortOrder = sortOrder;
  return phase;
}

function milestoneOf(row: Raw<Milestone>): Milestone | null {
  const name = text(row.name);
  const position = oneOf(MILESTONE_POSITIONS, row.position);
  if (!name || !position) return null;
  const milestone: Milestone = {
    name,
    position,
    eventType: integer(row.eventType),
    actualDate: isoDate(row.actualDate),
    anticipatedDate: isoDate(row.anticipatedDate),
    outcome: text(row.outcome),
    numberOfDays: integer(row.numberOfDays),
  };
  const undated = undatedOf(row.undated, MILESTONE_DATES);
  if (undated) milestone.undated = undated;
  return milestone;
}

function workOf(row: Raw<Work>): Work | null {
  const trackWorkId = integer(row.trackWorkId);
  const workTypeId = integer(row.workTypeId);
  const workType = text(row.workType);
  const track = trackWorkId !== null && workTypeId !== null;
  const workId = track ? null : text(row.workId);
  const workTypeCode = track ? null : text(row.workTypeCode);
  if (!workType || (!track && (!workId || !workTypeCode))) return null;
  const work: Work = {
    trackWorkId,
    workTypeId,
    workType,
    title: text(row.title),
    eaAct: text(row.eaAct),
    startDate: isoDate(row.startDate),
    isActive: row.isActive === true,
    workState: oneOf(WORK_STATES, row.workState),
    decisionDate: isoDate(row.decisionDate),
    anticipatedDecisionDate: isoDate(row.anticipatedDecisionDate),
    outcome: text(row.outcome),
    phases: parsed(row.phases, phaseOf),
    milestones: parsed(row.milestones, milestoneOf),
  };
  if (workId) work.workId = workId;
  if (workTypeCode) work.workTypeCode = workTypeCode;
  const actYear = integer(row.actYear);
  if (actYear !== null) work.actYear = actYear;
  const undated = undatedOf(row.undated, WORK_DATES);
  if (undated) work.undated = undated;
  return work;
}

function parsed<T>(rows: unknown, parse: (row: Raw<T>) => T | null): T[] {
  return rowsOf(rows).flatMap((row) => parse(row as Raw<T>) ?? []);
}

/**
 * The payload is public JSON from another service, so a row missing a required field drops out,
 * an unknown key is not copied and a non-ISO date reads as null. Rows keep the order DEMI sends.
 */
export function phasesOf(payload: unknown): Phase[] {
  return parsed((payload as { phases?: unknown } | null | undefined)?.phases, phaseOf);
}

/** The `works` of a DEMI project document, parsed as defensively as `phasesOf`. */
export function worksOf(payload: unknown): Work[] {
  return parsed((payload as { works?: unknown } | null | undefined)?.works, workOf);
}

/** The Track work type of an environmental assessment. */
export const ASSESSMENT_WORK_TYPE = 6;

// DEMI's type codes, as Track type ids; DEMI codes Track's types 7 and 16 both as `amendment`.
const WORK_TYPE_IDS = new Map<string, number>([
  ['project-notification', 1],
  ['minister-designation', 2],
  ['ceao-designation', 3],
  ['exemption-order', 5],
  ['assessment', ASSESSMENT_WORK_TYPE],
  ['amendment', 7],
  ['eac-extension', 9],
  ['substantial-start', 10],
  ['transfer', 11],
  ['material-alteration', 15],
]);

/** A work Track holds, as opposed to a sheet work DEMI keys by `workId`. */
export function isTrackWork(work: Pick<Work, 'trackWorkId'>): boolean {
  return work.trackWorkId !== null;
}

/** The Track type id of any work: Track's own, else the id its DEMI type code stands for. */
export function typeIdOf(work: Pick<Work, 'workTypeId' | 'workTypeCode'>): number | null {
  return work.workTypeId ?? WORK_TYPE_IDS.get(work.workTypeCode ?? '') ?? null;
}

/** Eagle writes a blank date as the epoch, so anything before 1971 is no date. */
export const EARLIEST = Date.UTC(1971, 0, 1);

/** The work DEMI names as active, by `workId` first, then `trackWorkId`; `null` when none matches. */
export function activeWorkOf(payload: unknown): Work | null {
  const doc = payload as
    { activeWork?: { workId?: unknown; trackWorkId?: unknown } | null } | null | undefined;
  const workId = text(doc?.activeWork?.workId);
  const trackWorkId = integer(doc?.activeWork?.trackWorkId);
  const works = worksOf(payload);
  return (
    works.find((one) => workId !== null && one.workId === workId) ??
    works.find((one) => trackWorkId !== null && one.trackWorkId === trackWorkId) ??
    null
  );
}

/** The first unfinished phase, in DEMI order; `null` when every phase is complete. */
export function openPhaseOf({ phases }: Pick<Work, 'phases'>): Phase | null {
  return phases.find((one) => one.isCompleted !== true) ?? null;
}

/** The earliest real `startDate` across every Act's assessment phases, `null` when none has one. */
export function firstAssessedOn(payload: unknown): string | null {
  const starts = rowsOf((payload as { assessments?: unknown } | null | undefined)?.assessments)
    .flatMap((assessment) => rowsOf(assessment['phases']))
    .flatMap((phase) => isoDate(phase['startDate']) ?? [])
    .filter((start) => Date.parse(start) >= EARLIEST);
  return starts.reduce<string | null>(
    (first, start) => (first === null || Date.parse(start) < Date.parse(first) ? start : first),
    null,
  );
}

/** The Track project sub-type, `null` when DEMI sent none. */
export function subTypeOf(payload: unknown): string | null {
  return text((payload as { projectSubType?: unknown } | null | undefined)?.projectSubType);
}

/** The raw DEMI project document. `data` is `undefined` while in flight. */
export function useDemiProject(projId: string) {
  return useQuery(demiProjectQueryOptions(projId));
}

// The certificate field also holds status text ("Withdrawn", "In progress", "N/A").
export const CERTIFICATE_NUMBER = /^[A-Z]{1,3}\d{2}-\d{2}$/;

/** A project's EA certificate number, `undefined` while loading or when it has none. */
export function useProjectEaCertificate(projId: string): string | undefined {
  const number = useDemiProject(projId).data?.eaCertificate?.trim() ?? '';
  return CERTIFICATE_NUMBER.test(number) ? number : undefined;
}

/** A project's Track work phases from DEMI, `null` while loading or when absent. */
export function useProjectPhases(projId: string): Phase[] | null {
  const { data } = useQuery({ ...demiProjectQueryOptions(projId), select: phasesOf });
  return data ?? null;
}
