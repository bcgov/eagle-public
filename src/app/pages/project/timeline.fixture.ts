import { vi } from 'vitest';
import type { DemiProject, ListRef } from 'app/api/api';
import { NARROW } from './timeline-list';
import type { AmendmentDocument, CommentPeriodSpan, TimelineDocument } from './use-timeline-model';

export const TODAY = new Date('2026-10-26T19:00:00.000Z');

/** Makes the narrow-screen query match; undo with `vi.unstubAllGlobals()`. */
export function narrowViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: media === NARROW,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

const ACT_2018 = '2018 Environmental Assessment Act';
const ACT_2002 = '2002 Environmental Assessment Act';
const ACT_1996 = '1996 Environmental Assessment Act';

function ref(name: string, type: string, legislation: number) {
  return { _id: `${type}-${legislation}-${name}`, name, type, legislation };
}

const phaseRefs = (legislation: number, ...names: string[]) =>
  names.map((name) => ref(name, 'projectPhase', legislation));

/** The `projectPhase` List rows, as the lists read answers them. */
export const phaseList = (legislation: number, ...names: string[]): ListRef[] =>
  phaseRefs(legislation, ...names).map(({ _id, ...row }) => ({ id: _id, ...row }));

/** `count` documents filed under one phase, posted evenly from `from` to `to`. */
export function phaseDocuments(
  legislation: number,
  name: string,
  count: number,
  from: string,
  to: string,
): TimelineDocument[] {
  const start = Date.parse(`${from}T08:00:00.000Z`);
  const step = count > 1 ? (Date.parse(`${to}T08:00:00.000Z`) - start) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    _id: `doc-${legislation}-${name}-${from}-${i}`,
    displayName: `${name} document ${i + 1}`,
    phase: ref(name, 'projectPhase', legislation)._id,
    type: null,
    milestone: null,
    datePosted: new Date(start + step * i).toISOString(),
  }));
}

function phase(name: string, startDate: string, endDate: string, isCompleted = true) {
  return {
    name,
    eaActName: 'EA Act (2018)',
    startDate: `${startDate}T09:00:00.000Z`,
    endDate: `${endDate}T09:00:00.000Z`,
    isCompleted,
  };
}

type MilestoneRow = Record<string, unknown>;

export function milestone(
  name: string,
  dates: { actual?: string; anticipated?: string },
  position = 'INTERMEDIATE',
  outcome: string | null = null,
): MilestoneRow {
  return {
    name,
    position,
    eventType: null,
    actualDate: dates.actual ?? null,
    anticipatedDate: dates.anticipated ?? null,
    outcome,
    numberOfDays: null,
  };
}

let nextWorkId = 100;

/** A Track work row as DEMI sends it; `phases` and `milestones` default to none. */
export function work(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    trackWorkId: nextWorkId++,
    workTypeId: 7,
    workType: 'Amendment',
    title: null,
    eaAct: ACT_2018,
    startDate: null,
    isActive: false,
    workState: 'COMPLETED',
    decisionDate: null,
    anticipatedDecisionDate: null,
    outcome: null,
    phases: [],
    milestones: [],
    ...fields,
  };
}

/** The 2018 Act Track phases of one finished assessment, in Track's names. */
const CEDAR_PHASES = [
  phase('Early Engagement', '2020-08-04', '2021-01-29'),
  phase('DPD Development (Proponent Time)', '2021-01-30', '2021-08-02'),
  phase('Readiness Decision', '2021-08-03', '2021-08-31'),
  phase('Process Planning', '2021-09-07', '2021-11-26'),
  phase('EAC Application Development (Proponent Time)', '2021-11-27', '2022-08-01'),
  phase('EAC Application Review', '2022-08-02', '2022-09-30'),
  phase('Effects Assessment & Recommendation', '2023-01-09', '2023-02-20'),
  phase('EAC Decision', '2023-02-21', '2023-03-14'),
];

/** Cedar LNG: 2018 Act only, certified, three amendments in Track, the last still open. */
export const CEDAR: DemiProject = {
  name: 'Cedar LNG',
  legislation: ACT_2018,
  legislationYearList: [2018],
  currentLegislationYear: 'legislation_2018',
  legislation_2018: { legislation: ACT_2018 },
  eacDecision: ref('In Progress', 'eaDecisions', 2018),
  eaCertificate: 'E23-01',
  eacSigned: '2023-03-14T07:00:00.000Z',
  eacExpires: '2028-03-14T07:00:00.000Z',
  projectState: 'Construction',
  phases: CEDAR_PHASES,
  works: [
    work({
      title: 'Amendment #1',
      startDate: '2023-09-11',
      decisionDate: '2024-01-22',
      outcome: 'Approved',
      milestones: [
        milestone('Application received', { actual: '2023-09-11' }, 'START'),
        milestone('Decision', { actual: '2024-01-22' }, 'END', 'Approved'),
      ],
    }),
    work({
      title: 'Amendment #2',
      startDate: '2024-06-03',
      decisionDate: '2024-08-26',
      outcome: 'Approved',
    }),
    work({
      title: 'Amendment #3',
      startDate: '2025-10-06',
      isActive: true,
      workState: 'IN_PROGRESS',
      anticipatedDecisionDate: '2027-06-01',
      milestones: [
        milestone('Application received', { actual: '2025-10-06' }, 'START'),
        milestone('Information requirements set', { actual: '2025-11-17' }),
        milestone('Public comment', {}),
        milestone('Referral', { anticipated: '2026-12-07' }),
        milestone('Decision', { anticipated: '2027-03-15' }, 'END'),
      ],
    }),
  ],
};

const IN_PROGRESS_2018 = ref('In Progress', 'eaDecisions', 2018);
const AD_AND_R = ref('Application Development and Review', 'projectPhase', 2018);

/** Cariboo Gold Project (id 45) as DEMI serves it: 2002 → 2018, Track certified, Eagle not. */
export const TRANSITIONED: DemiProject = {
  name: 'Cariboo Gold Project',
  legislation: ACT_2018,
  legislationYearList: [2002, 2018],
  currentLegislationYear: 'legislation_2018',
  eacDecision: IN_PROGRESS_2018,
  currentPhaseName: AD_AND_R,
  phaseHistory: phaseRefs(
    2018,
    'Early Engagement',
    'Process Planning',
    'Application Development and Review',
  ),
  projectState: 'Application Development & Review',
  eaCertificate: 'M23-01',
  decisionDate: undefined,
  legislation_2002: {
    legislation: ACT_2002,
    decisionDate: '1969-12-31T08:00:00.000Z',
    phaseHistory: phaseRefs(2002, 'Pre-EA', 'Pre-Application'),
    currentPhaseName: ref('Pre-Application', 'projectPhase', 2002),
    eacDecision: ref('In Progress', 'eaDecisions', 2002),
  },
  legislation_2018: {
    legislation: ACT_2018,
    phaseHistory: phaseRefs(2018, 'Early Engagement', 'Process Planning'),
    currentPhaseName: AD_AND_R,
    eacDecision: IN_PROGRESS_2018,
  },
  phases: [
    phase('Pre-EA (EAC Assessment)', '2019-06-07', '2020-05-14'),
    phase('Early Engagement', '2020-05-15', '2020-09-01'),
    phase('DPD Development (Proponent Time)', '2020-09-02', '2020-10-29'),
    phase('Readiness Decision', '2020-10-30', '2020-12-18'),
    phase('Process Planning', '2020-12-19', '2021-04-16'),
    phase('EAC Application Development (Proponent Time)', '2021-04-17', '2021-07-27'),
    phase('EAC Application Review', '2021-07-28', '2022-01-24'),
    phase('Revised EAC Application Development (Proponent Time)', '2022-01-25', '2022-11-30'),
    phase('Effects Assessment & Recommendation', '2022-12-01', '2023-09-11'),
    phase('EAC Decision', '2023-09-12', '2023-10-10'),
  ],
};

/** Crown Mountain (id 69): 2002 → 2018, the last three Track phases still ahead. */
export const CROWN_MOUNTAIN: DemiProject = {
  name: 'Crown Mountain Coking Coal',
  legislation: ACT_2018,
  legislationYearList: [2002, 2018],
  currentLegislationYear: 'legislation_2018',
  eacDecision: IN_PROGRESS_2018,
  currentPhaseName: AD_AND_R,
  projectState: 'Under Work',
  eaCertificate: 'In progress',
  legislation_2002: {
    legislation: ACT_2002,
    phaseHistory: phaseRefs(2002, 'Pre-Application'),
  },
  legislation_2018: { legislation: ACT_2018, phaseHistory: [AD_AND_R] },
  phases: [
    phase('Pre-EA (EAC Assessment)', '2022-04-19', '2023-05-03'),
    phase('EAC Application Development (Proponent Time)', '2023-05-04', '2024-01-15'),
    phase('EAC Application Review', '2024-01-16', '2026-05-24'),
    phase(
      'Revised EAC Application Development (Proponent Time)',
      '2026-05-27',
      '2027-01-26',
      false,
    ),
    phase('Effects Assessment & Recommendation', '2027-04-02', '2027-08-30', false),
    phase('EAC Decision', '2027-08-31', '2027-09-30', false),
  ],
};

/** Certified under the 2002 Act by Eagle alone, before Track: no phases, no works. */
export const CERTIFIED_2002: DemiProject = {
  name: '2002 certified sample',
  legislation: ACT_2002,
  legislationYearList: [2002],
  currentLegislationYear: 'legislation_2002',
  eacDecision: ref('Certificate Issued', 'eaDecisions', 2002),
  decisionDate: '2008-09-24T07:00:00.000Z',
  projectState: 'Operation',
  legislation_2002: {
    legislation: ACT_2002,
    decisionDate: '2008-09-24T07:00:00.000Z',
    review180Start: '2008-02-11T08:00:00.000Z',
    review45Start: '2008-08-11T07:00:00.000Z',
    phaseHistory: phaseRefs(
      2002,
      'Pre-Application',
      'Evaluation',
      'Application Review',
      'Referral',
      'Post Decision - Amendment',
    ),
  },
};

export const AMENDMENT_DOCUMENTS: AmendmentDocument[] = [
  ['Amendment Package', '2011-03-07'],
  ['Amendment Information', '2011-05-16'],
  ['Amendment Package', '2015-10-19'],
].map(([type, date], index) => ({
  id: `doc-${index}`,
  type,
  displayName: `${type} ${index + 1}`,
  datePosted: `${date}T07:00:00.000Z`,
}));

/** Ridgeback Mine: the 1996 Act, phases stored under the 2002 names, no Track data. */
export const ACT_1996_PROJECT: DemiProject = {
  name: 'Ridgeback Mine',
  legislation: ACT_1996,
  legislationYearList: [1996],
  currentLegislationYear: 'legislation_1996',
  eacDecision: ref('Certificate Issued', 'eaDecisions', 2002),
  decisionDate: '1999-08-20T07:00:00.000Z',
  projectState: 'Inactive',
  legislation_1996: {
    legislation: ACT_1996,
    decisionDate: '1999-08-20T07:00:00.000Z',
    phaseHistory: phaseRefs(2002, 'Pre-EA', 'Evaluation', 'Referral'),
  },
};

/** Re-applied: the first Track assessment ended, a second one led to a certificate. */
export const SECOND_ASSESSMENT: DemiProject = {
  name: 'Re-applied sample',
  legislation: ACT_2018,
  legislationYearList: [2018],
  currentLegislationYear: 'legislation_2018',
  eaCertificate: 'E25-03',
  projectState: 'Preconstruction',
  works: [
    work({
      workTypeId: 6,
      workType: 'Assessment',
      title: 'First assessment',
      startDate: '2020-02-03',
      workState: 'TERMINATED',
      decisionDate: '2021-03-19',
      phases: [
        phase('Early Engagement', '2020-02-03', '2020-06-26'),
        phase('Readiness Decision', '2020-09-14', '2021-03-19'),
      ],
    }),
    work({
      workTypeId: 6,
      workType: 'Assessment',
      title: 'Second assessment',
      startDate: '2022-05-02',
      decisionDate: '2025-07-25',
      phases: [
        phase('Early Engagement', '2022-05-02', '2022-09-30'),
        phase('Readiness Decision', '2023-01-09', '2023-03-03'),
        phase('EAC Decision', '2025-07-07', '2025-07-25'),
      ],
    }),
  ],
};

/** Ajax Mine: refused under the 2002 Act, Eagle history names only, later 2018 Act Track phases. */
export const AJAX: DemiProject = {
  name: 'Ajax Mine',
  legislation: ACT_2002,
  legislationYearList: [2002],
  currentLegislationYear: 'legislation_2002',
  eacDecision: ref('Certificate Refused', 'eaDecisions', 2002),
  decisionDate: '2017-12-13T08:00:00.000Z',
  eaCertificate: 'REFUSED',
  projectState: 'Closed',
  currentPhaseName: ref('Post Decision - Complete', 'projectPhase', 2002),
  legislation_2002: {
    legislation: ACT_2002,
    phaseHistory: [
      ...phaseRefs(2002, 'Application Review', 'Referral'),
      ref('Complete', 'projectPhase', 2018),
      ...phaseRefs(2002, 'Other', 'Post Decision - Complete'),
    ],
  },
  legislation_2018: { legislation: ACT_2018, phaseHistory: [] },
  phases: [
    phase('Pre-EA (EAC Assessment)', '2023-09-14', '2023-12-13'),
    phase('Early Engagement', '2023-12-14', '2024-03-13'),
    phase('DPD Development (Proponent Time)', '2024-03-14', '2025-03-14'),
    phase('Readiness Decision', '2025-03-15', '2025-05-14', false),
  ],
};

export const AJAX_LISTS = phaseList(
  2002,
  'Pre-EA',
  'Pre-Application',
  'Evaluation',
  'Application Review',
  'Referral',
);

/** Ajax's documents per phase, as Eagle holds them. */
export const AJAX_PHASE_DOCUMENTS: TimelineDocument[] = [
  ...phaseDocuments(2002, 'Pre-EA', 45, '2011-02-25', '2015-04-10'),
  ...phaseDocuments(2002, 'Pre-Application', 207, '2011-02-25', '2016-04-01'),
  ...phaseDocuments(2002, 'Evaluation', 4, '2015-09-16', '2015-11-02'),
  // "Round 2 Working Group Comments", posted under a 2004 date.
  ...phaseDocuments(2002, 'Application Review', 8, '2004-10-27', '2004-10-27'),
  ...phaseDocuments(2002, 'Application Review', 526, '2016-01-18', '2017-12-11'),
  ...phaseDocuments(2002, 'Referral', 18, '2017-02-23', '2017-12-14'),
];

export const AJAX_COMMENT_PERIODS: CommentPeriodSpan[] = [
  {
    id: 'cp-1',
    start: '2016-01-26T17:00:00.000Z',
    end: '2016-04-11T16:00:00.000Z',
    label: 'Application Review',
    href: '/p/ajax/cp/cp-1/details',
    relatedDocuments: [AJAX_PHASE_DOCUMENTS[60]._id, AJAX_PHASE_DOCUMENTS[260]._id, 'not-read'],
  },
  {
    id: 'cp-2',
    start: '2017-08-08T07:00:00.000Z',
    end: '2017-10-11T07:00:00.000Z',
    label: null,
    href: null,
    relatedDocuments: [],
  },
];
