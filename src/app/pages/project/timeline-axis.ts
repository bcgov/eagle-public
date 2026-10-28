import { ACTS } from 'app/utils/legislation';
import { trackPhaseStyle } from './assessment-stages';
import {
  DAY,
  at as time,
  days,
  type PhaseItem,
  type TimelineItem,
  type TimelineModel,
  type WorkItem,
  type WorkStatus,
} from './use-timeline-model';

export { DAY, days, time };

const YEAR = 3.156e10;
/** The closest the lanes zoom in. */
export const MIN_SPAN = 365 * DAY;
export const TEN_YEARS = 3652 * DAY;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  completed: 'Completed',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
  terminated: 'Terminated',
  inProgress: 'In progress',
  suspended: 'Suspended',
};

/** "15 Mar 2027". */
export function dayMonthYear(value: number): string {
  const date = new Date(value);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Mar 2027". */
export function monthYear(value: number): string {
  const date = new Date(value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** The model's Today row; the clock only stands in for a model built without one. */
export function todayOf(model: TimelineModel): number {
  return time(model.items.find((item) => item.kind === 'today')?.start) ?? Date.now();
}

/** Where an open work's bar ends: its planned decision, else Today. */
export function workEnd(work: WorkItem, today: number): number {
  return Math.max(time(work.end) ?? today, time(work.plannedDecision) ?? 0);
}

/** A phase's colour: its stage row's, else Track's, else grey. */
export function phaseFill(item: PhaseItem): string {
  const fill = item.row ?? trackPhaseStyle(item.title);
  return fill ? `var(${fill.token}, ${fill.hex})` : 'var(--theme-gray-60)';
}

export interface Range {
  from: number;
  to: number;
}

/** The whole life: 1 January of the first dated year to the month five months past the last date. */
export function fullRange(model: TimelineModel): Range {
  const today = todayOf(model);
  // The Act band dates the Act, not the project, so it does not stretch the life.
  const dated = model.items.flatMap((item) =>
    item.kind === 'band'
      ? []
      : [
          item.start,
          item.end,
          item.kind === 'work' ? item.plannedDecision : null,
          item.kind === 'substantialStart' ? item.deadline : null,
        ]
          .map(time)
          .filter((value): value is number => value != null),
  );
  const first = new Date(Math.min(today, ...dated));
  const last = new Date(Math.max(today, ...dated) + 150 * DAY);
  return {
    from: Date.UTC(first.getUTCFullYear(), 0, 1),
    to: Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1),
  };
}

/** A zoomed view; `null` is the whole life. */
export interface View {
  center: number;
  span: number;
}

interface Visible extends Range, View {
  zoomed: boolean;
}

/** The visible range: span between a year and the whole life, kept inside the whole life. */
export function visibleRange(full: Range, view: View | null): Visible {
  const whole = full.to - full.from;
  const span = Math.min(whole, Math.max(MIN_SPAN, view?.span ?? whole));
  const center = Math.min(
    full.to - span / 2,
    Math.max(full.from + span / 2, view?.center ?? (full.from + full.to) / 2),
  );
  return {
    from: center - span / 2,
    to: center + span / 2,
    span,
    center,
    zoomed: span < whole - DAY,
  };
}

/** A view pulled back inside the whole life and the zoom limits. */
export function clampView(full: Range, view: View): View {
  const { center, span } = visibleRange(full, view);
  return { center, span };
}

function tickStep(span: number): number {
  const years = span / YEAR;
  if (years > 14) return 60;
  if (years > 7) return 24;
  if (years > 2.5) return 12;
  if (years > 1.2) return 3;
  return 1;
}

interface Tick {
  time: number;
  label: string;
  /** January ticks name the year. */
  year: boolean;
}

/** Ticks on month starts every 1, 3, 12, 24 or 60 months by span, leaving room for Today. */
export function axisTicks(range: Range, today: number): Tick[] {
  const span = range.to - range.from;
  const step = tickStep(span);
  const start = new Date(range.from);
  const ticks: Tick[] = [];
  const first = Math.ceil((start.getUTCFullYear() * 12 + start.getUTCMonth()) / step) * step;
  for (let month = first; ; month += step) {
    const year = Math.floor(month / 12);
    const value = Date.UTC(year, month % 12, 1);
    if (value >= range.to) break;
    if (value < range.from || Math.abs(value - today) <= span * 0.04) continue;
    ticks.push({
      time: value,
      label: month % 12 ? MONTHS[month % 12] : String(year),
      year: !(month % 12),
    });
  }
  return ticks;
}

/** Stacks overlapping works into rows: each work takes the first row free by its start. */
export function packRows(works: WorkItem[], today: number): { work: WorkItem; row: number }[] {
  const ends: number[] = [];
  return works.map((work) => {
    const start = time(work.start) ?? today;
    let row = ends.findIndex((end) => end < start);
    if (row < 0) row = ends.length;
    ends[row] = workEnd(work, today);
    return { work, row };
  });
}

function searchText(item: TimelineItem): string {
  const dates = [item.start, item.end]
    .map(time)
    .flatMap((value) => (value == null ? [] : [dayMonthYear(value)]));
  return [
    item.title,
    item.actYear ? `${item.actYear} Act` : '',
    item.kind === 'work' ? `${item.workType} ${WORK_STATUS_LABELS[item.status]}` : '',
    item.kind === 'document' ? item.displayName : '',
    item.kind === 'phase' && item.status === 'undated' ? 'Not dated' : '',
    ...dates,
  ]
    .join(' ')
    .toLowerCase();
}

/** Ids of the items a query matches, in list order; none until 2 characters are typed. */
export function timelineHits(model: TimelineModel, query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  return model.items.filter((item) => searchText(item).includes(needle)).map((item) => item.id);
}

/** The span an undated phase or a collapsed history row is hatched across, if its range is known. */
export function hatchRange(item: TimelineItem): [number, number] | null {
  const undated = item.kind === 'history' || (item.kind === 'phase' && item.status === 'undated');
  if (!undated || item.parentId) return null;
  const lo = time(item.knownRange?.from);
  const hi = time(item.knownRange?.to);
  return lo != null && hi != null && hi > lo ? [lo, hi] : null;
}

/**
 * The key: only the marks this project draws, as [swatch, label]. The strip draws no milestones,
 * proponent time, planned decisions or Act lines.
 */
export function legendOf(
  model: TimelineModel,
  chart: 'lanes' | 'strip',
  full: Range,
): [string, string][] {
  const lanes = chart === 'lanes';
  const plannedDecisions = model.items.some(
    (item) => item.kind === 'work' && time(item.plannedDecision) != null,
  );
  const statuses = new Set(
    model.items.flatMap((item) => (item.kind === 'work' ? [item.status] : [])),
  );
  const has = (kind: TimelineItem['kind']) => model.items.some((item) => item.kind === kind);
  return [
    model.items.some((item) => hatchRange(item)) && ['undated', 'Not dated'],
    plannedDecisions && ['planned', 'Planned, to the planned decision'],
    lanes && plannedDecisions && ['planned-decision', 'Planned decision'],
    lanes && has('milestone') && ['milestone', 'Milestone'],
    model.transitions.some((one) => one.between?.from && one.between.to) && [
      'transition',
      'Transition happened in here',
    ],
    has('document') && ['document', 'Amendment document'],
    ...(Object.keys(WORK_STATUS_LABELS) as WorkStatus[]).map(
      (status) => statuses.has(status) && [`work--${status}`, WORK_STATUS_LABELS[status]],
    ),
    has('substantialStart') && ['decided', 'Substantial start (deadline hollow)'],
    lanes && has('proponent') && ['proponent', 'Proponent time'],
    model.items.some((item) => item.kind === 'certificate' && item.outcome === 'issued') && [
      'after-certificate',
      'After the certificate',
    ],
    lanes &&
      ACTS.slice(1).some((act) => {
        const at = time(act.inForce);
        return at != null && at > full.from && at < full.to;
      }) && ['boundary', 'Act came into force'],
    ['today', 'Today'],
  ].filter((entry): entry is [string, string] => !!entry);
}
