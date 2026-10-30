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

/** One Track event of a work. `outcome` is the Track outcome name. */
export interface Milestone {
  name: string;
  position: MilestonePosition;
  /** The Track event type id. */
  eventType: number | null;
  actualDate: string | null;
  anticipatedDate: string | null;
  outcome: string | null;
  numberOfDays: number | null;
}

/** One Track work, as DEMI mirrors it onto the project document's `works`. */
export interface Work {
  trackWorkId: number;
  workTypeId: number;
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
  return {
    name,
    position,
    eventType: integer(row.eventType),
    actualDate: isoDate(row.actualDate),
    anticipatedDate: isoDate(row.anticipatedDate),
    outcome: text(row.outcome),
    numberOfDays: integer(row.numberOfDays),
  };
}

function workOf(row: Raw<Work>): Work | null {
  const trackWorkId = integer(row.trackWorkId);
  const workTypeId = integer(row.workTypeId);
  const workType = text(row.workType);
  if (trackWorkId === null || workTypeId === null || !workType) return null;
  return {
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

/** Eagle writes a blank date as the epoch, so anything before 1971 is no date. */
export const EARLIEST = Date.UTC(1971, 0, 1);

/** The work DEMI names as active, `null` when it names none or its id matches no work. */
export function activeWorkOf(payload: unknown): Work | null {
  const doc = payload as { activeWork?: { trackWorkId?: unknown } | null } | null | undefined;
  const trackWorkId = integer(doc?.activeWork?.trackWorkId);
  if (trackWorkId === null) return null;
  return worksOf(payload).find((one) => one.trackWorkId === trackWorkId) ?? null;
}

/** A work's first unfinished phase, in DEMI order; `null` when every phase is complete. */
export function openPhaseOf(work: Work): Phase | null {
  return work.phases.find((one) => one.isCompleted !== true) ?? null;
}

/**
 * The active work's first unfinished phase, in DEMI order, when that work is an assessment.
 * `null` when there is no active work, it is another work type, or every phase is complete.
 */
export function currentWorkPhaseOf(payload: unknown): { work: Work; phase: Phase } | null {
  const work = activeWorkOf(payload);
  if (work?.workTypeId !== ASSESSMENT_WORK_TYPE) return null;
  const phase = openPhaseOf(work);
  return phase ? { work, phase } : null;
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

/** A project's EA certificate number, `undefined` while loading or when it has none. */
export function useProjectEaCertificate(projId: string): string | undefined {
  return useDemiProject(projId).data?.eaCertificate?.trim() || undefined;
}

/** A project's Track work phases from DEMI, `null` while loading or when absent. */
export function useProjectPhases(projId: string): Phase[] | null {
  const { data } = useQuery({ ...demiProjectQueryOptions(projId), select: phasesOf });
  return data ?? null;
}
