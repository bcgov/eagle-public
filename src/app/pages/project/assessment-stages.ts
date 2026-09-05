import type { Phase } from 'app/api/project-phases';
import type { Project } from 'app/models/project';

/**
 * Stage data for the assessment progress rail. Hex values mirror
 * `src/assets/styles/themes/eao-tokens.css` so components can render
 * `var(--token, #hex)` and still look right before the token sheet loads.
 */
export interface RailStage {
  /** One stage may cover several `List` rows; then this holds every id, space separated. */
  id: string;
  n: number;
  name: string;
  hex: string;
  token: string;
  state: 'done' | 'current' | 'upcoming';
  statutoryDays?: number;
  /** How long the stage ran, and the range under its name: both from the DEMI project's `phases`. */
  elapsedDays?: number;
  dates?: string;
  owner?: 'eao' | 'proponent';
  provisional?: boolean;
}

/** A stage placed on the to-scale bar: percentages of the whole timeline. */
export interface LaidStage extends RailStage {
  start: number;
  width: number;
  days: number;
}

/** `List` rows of type `projectPhase`, as the project shell fetches them. */
export interface PhaseListItem {
  _id: string;
  type?: string;
  name: string;
  listOrder?: number;
  legislation?: number;
}

export interface YearTick {
  label: string;
  left: number;
}

/** Internal annotation: stage definitions 2, 5 and 7 are pending Comms ratification. */
export const SHOW_RATIFICATION_STRIPES = true as boolean;

export const RAIL_DEFAULT_VIEW: 'simple' | 'detailed' = 'simple';

const FILLS = {
  earlyEngagement: { token: '--eao-early-engagement-dark', hex: '#54858d' },
  readinessDecision: { token: '--eao-readiness-decision-dark', hex: '#da6d65' },
  readinessDecisionMain: { token: '--eao-readiness-decision-main', hex: '#edb6b2' },
  processPlanning: { token: '--eao-process-planning-dark', hex: '#043673' },
  applicationDevelopment: { token: '--eao-application-development-dark', hex: '#4d95d0' },
  applicationDevelopmentTime: { token: '--eao-application-development-time', hex: '#3c6e47' },
  effectsAssessment: { token: '--eao-effects-assessment-dark', hex: '#e7a913' },
  effectsAssessmentMain: { token: '--eao-effects-assessment-main', hex: '#f3d489' },
  decision: { token: '--eao-decision-dark', hex: '#6a54a3' },
  amendment: { token: '--eao-amendment-dark', hex: '#a6bb2e' },
  preEac: { token: '--eao-pre-eac-dark', hex: '#3eb1d7' },
  proponent: { token: '--eao-proponent-dark', hex: '#6d7274' },
};

/** The 2018 Act stages as Track seeds them, so a Track-fed timeline maps one to one. */
const TRACK_STAGES: Omit<RailStage, 'id' | 'n' | 'state'>[] = [
  { name: 'Early Engagement', statutoryDays: 90, owner: 'eao', ...FILLS.earlyEngagement },
  {
    name: 'Proponent time: project description',
    statutoryDays: 365,
    owner: 'proponent',
    provisional: true,
    ...FILLS.proponent,
  },
  { name: 'Readiness Decision', statutoryDays: 60, owner: 'eao', ...FILLS.readinessDecision },
  { name: 'Process Planning', statutoryDays: 120, owner: 'eao', ...FILLS.processPlanning },
  {
    name: 'Proponent time: application development',
    statutoryDays: 1095,
    owner: 'proponent',
    provisional: true,
    ...FILLS.applicationDevelopmentTime,
  },
  {
    name: 'Application Development and Review',
    statutoryDays: 180,
    owner: 'eao',
    ...FILLS.preEac,
  },
  {
    name: 'Proponent time: revised application',
    statutoryDays: 365,
    owner: 'proponent',
    provisional: true,
    ...FILLS.readinessDecisionMain,
  },
  { name: 'Effects Assessment', statutoryDays: 110, owner: 'eao', ...FILLS.effectsAssessment },
  { name: 'Recommendation', statutoryDays: 40, owner: 'eao', ...FILLS.effectsAssessmentMain },
  { name: 'Referral / Decision', statutoryDays: 30, owner: 'eao', ...FILLS.decision },
];

const DETAILED_ID = 'detailed-';

export const DETAILED_STAGES: RailStage[] = TRACK_STAGES.map((stage, index) => ({
  ...stage,
  id: `${DETAILED_ID}${index + 1}`,
  n: index + 1,
  state: 'upcoming',
}));

/** Off-scale: an amendment has no legislated duration, so it never enters the bar or the totals. */
export const AMENDMENT_STAGE: RailStage = {
  id: 'amendment',
  n: DETAILED_STAGES.length + 1,
  name: 'Amendment',
  state: 'current',
  ...FILLS.amendment,
};

export const TOTAL_DAYS = DETAILED_STAGES.reduce((sum, s) => sum + (s.statutoryDays ?? 0), 0);

export const EAO_DAYS = DETAILED_STAGES.filter((s) => s.owner === 'eao').reduce(
  (sum, s) => sum + (s.statutoryDays ?? 0),
  0,
);

export const YEAR_TICKS: YearTick[] = [0, 1, 2, 3, 4, 5, 6].map((year) => ({
  label: year === 0 ? 'Start' : `${year}y`,
  left: ((year * 365) / TOTAL_DAYS) * 100,
}));

/** The collapsed tail of the Simplified rail. */
const POST_DECISION = 'Post decision';

/** Phases that sit outside the process: kept off the rail, named in a caption instead. */
const OFF_RAIL_PHASES = ['Other', 'Termination', 'Withdrawal'];

const SIMPLE_FILLS: Record<string, { token: string; hex: string }> = {
  'Project Designation': FILLS.proponent,
  'Early Engagement': FILLS.earlyEngagement,
  'Readiness Decision': FILLS.readinessDecision,
  'Process Planning': FILLS.processPlanning,
  'Application Development and Review': FILLS.applicationDevelopment,
  'Effects Assessment': FILLS.effectsAssessment,
  Referral: FILLS.decision,
  [POST_DECISION]: FILLS.amendment,
};

/** Fallback fills for the 2002 phase names, which have no colour of their own. */
const PALETTE = [
  FILLS.earlyEngagement,
  FILLS.readinessDecision,
  FILLS.processPlanning,
  FILLS.applicationDevelopment,
  FILLS.effectsAssessment,
  FILLS.decision,
  FILLS.preEac,
  FILLS.proponent,
];

/** The 2018 phases the ten Track stages roll up into, in list order. */
const DETAILED_PHASES = [
  'Early Engagement',
  'Readiness Decision',
  'Process Planning',
  'Application Development and Review',
  'Effects Assessment',
  'Referral',
];

/** Index into `DETAILED_PHASES` for each of the ten stages. */
const STAGE_PHASE = [0, 0, 1, 2, 3, 3, 3, 4, 4, 5];

function isPostDecision(name: string): boolean {
  return name.startsWith('Post Decision') || name === 'Complete';
}

/**
 * Which set of `projectPhase` rows the project sits in. The phase row's own `legislation`
 * wins because 2002 Act projects can end up in the 2018 "Complete" phase; 1996 Act projects
 * have no rows of their own and use the 2002 set.
 */
export function phaseSetYear(project: Project | null): number {
  const year = Number(project?.currentPhaseName?.legislation) || actYear(project) || 2018;
  return year === 1996 ? 2002 : year;
}

/** The Act the project was assessed under, from its `legislation` string. */
export function actYear(project: Project | null): number {
  return Number(String(project?.legislation ?? '').match(/\d{4}/)?.[0]);
}

/** The current phase when it sits off the rail, so the rail can say so. */
export function offRailPhase(project: Project | null): string | null {
  const name = String(project?.currentPhaseName?.name ?? '');
  return OFF_RAIL_PHASES.includes(name) ? name : null;
}

function stateFor(index: number, currentIndex: number): RailStage['state'] {
  if (currentIndex < 0 || index > currentIndex) return 'upcoming';
  return index === currentIndex ? 'current' : 'done';
}

/** The familiar rail: one stage per `projectPhase` list row, post-decision phases collapsed. */
export function simplifiedStages(
  lists: PhaseListItem[] | null | undefined,
  project: Project | null,
): RailStage[] {
  const year = phaseSetYear(project);
  const rows = (lists ?? [])
    .filter(
      (row) =>
        row.type === 'projectPhase' &&
        Number(row.legislation) === year &&
        !OFF_RAIL_PHASES.includes(row.name),
    )
    .sort((a, b) => (a.listOrder ?? 0) - (b.listOrder ?? 0));

  const groups: { ids: string[]; name: string }[] = [];
  for (const row of rows) {
    const group = isPostDecision(row.name)
      ? groups.find((g) => g.name === POST_DECISION)
      : undefined;
    if (group) {
      group.ids.push(row._id);
    } else {
      groups.push({ ids: [row._id], name: isPostDecision(row.name) ? POST_DECISION : row.name });
    }
  }

  const currentId = project?.currentPhaseName?._id;
  const currentIndex = groups.findIndex((g) => !!currentId && g.ids.includes(currentId));

  return groups.map((group, index) => ({
    id: group.ids.join(' '),
    n: index + 1,
    name: group.name,
    state: stateFor(index, currentIndex),
    ...(SIMPLE_FILLS[group.name] ?? PALETTE[index % PALETTE.length]),
  }));
}

/** The ten Track 2018 stages, with each one's state read off the project's current phase. */
export function detailedStages(project: Project | null): RailStage[] {
  const phase = String(project?.currentPhaseName?.name ?? '');

  if (isPostDecision(phase)) {
    return DETAILED_STAGES.map((stage) => ({ ...stage, state: 'done' as const }));
  }
  // Project Designation comes before stage 1, and the off-rail phases leave the process.
  if (!DETAILED_PHASES.includes(phase)) {
    return DETAILED_STAGES.map((stage) => ({ ...stage, state: 'upcoming' as const }));
  }

  const currentIndex = DETAILED_PHASES.indexOf(phase);
  return DETAILED_STAGES.map((stage, index) => ({
    ...stage,
    state: stateFor(STAGE_PHASE[index], currentIndex),
  }));
}

/** Folds case, punctuation and `&` against `and`, so the table below reads as Track writes it. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The Track phase names DEMI sends, and the detailed stage numbers each one dates. Two phases can
 * date one stage, one phase can date two, and a name missing here is ignored.
 */
const PHASE_STAGES = new Map<string, number[]>(
  Object.entries({
    'Early Engagement': [1],
    'DPD Development (Proponent Time)': [2],
    'Revised DPD Development (Proponent Time)': [2],
    'Readiness Decision': [3],
    'Process Planning': [4],
    'EAC Application Development (Proponent Time)': [5],
    'EAC Application Review': [6],
    'Revised EAC Application Development (Proponent Time)': [7],
    'Effects Assessment & Recommendation': [8, 9],
    'EAC Decision': [10],
  }).map(([name, stages]) => [normalizeName(name), stages]),
);

function stagesOf(phase: Phase): number[] {
  return PHASE_STAGES.get(normalizeName(phase.name)) ?? [];
}

/** A detailed stage is one number; a simplified one covers every stage that rolls into it. */
function stageNumbersFor(stage: RailStage): number[] {
  if (stage.id.startsWith(DETAILED_ID)) return [stage.n];
  const phase = DETAILED_PHASES.indexOf(stage.name);
  return STAGE_PHASE.flatMap((index, order) => (index === phase ? [order + 1] : []));
}

function statutoryDays(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + (DETAILED_STAGES[n - 1]?.statutoryDays ?? 0), 0);
}

/** A phase feeding two stages splits its length between them in proportion to statutory days. */
function elapsedShare(matched: Phase[], numbers: number[]): number {
  const spanned = [...new Set(matched.flatMap(stagesOf))];
  const total = statutoryDays(spanned);
  return total ? statutoryDays(spanned.filter((n) => numbers.includes(n))) / total : 1;
}

const DAY = 24 * 60 * 60 * 1000;

/** UTC throughout: Track sends midnight dates, and a local zone slides them into another month. */
const UTC = { timeZone: 'UTC' } as const;
const MONTH_YEAR = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric', ...UTC });
const MONTH = new Intl.DateTimeFormat('en-CA', { month: 'short', ...UTC });

function time(iso: string | null): number | null {
  const at = iso ? new Date(iso).getTime() : NaN;
  return isNaN(at) ? null : at;
}

function dateLabel(start: number | null, end: number | null): string {
  if (start == null) return end == null ? '' : MONTH_YEAR.format(end);
  if (end == null) return `Since ${MONTH_YEAR.format(start)}`;

  const from = MONTH_YEAR.format(start);
  const to = MONTH_YEAR.format(end);
  if (from === to) return from;
  // Within one year the design drops the repeated year: "Feb – Dec 2020".
  const sameYear = new Date(start).getUTCFullYear() === new Date(end).getUTCFullYear();
  return `${sameYear ? MONTH.format(start) : from} – ${to}`;
}

/**
 * Fills each stage's date range, and for a finished stage how long it really took, from the DEMI
 * project's `phases`. A stage no phase matches keeps the statutory width `layout()` gives it.
 */
export function withPhaseDates(stages: RailStage[], phases: Phase[] | null): RailStage[] {
  if (!phases?.length) return stages;

  return stages.map((stage) => {
    const numbers = stageNumbersFor(stage);
    const matched = phases.filter((phase) => stagesOf(phase).some((n) => numbers.includes(n)));
    if (!matched.length) return stage;

    const starts = matched.map((p) => time(p.startDate)).filter((at): at is number => at != null);
    const ends = matched.map((p) => time(p.endDate)).filter((at): at is number => at != null);
    const start = starts.length ? Math.min(...starts) : null;
    // A stage is over only when every phase in it is: one open phase leaves the stage open.
    const end = ends.length === matched.length ? Math.max(...ends) : null;

    const dates = dateLabel(start, end);
    if (!dates) return stage;

    const elapsedDays =
      start != null && end != null
        ? Math.round(((end - start) / DAY) * elapsedShare(matched, numbers))
        : 0;
    return {
      ...stage,
      dates,
      ...(stage.state === 'done' && elapsedDays > 0 ? { elapsedDays } : {}),
    };
  });
}

/** Historic stages scale to how long they took; current and future show the statutory maximum. */
function daysFor(stage: RailStage): number {
  if (stage.state === 'done' && stage.elapsedDays != null) return stage.elapsedDays;
  return stage.statutoryDays ?? 0;
}

export function layout(stages: RailStage[]): LaidStage[] {
  const days = stages.map(daysFor);
  const total = days.reduce((sum, d) => sum + d, 0) || 1;
  let start = 0;
  return stages.map((stage, index) => {
    const laid: LaidStage = {
      ...stage,
      days: days[index],
      start: (start / total) * 100,
      width: (days[index] / total) * 100,
    };
    start += days[index];
    return laid;
  });
}

export function durationLabel(days: number): string {
  if (days > 0 && days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1 year' : `${years} years`;
  }
  return `${days} days`;
}
