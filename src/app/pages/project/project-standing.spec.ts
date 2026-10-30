import { describe, it, expect } from 'vitest';
import type { DemiProject } from 'app/api/api';
import type { Work } from 'app/api/project-phases';
import { projectStandingOf, type ProjectStanding } from './project-standing';
import { TRANSITIONED, work } from './timeline.fixture';

const ACTIVE_ID = 500;
const DECIDED_ON = '2020-01-01T08:00:00.000Z';
const GRANTED = 'Environmental Assessment Certificate GRANTED';

const named = (name: string) => ({ _id: `list-${name}`, name });

/** A project whose one active Track work has type `workTypeId`. */
function withActiveWork(workTypeId: number, workType: string, rest: DemiProject = {}): DemiProject {
  return {
    ...rest,
    activeWork: { trackWorkId: ACTIVE_ID },
    works: [
      ...((rest.works as unknown[]) ?? []),
      work({
        trackWorkId: ACTIVE_ID,
        workTypeId,
        workType,
        isActive: true,
        workState: 'IN_PROGRESS',
      }),
    ],
  };
}

const assessment = (fields: Record<string, unknown>) =>
  work({ workTypeId: 6, workType: 'Assessment', ...fields });

const GRANTED_ASSESSMENT = assessment({
  outcome: GRANTED,
  decisionDate: '2023-10-10T00:00:00.000Z',
});

const CARIBOO_LIVE: DemiProject = {
  ...withActiveWork(7, 'Amendment', { ...TRANSITIONED, works: [GRANTED_ASSESSMENT] }),
};

const CARIBOO_AMENDMENT_CLOSED: DemiProject = {
  ...TRANSITIONED,
  activeWork: null,
  works: [GRANTED_ASSESSMENT, work({ workTypeId: 7, workType: 'Amendment' })],
};

const SITE_C: DemiProject = {
  name: 'Site C Clean Energy Project',
  projectState: 'Construction',
  eacDecision: named('Certificate Issued'),
  currentPhaseName: named('Post Decision - Construction'),
  decisionDate: '2014-10-14T07:00:00.000Z',
  activeWork: null,
  works: [work({ workTypeId: 7, workType: 'Amendment', outcome: 'Approved' })],
};

const EXIT_DECISIONS = [
  'Withdrawn',
  'Application Withdrawn',
  'Terminated',
  'Assessment Terminated',
  'Administrative Closure',
  'Regulatory Transfer',
  'Certificate Expired',
  'Certificate Refused',
  'Certificate Cancelled',
  'Not Designated Reviewable',
  'Project Designated Non-Reviewable',
  'Certificate Not Required',
  'Certificate End of Life',
];

const exitRows = EXIT_DECISIONS.map((name): Row => [
  `decision ${name}`,
  { eacDecision: named(name), decisionDate: DECIDED_ON },
  { standing: 'exited', decision: { name, date: DECIDED_ON, source: 'eagle' } },
]);

const decidedRows = ['Pre-EA Act Approval', 'Exemption Order', 'Certificate Reinstated'].map(
  (name): Row => [
    `decision ${name}`,
    { eacDecision: named(name) },
    { standing: 'decided', decision: { name, date: null, source: 'eagle' } },
  ],
);

const noDecisionRows = ['Further Assessment Required', 'Exemption Order Rescinded'].map(
  (name): Row => [
    `decision ${name}`,
    { eacDecision: named(name) },
    { standing: 'eaWork', decision: null },
  ],
);

const workTypeRows = (
  [
    [1, 'Project Notification', 'eaWork'],
    [2, "Minister's Designation", 'eaWork'],
    [3, "CEAO's Designation", 'eaWork'],
    [5, 'Exemption Order', 'eaWork'],
    [6, 'Assessment', 'eaWork'],
    [7, 'Amendment', 'postDecisionWork'],
    [9, 'EAC Extension', 'postDecisionWork'],
    [10, 'Substantial Start Determination', 'postDecisionWork'],
    [11, 'EAC/Order Transfer', 'postDecisionWork'],
    [15, 'Material Alteration', 'postDecisionWork'],
    [16, 'Joint Complex Amendment', 'postDecisionWork'],
  ] as const
).map(([id, type, standing]): Row => [
  `active work ${id} ${type}`,
  withActiveWork(id, type),
  { standing, work: { workTypeId: id, workType: type } },
]);

const stateRows = [
  'Preconstruction',
  'Construction',
  'Operation',
  'Care and Maintenance',
  'Decommissioning',
].map((state): Row => [
  `projectState ${state}`,
  { projectState: state },
  { standing: 'decided', stage: state },
]);

const steadyPhaseRows = (
  [
    ['Post Decision - Pre-Construction', 'Preconstruction'],
    ['Post Decision - Construction', 'Construction'],
    ['Post Decision - Operation', 'Operation'],
    ['Post Decision - Care & Maintenance', 'Care and Maintenance'],
    ['Post Decision - Decommission', 'Decommissioning'],
    ['Complete', 'Completed'],
    ['Post Decision - Complete', 'Completed'],
  ] as const
).map(([phase, stage]): Row => [
  `Eagle phase ${phase}`,
  { currentPhaseName: named(phase) },
  { standing: 'decided', stage },
]);

// Certificate Issued too, so only the Eagle-only work rule can make these post-decision work.
const workPhaseRows = [
  'Amendment',
  'Substantial Start',
  'Extension',
  'Suspension',
  'Transfer of Certificate/Order',
].map((name): Row => [
  `Eagle-only phase Post Decision - ${name}`,
  {
    eacDecision: named('Certificate Issued'),
    currentPhaseName: named(`Post Decision - ${name}`),
  },
  { standing: 'postDecisionWork', work: null, stage: null },
]);

/** The fields a row checks; `work` names only the keys that tell works apart. */
type Expected = Partial<Omit<ProjectStanding, 'work'>> & { work?: Partial<Work> | null };
type Row = [string, DemiProject | null | undefined, Expected];

const ROWS: Row[] = [
  ...workTypeRows,
  ...exitRows,
  ...decidedRows,
  ...noDecisionRows,
  ...stateRows,
  ...steadyPhaseRows,
  ...workPhaseRows,
  [
    'Closed with decision In Progress',
    { projectState: 'Closed', eacDecision: named('In Progress') },
    { standing: 'exited', decision: null },
  ],
  [
    'Closed with decision Certificate Issued',
    { projectState: 'Closed', eacDecision: named('Certificate Issued') },
    { standing: 'decided' },
  ],
  [
    'Closed with a granted Track assessment',
    { projectState: 'Closed', works: [GRANTED_ASSESSMENT] },
    { standing: 'decided' },
  ],
  [
    'Certificate Refused on "Post Decision - Complete"',
    {
      eacDecision: named('Certificate Refused'),
      currentPhaseName: named('Post Decision - Complete'),
    },
    { standing: 'exited', stage: null },
  ],
  [
    'Operation with an active Amendment',
    withActiveWork(7, 'Amendment', {
      projectState: 'Operation',
      eacDecision: named('Certificate Issued'),
    }),
    { standing: 'postDecisionWork', stage: null },
  ],
  [
    'an active assessment on an old Certificate Issued',
    withActiveWork(6, 'Assessment', { eacDecision: named('Certificate Issued') }),
    { standing: 'eaWork', work: { workTypeId: 6 } },
  ],
  [
    'an active work of unlisted type 14',
    withActiveWork(14, 'Other', { projectState: 'Operation' }),
    { standing: 'decided', work: null },
  ],
  [
    'an active work id matching no work',
    {
      projectState: 'Operation',
      activeWork: { trackWorkId: 999 },
      works: [work({ trackWorkId: 998, isActive: true, workState: 'IN_PROGRESS' })],
    },
    { standing: 'decided', work: null },
  ],
  [
    'Closed with a bare-id decision',
    { projectState: 'Closed', eacDecision: 'list-id-only' },
    { standing: 'exited', decision: null },
  ],
  ['a bare-id phase', { currentPhaseName: 'list-id-only' }, { standing: 'eaWork', stage: null }],
  ['a null document', null, { standing: 'eaWork', work: null, stage: null, decision: null }],
  ['no document', undefined, { standing: 'eaWork', decision: null }],
  [
    'Cariboo Gold live: Eagle lags, Track granted, Amendment active',
    CARIBOO_LIVE,
    {
      standing: 'postDecisionWork',
      work: { workTypeId: 7, trackWorkId: ACTIVE_ID },
      decision: { name: 'Certificate Issued', date: '2023-10-10T00:00:00.000Z', source: 'track' },
    },
  ],
  [
    'Cariboo Gold once the Amendment closes',
    CARIBOO_AMENDMENT_CLOSED,
    { standing: 'decided', stage: null, work: null },
  ],
  [
    'a completed assessment with a refused outcome',
    {
      eacDecision: named('In Progress'),
      works: [
        assessment({
          outcome: 'Environmental Assessment Certificate REFUSED',
          decisionDate: DECIDED_ON,
        }),
      ],
    },
    {
      standing: 'exited',
      decision: { name: 'Certificate Refused', date: DECIDED_ON, source: 'track' },
    },
  ],
  [
    'Eagle Certificate Issued on Operation, Track assessment refused',
    {
      projectState: 'Operation',
      eacDecision: named('Certificate Issued'),
      decisionDate: '2019-05-01T07:00:00.000Z',
      works: [assessment({ outcome: 'Certificate Refused', decisionDate: DECIDED_ON })],
    },
    {
      standing: 'decided',
      stage: 'Operation',
      decision: {
        name: 'Certificate Issued',
        date: '2019-05-01T07:00:00.000Z',
        source: 'eagle',
      },
    },
  ],
  [
    'refused then later certified (two completed assessments), Eagle In Progress',
    {
      eacDecision: named('In Progress'),
      works: [
        assessment({ outcome: 'Certificate Refused', decisionDate: DECIDED_ON }),
        GRANTED_ASSESSMENT,
      ],
    },
    {
      standing: 'decided',
      decision: { name: 'Certificate Issued', date: '2023-10-10T00:00:00.000Z', source: 'track' },
    },
  ],
  [
    'certified listed before the older refusal, Eagle In Progress',
    {
      eacDecision: named('In Progress'),
      works: [
        GRANTED_ASSESSMENT,
        assessment({ outcome: 'Certificate Refused', decisionDate: DECIDED_ON }),
      ],
    },
    {
      standing: 'decided',
      decision: { name: 'Certificate Issued', date: '2023-10-10T00:00:00.000Z', source: 'track' },
    },
  ],
  [
    'certified then later refused (two completed assessments), Eagle In Progress',
    {
      eacDecision: named('In Progress'),
      works: [
        GRANTED_ASSESSMENT,
        assessment({ outcome: 'Certificate Refused', decisionDate: '2024-06-01T07:00:00.000Z' }),
      ],
    },
    {
      standing: 'exited',
      decision: { name: 'Certificate Refused', date: '2024-06-01T07:00:00.000Z', source: 'track' },
    },
  ],
  [
    'Certificate Issued with a blank decision date stored as the epoch',
    { eacDecision: named('Certificate Issued'), decisionDate: '1970-01-01T00:00:00.000Z' },
    { standing: 'decided', decision: { name: 'Certificate Issued', date: null, source: 'eagle' } },
  ],
  [
    'a withdrawn assessment, whose outcome is no decision',
    {
      eacDecision: named('In Progress'),
      works: [assessment({ workState: 'WITHDRAWN', outcome: 'Withdrawn by proponent' })],
    },
    { standing: 'eaWork', decision: null },
  ],
  [
    'Site C live',
    SITE_C,
    {
      standing: 'decided',
      stage: 'Construction',
      decision: { name: 'Certificate Issued', date: SITE_C.decisionDate!, source: 'eagle' },
    },
  ],
  [
    'Track works, none active, stale Eagle phase Post Decision - Amendment',
    {
      projectState: 'Operation',
      currentPhaseName: named('Post Decision - Amendment'),
      works: [work({ workTypeId: 7, workType: 'Amendment' })],
    },
    { standing: 'decided', stage: 'Operation' },
  ],
  [
    'Certificate Issued whose eacExpires has passed',
    { eacDecision: named('Certificate Issued'), eacExpires: '2001-01-01T08:00:00.000Z' },
    { standing: 'decided', decision: { name: 'Certificate Issued', date: null, source: 'eagle' } },
  ],
];

describe('projectStandingOf', () => {
  it.each(ROWS)('places %s', (_name, doc, expected) => {
    expect(projectStandingOf(doc)).toMatchObject(expected);
  });
});
