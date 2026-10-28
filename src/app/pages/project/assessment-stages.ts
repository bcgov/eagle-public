import type { Phase } from 'app/api/project-phases';
import type { Project } from 'app/models/project';
import { DEFAULT_ACT, actByYear, actFor } from 'app/utils/legislation';

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
  /** The range under its name, from the DEMI project's `phases`. */
  dates?: string;
}

/** `List` rows of type `projectPhase`, as the project shell fetches them. */
export interface PhaseListItem {
  id: string;
  type?: string;
  name: string;
  listOrder?: number;
  legislation?: number;
}

const FILLS = {
  earlyEngagement: { token: '--eao-early-engagement-dark', hex: '#54858d' },
  readinessDecision: { token: '--eao-readiness-decision-dark', hex: '#da6d65' },
  processPlanning: { token: '--eao-process-planning-dark', hex: '#043673' },
  applicationDevelopment: { token: '--eao-application-development-dark', hex: '#4d95d0' },
  effectsAssessment: { token: '--eao-effects-assessment-dark', hex: '#e7a913' },
  decision: { token: '--eao-decision-dark', hex: '#6a54a3' },
  amendment: { token: '--eao-amendment-dark', hex: '#a6bb2e' },
  preEac: { token: '--eao-pre-eac-dark', hex: '#3eb1d7' },
  proponent: { token: '--eao-proponent-dark', hex: '#6d7274' },
};

interface Fill {
  token: string;
  hex: string;
}

/** The Track 2018 stages, numbered as `PHASE_STAGES` gives them, that run on the proponent's clock. */
const PROPONENT_STAGES = [2, 5, 7];

/** The collapsed tail of the Simplified rail. */
const POST_DECISION = 'Post decision';

/** Phases that sit outside the process: kept off the rail, named in a caption instead. */
const OFF_RAIL_PHASES = ['Other', 'Termination', 'Withdrawal'];

const SIMPLE_FILLS: Record<string, Fill> = {
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
 * wins because 2002 Act projects can end up in the 2018 "Complete" phase; an Act with no rows
 * of its own uses its `phaseRowsYear` set.
 */
export function phaseSetYear(project: Project | null): number {
  const year =
    Number(project?.currentPhaseName?.legislation) || actYear(project) || DEFAULT_ACT.year;
  return actByYear(year)?.phaseRowsYear ?? year;
}

/** The year of the Act the project was assessed under; NaN when the registry holds no such Act. */
export function actYear(project: Project | null): number {
  return actFor(project?.legislation)?.year ?? NaN;
}

/** Termination, Withdrawal and Other end or leave the process; they are not phases of it. */
export function isOffRail(name: string): boolean {
  return OFF_RAIL_PHASES.includes(name);
}

/** The current phase when it sits off the rail, so the rail can say so. */
export function offRailPhase(project: Project | null): string | null {
  const name = String(project?.currentPhaseName?.name ?? '');
  return isOffRail(name) ? name : null;
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
        row.type === 'projectPhase' && Number(row.legislation) === year && !isOffRail(row.name),
    )
    .sort((a, b) => (a.listOrder ?? 0) - (b.listOrder ?? 0));

  const groups: { ids: string[]; name: string }[] = [];
  for (const row of rows) {
    const group = isPostDecision(row.name)
      ? groups.find((g) => g.name === POST_DECISION)
      : undefined;
    if (group) {
      group.ids.push(row.id);
    } else {
      groups.push({ ids: [row.id], name: isPostDecision(row.name) ? POST_DECISION : row.name });
    }
  }

  // The project's populated ref keeps the Eagle `_id`, which is the `List` row's `id`.
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

function stagesOf({ name }: Pick<Phase, 'name'>): number[] {
  return PHASE_STAGES.get(normalizeName(name)) ?? [];
}

/** The Track stage numbers a simplified stage covers. */
function stageNumbersFor(stage: RailStage): number[] {
  const phase = DETAILED_PHASES.indexOf(stage.name);
  return STAGE_PHASE.flatMap((index, order) => (index === phase ? [order + 1] : []));
}

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
 * Fills each stage's date range from the DEMI project's `phases`. A stage no phase matches is
 * returned as it was.
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
    return dates ? { ...stage, dates } : stage;
  });
}

/** One phase of an Act as the timeline draws it, with the steps it holds. */
export interface StageRow extends Fill {
  name: string;
  steps: readonly string[];
}

export const POST_DECISION_ROW = 'Post Decision';

const POST_DECISION_STEPS = ['Post Decision Work and Amendments'];

/** Step counts of the four 1996 phases, in `stepNames` order. */
const STEPS_PER_1996_PHASE = [2, 1, 2, 1];
const FILLS_1996 = [FILLS.preEac, FILLS.applicationDevelopment, FILLS.decision, FILLS.amendment];

function rows1996(): StageRow[] {
  const act = actByYear(1996);
  const steps = act?.stepNames ?? [];
  let at = 0;
  return (act?.phaseNames ?? []).map((name, index) => {
    const count = STEPS_PER_1996_PHASE[index] ?? 0;
    at += count;
    return { name, steps: steps.slice(at - count, at), ...FILLS_1996[index] };
  });
}

/**
 * Each Act's phases and steps, in order. Track dates "Effects Assessment & Recommendation" and
 * "EAC Decision" as one phase each, so the 2018 set merges those design rows to match.
 */
const STAGE_SETS: Record<number, StageRow[]> = {
  1996: rows1996(),
  2002: [
    { name: 'Pre-EA', steps: ['s.10(1)(c) Determination'], ...FILLS.preEac },
    {
      name: 'Pre-Application',
      steps: ['S.11 Order', 'Application Information Requirements Accepted'],
      ...FILLS.processPlanning,
    },
    { name: 'Evaluation', steps: ['Application Evaluation'], ...FILLS.readinessDecision },
    {
      name: 'Application Review',
      steps: ['Application Review'],
      ...FILLS.applicationDevelopment,
    },
    {
      name: 'Referral',
      steps: [
        'Application Referral',
        'EAC Decision (Issued, Refused, or Further Assessment Required)',
      ],
      ...FILLS.decision,
    },
    { name: POST_DECISION_ROW, steps: POST_DECISION_STEPS, ...FILLS.amendment },
  ],
  2018: [
    {
      name: 'Early Engagement',
      steps: ['Initial Project Description and Engagement Plan'],
      ...FILLS.earlyEngagement,
    },
    {
      name: 'Readiness Decision',
      steps: [
        'Detailed Project Description',
        'Recommendation (to proceed, for a revised Detailed PD, for exemption, or for termination)',
      ],
      ...FILLS.readinessDecision,
    },
    { name: 'Process Planning', steps: ['Process Order'], ...FILLS.processPlanning },
    {
      name: 'Application Development and Review',
      steps: ['Application'],
      ...FILLS.applicationDevelopment,
    },
    {
      name: 'Effects Assessment and Recommendation',
      steps: [
        'Revised Application',
        'Assessment Report (or Exemption Report or Termination Report)',
      ],
      ...FILLS.effectsAssessment,
    },
    {
      name: 'Referral and Decision',
      steps: [
        'Referral',
        'Decision (Certificate Issued or Exemption Issued; Certificate Denied or Terminated)',
      ],
      ...FILLS.decision,
    },
    { name: POST_DECISION_ROW, steps: POST_DECISION_STEPS, ...FILLS.amendment },
  ],
};

/** Stored phase names that differ from the row they belong to, per Act. */
const ROW_ALIASES: Record<number, Record<string, string>> = {
  // Eagle stores the 2002 names on 1996 projects.
  1996: { 'Pre-EA': 'Pre-Application', Evaluation: 'Application Review' },
  2002: {},
  2018: {
    'EAC Application Review': 'Application Development and Review',
    'Effects Assessment & Recommendation': 'Effects Assessment and Recommendation',
    'Effects Assessment': 'Effects Assessment and Recommendation',
    'EAC Decision': 'Referral and Decision',
    Referral: 'Referral and Decision',
  },
};

/** The phases and steps of the Act of `actYear`, in order; none for an Act with no set. */
export function stageSetFor(actYear: number): readonly StageRow[] {
  return STAGE_SETS[actYear] ?? [];
}

/** The row of the `actYear` set a stored Eagle or Track phase name belongs to, or null. */
export function stageRowFor(actYear: number, name: string): StageRow | null {
  const aliases = new Map(
    Object.entries(ROW_ALIASES[actYear] ?? {}).map(([from, to]) => [normalizeName(from), to]),
  );
  const rowName = isPostDecision(name)
    ? POST_DECISION_ROW
    : (aliases.get(normalizeName(name)) ?? name);
  return (
    stageSetFor(actYear).find((row) => normalizeName(row.name) === normalizeName(rowName)) ?? null
  );
}

export interface PhaseStyle extends Fill {
  owner: 'eao' | 'proponent';
}

/** Fill and clock owner of a Track phase: proponent time is grey, EAO phases take their row's fill. */
export function trackPhaseStyle(name: string): PhaseStyle | null {
  const stage = stagesOf({ name })[0];
  if (stage === undefined) return null;
  if (PROPONENT_STAGES.includes(stage)) return { owner: 'proponent', ...FILLS.proponent };
  const row = stageRowFor(2018, name);
  return row && { owner: 'eao', token: row.token, hex: row.hex };
}
