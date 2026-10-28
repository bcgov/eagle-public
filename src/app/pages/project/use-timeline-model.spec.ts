import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { DemiProject } from 'app/api/api';
import { readDocuments } from 'app/api/document';
import { Document } from 'app/models/document';
import { makeQueryClient } from '../../../test-utils';
import {
  ACT_1996_PROJECT,
  AJAX,
  AJAX_COMMENT_PERIODS,
  AJAX_LISTS,
  AJAX_PHASE_DOCUMENTS,
  AMENDMENT_DOCUMENTS,
  CEDAR,
  CERTIFIED_2002,
  CROWN_MOUNTAIN,
  SECOND_ASSESSMENT,
  TODAY,
  TRANSITIONED,
  milestone,
  phaseDocuments,
  phaseList,
  work,
} from './timeline.fixture';
import {
  buildTimelineModel,
  useTimelineModel,
  type TimelineInput,
  type TimelineItem,
  type TimelineModel,
} from './use-timeline-model';

vi.mock('app/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/api/api')>()),
  demiProjectQueryOptions: (projId: string) => ({
    queryKey: ['demiProject', projId],
    queryFn: async () => CERTIFIED_2002,
  }),
  listsQueryOptions: () => ({
    queryKey: ['lists'],
    queryFn: async () => [
      { id: 'type-package', name: 'Amendment Package', type: 'doctype', legislation: 2002 },
      { id: 'phase-referral', name: 'Referral', type: 'projectPhase', legislation: 2002 },
    ],
  }),
}));

const commentPeriodRows = vi.hoisted(() => vi.fn(async (): Promise<unknown[]> => []));

vi.mock('app/api/commentperiod', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/api/commentperiod')>()),
  commentPeriodsQueryOptions: (projId: string) => ({
    queryKey: ['commentPeriods', projId],
    queryFn: () => commentPeriodRows(),
  }),
}));

vi.mock('app/api/document', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/api/document')>()),
  readDocuments: vi.fn(),
}));

function model(
  project: DemiProject,
  documents = AMENDMENT_DOCUMENTS.slice(0, 0),
  more: Partial<TimelineInput> = {},
) {
  return buildTimelineModel({ project, documents, lists: [], today: TODAY, ...more });
}

function ofKind<K extends TimelineItem['kind']>(built: TimelineModel, kind: K) {
  return built.items.filter(
    (item): item is Extract<TimelineItem, { kind: K }> => item.kind === kind,
  );
}

function byId(built: TimelineModel, id: string) {
  return built.items.find((item) => item.id === id);
}

const withWorks = (project: DemiProject, works: unknown[]): DemiProject => ({ ...project, works });

describe('a 2018-only project', () => {
  const cedar = model(CEDAR);

  it('has no undated phase, transition or document rows', () => {
    expect(
      cedar.items.filter((item) => item.kind === 'phase' && item.status === 'undated'),
    ).toEqual([]);
    expect(ofKind(cedar, 'transition')).toEqual([]);
    expect(ofKind(cedar, 'document')).toEqual([]);
  });

  it('draws the merged 2018 rows Track dates, with proponent time between them', () => {
    expect(
      cedar.items
        .filter((item) => item.kind === 'phase' || item.kind === 'proponent')
        .map((item) => item.title),
    ).toEqual([
      'Early Engagement',
      'With the proponent',
      'Readiness Decision',
      'Process Planning',
      'With the proponent',
      'Application Development and Review',
      'Effects Assessment and Recommendation',
      'Referral and Decision',
    ]);
    expect(ofKind(cedar, 'proponent')[0].beforePhase).toBe('Readiness Decision');
  });

  it('splits the assessment time between the EAO and the proponent', () => {
    expect(ofKind(cedar, 'certificate')[0].whoseTime).toEqual({ eaoDays: 408, proponentDays: 431 });
  });

  it('takes the certificate from Track, dated when it was signed', () => {
    const [certificate] = ofKind(cedar, 'certificate');

    expect(certificate.title).toBe('Environmental Assessment Certificate issued');
    expect(certificate.source).toBe('track');
    expect(certificate.start).toBe('2023-03-14T07:00:00.000Z');
  });

  it('reads the summary line without an Act transition', () => {
    expect(cedar.summary).toBe(
      'Cedar LNG · 2018 Act · certificate under the 2018 Act · 3 works in Track',
    );
  });

  it('puts the amendments on their own lane and leaves Other work out', () => {
    expect(cedar.lanes.map((lane) => lane.label)).toEqual(['Legislation', 'Project', 'Amendments']);
  });

  it('records the post-certificate stage and the open work on Today', () => {
    const [today] = ofKind(cedar, 'today');

    expect(today.currentStage).toBe('Construction');
    expect(today.openWorks).toBe(1);
    expect(cedar.items[cedar.items.length - 1]).toBe(today);
  });
});

describe('a transitioned project', () => {
  const transitioned = model(TRANSITIONED);

  it('has one transition with no date, and a range from the Act coming into force', () => {
    expect(transitioned.transitions).toEqual([
      {
        fromYear: 2002,
        toYear: 2018,
        date: null,
        between: { from: '2019-12-16', to: '2020-05-15' },
      },
    ]);
  });

  it('drops the 1969 decision date Eagle stores for a blank one', () => {
    expect(ofKind(transitioned, 'milestone')).toEqual([]);
    expect(transitioned.items.some((item) => item.start?.startsWith('1969'))).toBe(false);
  });

  it('folds the undated 2002 phases into one history row', () => {
    const [history] = ofKind(transitioned, 'history');

    expect(history.title).toBe('2002 Act phases');
    expect(history.childIds.map((id) => byId(transitioned, id)?.title)).toEqual([
      'Pre-EA',
      'Pre-Application',
    ]);
  });

  it('reads the Act year of each row from its block, not the current phase', () => {
    expect(byId(transitioned, 'phase-2002-pre-ea')?.actYear).toBe(2002);
    expect(ofKind(transitioned, 'band').map((band) => band.actYear)).toEqual([2002, 2018]);
  });

  it('trusts the Track certificate over Eagle still saying In Progress', () => {
    const [certificate] = ofKind(transitioned, 'certificate');

    expect(certificate.source).toBe('track');
    expect(certificate.certificateNumber).toBe('M23-01');
  });

  it('says the transition date is not recorded in the summary', () => {
    expect(transitioned.summary).toBe(
      'Cariboo Gold Project · 2002 Act → 2018 Act (transitioned, date not recorded) · ' +
        'certificate under the 2018 Act',
    );
  });

  it('dates the transition when DEMI has one', () => {
    const dated = model({
      ...TRANSITIONED,
      legislationTransitions: [{ fromYear: 2002, toYear: 2018, date: '2019-12-16' }],
    });

    expect(dated.transitions[0]).toMatchObject({ date: '2019-12-16', between: null });
    expect(dated.summary).toContain('2002 Act → 2018 Act (transitioned) ·');
  });
});

describe('a project with Track phases still ahead', () => {
  const crown = model(CROWN_MOUNTAIN);

  it('marks the future phases planned and the running one current', () => {
    expect(
      crown.items
        .filter((item) => item.actYear === 2018)
        .filter((item) => item.kind === 'phase' || item.kind === 'proponent')
        .map((item) => (item.kind === 'phase' || item.kind === 'proponent' ? item.status : null)),
    ).toEqual(['done', 'done', 'done', 'current', 'planned', 'planned']);
  });

  it('draws no certificate while Track writes "In progress" for the number', () => {
    expect(ofKind(crown, 'certificate')).toEqual([]);
    expect(crown.defaultSelectedId).toBeNull();
  });
});

describe('Act order', () => {
  it.each([
    ['Cariboo Gold', TRANSITIONED],
    ['Crown Mountain', CROWN_MOUNTAIN],
  ])('%s lists the undated 2002 Act band before its history row', (_, project) => {
    const ids = model(project)
      .items.filter((item) => item.actYear === 2002)
      .map((item) => item.id);

    expect(ids.slice(0, 2)).toEqual(['band-2002', 'history-2002']);
  });
});

describe('a 2002-certified project before Track', () => {
  const certified = model(CERTIFIED_2002, AMENDMENT_DOCUMENTS);

  it('lists the amendment documents with no outcome', () => {
    expect(ofKind(certified, 'document').map((document) => document.outcome)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('gives no row a whose-time split', () => {
    expect(certified.items.filter((item) => 'whoseTime' in item && item.whoseTime)).toEqual([]);
  });

  it('has no Track work rows', () => {
    expect(ofKind(certified, 'work')).toEqual([]);
    expect(certified.summary).not.toContain('works in Track');
  });

  it('hides a document posted the same day as the first Track amendment, even hours earlier', () => {
    const tracked = model(
      withWorks(CERTIFIED_2002, [work({ startDate: '2015-10-19T09:00:00.000Z' })]),
      AMENDMENT_DOCUMENTS,
    );

    expect(ofKind(tracked, 'document').map((document) => document.start)).toEqual([
      '2011-03-07T07:00:00.000Z',
      '2011-05-16T07:00:00.000Z',
    ]);
    expect(tracked.summary).toMatch(/· 1 work in Track$/);
  });

  it('dates the certificate from Eagle', () => {
    const [certificate] = ofKind(certified, 'certificate');

    expect(certificate).toMatchObject({ source: 'eagle', start: '2008-09-24T07:00:00.000Z' });
  });

  it('keeps the review milestones and leaves Post Decision off the phase rows', () => {
    expect(ofKind(certified, 'milestone').map((item) => item.title)).toEqual([
      '180-day review starts',
      '45-day decision period starts',
    ]);
    expect(ofKind(certified, 'phase').map((item) => item.title)).toEqual([
      'Pre-Application',
      'Evaluation',
      'Application Review',
      'Referral',
    ]);
  });
});

describe('a 1996 Act project', () => {
  const act1996 = model(ACT_1996_PROJECT);

  it('draws the 1996 phases from the stored 2002 names', () => {
    expect(ofKind(act1996, 'phase').map((item) => [item.title, item.actYear])).toEqual([
      ['Pre-Application', 1996],
      ['Application Review', 1996],
      ['Referral', 1996],
    ]);
  });

  it('lists the 1996 step set on its Act, marking the phases the project went through', () => {
    expect(act1996.acts[0].rows.map(({ row, onProject }) => [row.name, onProject])).toEqual([
      ['Pre-Application', true],
      ['Application Review', true],
      ['Referral', true],
      ['Post Decision', false],
    ]);
  });

  it('names the Project Approval Certificate and leaves the stage not recorded', () => {
    expect(ofKind(act1996, 'certificate')[0].title).toBe('Project Approval Certificate issued');
    expect(ofKind(act1996, 'today')[0].currentStage).toBeNull();
  });
});

describe('a project refused under the 2002 Act with later 2018 Act Track phases', () => {
  const ajax = model(AJAX);
  const ids = ajax.items.map((item) => item.id);

  it('lists the Eagle 2002 history before the refusal', () => {
    expect(ajax.items.filter((item) => item.actYear === 2002).map((item) => item.title)).toEqual([
      'Under the Environmental Assessment Act (2002)',
      'Application Review',
      'Referral',
      'Environmental Assessment Certificate refused',
      'Today',
    ]);
  });

  it('files the Track phases under a 2018 band after the refusal, with no transition', () => {
    const tracked = ajax.items.filter(
      (item) => (item.kind === 'phase' || item.kind === 'proponent') && item.status !== 'undated',
    );

    expect(ofKind(ajax, 'band').map((band) => band.actYear)).toEqual([2002, 2018]);
    expect(ajax.transitions).toEqual([]);
    expect(tracked).toHaveLength(4);
    expect(tracked.every((item) => item.actYear === 2018)).toBe(true);
    expect(ids.indexOf('band-2018')).toBeGreaterThan(ids.indexOf('certificate'));
    expect(ids.indexOf('band-2018')).toBeLessThan(ids.indexOf(tracked[0].id));
  });

  it('records no post-certificate stage after the refusal', () => {
    expect(ofKind(ajax, 'today')[0].currentStage).toBeNull();
  });
});

describe('Ajax phases dated from its documents', () => {
  const dated = (input: Partial<TimelineInput>) =>
    model(AJAX, undefined, { lists: AJAX_LISTS, ...input });
  const rows2002 = (built: TimelineModel) =>
    ofKind(built, 'phase').filter((item) => item.actYear === 2002);
  const ajax = dated({ projectDocuments: AJAX_PHASE_DOCUMENTS });

  it('dates Pre-EA to Referral in stage order, before the refusal', () => {
    const ids = ajax.items.map((item) => item.id);

    expect(
      rows2002(ajax).map((item) => [
        item.title,
        item.start?.slice(0, 10),
        item.end?.slice(0, 10),
        item.documentCount,
      ]),
    ).toEqual([
      ['Pre-EA', '2011-02-25', '2015-04-10', 45],
      ['Pre-Application', '2011-02-25', '2016-04-01', 207],
      ['Evaluation', '2015-09-16', '2015-11-02', 4],
      ['Application Review', '2016-01-18', '2017-12-11', 526],
      ['Referral', '2017-02-23', '2017-12-14', 18],
    ]);
    expect(rows2002(ajax).every((item) => item.status === 'done')).toBe(true);
    expect(ids.indexOf('band-2002')).toBeLessThan(ids.indexOf(rows2002(ajax)[0].id));
    expect(ids.indexOf(rows2002(ajax)[4].id)).toBeLessThan(ids.indexOf('certificate'));
    expect(ids.indexOf('certificate')).toBeLessThan(ids.indexOf('band-2018'));
  });

  it('marks the dated stages on the 2002 Act', () => {
    expect(ajax.acts[0].rows.filter((one) => one.onProject).map((one) => one.row.name)).toEqual([
      'Pre-EA',
      'Pre-Application',
      'Evaluation',
      'Application Review',
      'Referral',
    ]);
  });

  it('leaves a phase with no documents Not dated', () => {
    const noReferral = dated({
      projectDocuments: AJAX_PHASE_DOCUMENTS.filter(
        (document) => !document.phase?.endsWith('Referral'),
      ),
    });
    const referral = rows2002(noReferral).find((item) => item.title === 'Referral');

    expect(referral).toMatchObject({ status: 'undated', start: null });
    expect(referral?.documentCount).toBeUndefined();
  });

  it('dates a phase with one document by that day alone', () => {
    const one = dated({
      projectDocuments: phaseDocuments(2002, 'Evaluation', 1, '2015-09-16', '2015-09-16'),
    });

    expect(rows2002(one).find((item) => item.title === 'Evaluation')).toMatchObject({
      start: '2015-09-16T08:00:00.000Z',
      end: null,
      documentCount: 1,
    });
  });

  it('ignores a document posted before its Act was in force', () => {
    const early = dated({
      projectDocuments: phaseDocuments(2002, 'Pre-EA', 3, '2001-01-01', '2001-06-01'),
    });

    expect(rows2002(early).find((item) => item.title === 'Pre-EA')).toBeUndefined();
  });

  it('marks the comment periods on the assessment lane under the 2002 Act', () => {
    const periods = ofKind(dated({ commentPeriods: AJAX_COMMENT_PERIODS }), 'milestone');

    expect(periods.map((item) => [item.title, item.lane, item.actYear, item.end])).toEqual([
      ['Public comment period', 'assessment', 2002, '2016-04-11T16:00:00.000Z'],
      ['Public comment period', 'assessment', 2002, '2017-10-11T07:00:00.000Z'],
    ]);
  });

  it('lists the documents tagged with a phase, newest first, and none on a phase with none', () => {
    const review = rows2002(ajax).find((item) => item.title === 'Application Review')!;
    const listed = ajax.documents[review.id];
    const posted = listed.documents.map((document) => document.datePosted);

    expect(listed).toMatchObject({ from: 'phase' });
    expect(listed.documents).toHaveLength(534);
    expect(
      listed.documents.every((document) => document.phase?.endsWith('Application Review')),
    ).toBe(true);
    expect(posted[0].slice(0, 10)).toBe('2017-12-11');
    expect(posted.at(-1)?.slice(0, 10)).toBe('2004-10-27');
    expect(posted).toEqual([...posted].sort().reverse());

    const trackPhase = ofKind(ajax, 'phase').find((item) => item.title === 'Early Engagement')!;
    expect(ajax.documents[trackPhase.id].documents).toEqual([]);
  });

  it('marks the document lists incomplete when the read stopped short of the total', () => {
    expect(ajax.documentsComplete).toBe(true);
    expect(
      dated({ projectDocuments: AJAX_PHASE_DOCUMENTS, projectDocumentTotal: 2400 })
        .documentsComplete,
    ).toBe(false);
  });

  it('lists the documents a comment period record names, with its page', () => {
    const built = dated({
      projectDocuments: AJAX_PHASE_DOCUMENTS,
      commentPeriods: AJAX_COMMENT_PERIODS,
    });
    const [first, second] = ofKind(built, 'milestone').filter((item) => item.commentPeriod);

    expect(first.commentPeriod).toEqual({
      label: 'Application Review',
      href: '/p/ajax/cp/cp-1/details',
    });
    expect(built.documents[first.id].documents.map((document) => document._id)).toEqual([
      AJAX_PHASE_DOCUMENTS[60]._id,
      AJAX_PHASE_DOCUMENTS[260]._id,
    ]);
    expect(built.documents[second.id].documents).toEqual([]);
  });

  it('gives the refusal the Referral documents when none is marked as a certificate', () => {
    const referral = rows2002(ajax).find((item) => item.title === 'Referral')!;

    expect(ajax.documents['certificate']).toEqual(ajax.documents[referral.id]);
    expect(ajax.documents['certificate'].documents).toHaveLength(18);
  });

  it('gives a decision the documents its type, or its name near the decision, marks', () => {
    const decision = { ...AJAX_PHASE_DOCUMENTS[0], _id: 'decision', type: 'decision-materials' };
    const letter = {
      ...AJAX_PHASE_DOCUMENTS[1],
      _id: 'letter',
      displayName: 'Certificate refusal letter',
      datePosted: byId(ajax, 'certificate')!.start!,
    };
    const insurance = {
      ...AJAX_PHASE_DOCUMENTS[2],
      _id: 'insurance',
      displayName: 'Certificate of Insurance',
    };
    const built = dated({
      lists: [
        ...AJAX_LISTS,
        { id: 'decision-materials', name: 'Decision Materials', legislation: 2002 },
      ],
      projectDocuments: [...AJAX_PHASE_DOCUMENTS, decision, letter, insurance],
    });

    expect(built.documents['certificate']).toMatchObject({ from: 'certificate' });
    expect(built.documents['certificate'].documents.map((document) => document._id).sort()).toEqual(
      ['decision', 'letter'],
    );
  });
});

describe('2018 documents beside Track phases', () => {
  const crown = model(CROWN_MOUNTAIN, undefined, {
    lists: phaseList(2018, 'Early Engagement', 'EAC Application Review'),
    projectDocuments: [
      ...phaseDocuments(2018, 'Early Engagement', 3, '2021-09-01', '2022-03-01'),
      ...phaseDocuments(2018, 'EAC Application Review', 5, '2024-02-01', '2025-02-01'),
    ],
  });
  const rows2018 = ofKind(crown, 'phase').filter((item) => item.actYear === 2018);

  it('dates a stage only documents name, and keeps Track dates for the stage Track has', () => {
    expect(rows2018.filter((item) => item.documentCount).map((item) => item.title)).toEqual([
      'Early Engagement',
    ]);
    expect(
      rows2018.filter((item) => item.row?.name === 'Application Development and Review'),
    ).toEqual([expect.objectContaining({ start: '2024-01-16T09:00:00.000Z' })]);
  });
});

describe('Eagle phase history beside Track phases', () => {
  it('keeps an Eagle phase Track has no dates for, and one row for a phase Track dates', () => {
    const crown = model({
      ...CROWN_MOUNTAIN,
      legislation_2018: {
        ...CROWN_MOUNTAIN['legislation_2018'],
        phaseHistory: [
          { _id: 'ee', name: 'Early Engagement', type: 'projectPhase', legislation: 2018 },
          ...(CROWN_MOUNTAIN['legislation_2018'] as { phaseHistory: unknown[] }).phaseHistory,
        ],
      },
    });
    const rows2018 = ofKind(crown, 'phase').filter((item) => item.actYear === 2018);

    expect(rows2018.filter((item) => item.status === 'undated').map((item) => item.title)).toEqual([
      'Early Engagement',
    ]);
    expect(
      rows2018.filter((item) => item.row?.name === 'Application Development and Review'),
    ).toHaveLength(1);
  });
});

describe('no Track works', () => {
  it.each([
    ['transitioned', TRANSITIONED],
    ['2002 certified', CERTIFIED_2002],
  ])('gives the %s project no work rows', (_name, project) => {
    expect(ofKind(model(project), 'work')).toEqual([]);
  });
});

describe('default selection', () => {
  it('picks the first open work', () => {
    expect(byId(model(CEDAR), model(CEDAR).defaultSelectedId!)?.title).toBe('Amendment #3');
  });

  it('falls back to the certificate when no work is open', () => {
    expect(model(CERTIFIED_2002).defaultSelectedId).toBe('certificate');
  });
});

describe('Track work milestones', () => {
  const [open] = ofKind(model(CEDAR), 'work').filter((item) => item.open);

  it('dates each milestone from its actual date, else its planned one', () => {
    expect(open.milestones.map(({ name, date, planned }) => [name, date, planned])).toEqual([
      ['Application received', '2025-10-06', false],
      ['Information requirements set', '2025-11-17', false],
      ['Referral', '2026-12-07', true],
      ['Decision', '2027-03-15', true],
    ]);
  });

  it('plans the decision on the last planned milestone, not the work date', () => {
    expect(open.plannedDecision).toBe('2027-03-15');
  });

  it('ends a Closed work with no decision on an "Ended with no decision" milestone', () => {
    const closed = ofKind(
      model(
        withWorks(CEDAR, [
          work({
            workTypeId: 15,
            title: 'Material alteration 1',
            startDate: '2025-04-07',
            workState: 'CLOSED',
            decisionDate: '2025-07-28',
            milestones: [milestone('Notice received', { actual: '2025-04-07' }, 'START')],
          }),
        ]),
      ),
      'work',
    )[0];

    expect(closed.workType).toBe('Material alteration');
    expect(closed.endedWithoutDecision).toBe(true);
    expect(closed.milestones[closed.milestones.length - 1]).toMatchObject({
      name: 'Ended with no decision',
      date: '2025-07-28',
      stop: true,
    });
  });

  it('styles a refused decision as a stop', () => {
    const refused = ofKind(
      model(
        withWorks(CEDAR, [
          work({
            startDate: '2025-04-07',
            decisionDate: '2025-09-15',
            outcome: 'Refused',
            milestones: [milestone('Decision', { actual: '2025-09-15' }, 'END', 'Refused')],
          }),
        ]),
      ),
      'work',
    )[0];

    expect(refused.decision).toBe('refused');
    expect(refused.milestones[0]).toMatchObject({ outcome: 'Refused', stop: true });
  });

  it('groups works received on the same day', () => {
    const grouped = model(
      withWorks(CEDAR, [
        work({ title: 'Amendment 3', startDate: '2025-04-07' }),
        work({ workTypeId: 9, workType: 'EAC Extension', startDate: '2025-04-07' }),
      ]),
    );
    const [group] = ofKind(grouped, 'group');

    expect(group).toMatchObject({ title: '2 works received the same day', defaultOpen: true });
    expect(ofKind(grouped, 'work').map((item) => item.parentId)).toEqual([group.id, group.id]);
  });
});

describe('substantial start', () => {
  const substantial = (outcome: string | null, actual = '2026-06-15') =>
    ofKind(
      model(
        withWorks(CEDAR, [
          work({
            workTypeId: 10,
            workType: 'Substantial Start Decision',
            startDate: '2026-01-05',
            milestones: [
              milestone('Notice received', { actual: '2026-01-05' }, 'END'),
              milestone('SubStart Determination Decision', { actual }, 'END', outcome),
            ],
          }),
        ]),
      ),
      'substantialStart',
    )[0];

  it('takes the deadline from the certificate expiry, later than the decision', () => {
    const item = substantial('Project is Substantially Started');

    expect(item).toMatchObject({
      deadline: '2028-03-14T07:00:00.000Z',
      decided: '2026-06-15',
      outcome: 'Substantially started',
    });
  });

  it.each([
    ['Project is Substantially Started', 'Substantially started'],
    ['Project is Not Substantially Started', 'Not substantially started'],
    ['Something else', 'Not yet decided'],
    [null, 'Not yet decided'],
  ])('reads the Track outcome %s as %s', (outcome, label) => {
    expect(substantial(outcome).outcome).toBe(label);
  });

  it('falls back to Eagle, with no deadline, when Track has no such work', () => {
    const item = ofKind(
      model({ ...CERTIFIED_2002, substantially: true, substantiallyDate: '2012-06-01' }),
      'substantialStart',
    )[0];

    expect(item).toMatchObject({ deadline: null, outcome: 'Substantially started' });
  });

  it('draws no row without a certificate in force', () => {
    expect(ofKind(model(CROWN_MOUNTAIN), 'substantialStart')).toEqual([]);
  });
});

describe('a second assessment', () => {
  const twice = model(SECOND_ASSESSMENT);

  it('ends the first assessment as terminated and branches the second', () => {
    const certificates = ofKind(twice, 'certificate');

    expect(certificates.map((item) => [item.title, item.branch])).toEqual([
      ['Assessment terminated', false],
      ['Environmental Assessment Certificate issued', true],
    ]);
    expect(ofKind(twice, 'branchStart')[0]).toMatchObject({
      title: 'Second assessment begins',
      start: '2022-05-02T09:00:00.000Z',
    });
  });

  it('puts the second assessment phases on the branch line', () => {
    expect(
      ofKind(twice, 'phase')
        .filter((item) => item.branch)
        .map((item) => item.title),
    ).toEqual(['Early Engagement', 'Readiness Decision', 'Referral and Decision']);
  });

  it('computes whose time per assessment', () => {
    const [first, second] = ofKind(twice, 'certificate');

    expect(first.whoseTime?.eaoDays).toBe(330);
    expect(second.whoseTime?.eaoDays).toBe(222);
  });

  it('renames the Project lane and adds the second one', () => {
    expect(twice.lanes.map((lane) => lane.label)).toEqual([
      'Legislation',
      'First assessment',
      'Second assessment',
    ]);
    expect(twice.summary).toBe(
      'Re-applied sample · 2018 Act · certificate under the 2018 Act (second assessment) · ' +
        'two assessments · 2 works in Track',
    );
  });
});

const phaseRef = (name: string, legislation: number) => ({
  _id: `ref-${name}`,
  name,
  type: 'projectPhase',
  legislation,
});

/** Listed 1996 then 2002; the 1996 block files its phases under the 2002 List rows. */
const MOVED_FROM_1996: DemiProject = {
  name: 'Moved from the 1996 Act',
  legislation: '2002 Environmental Assessment Act',
  legislationYearList: [1996, 2002],
  currentLegislationYear: 'legislation_2002',
  legislation_1996: { legislation: '1996 Environmental Assessment Act' },
  legislation_2002: { legislation: '2002 Environmental Assessment Act' },
};

describe('Act boundaries', () => {
  // After the 2002 Act came into force (30 Dec 2002), before the recorded move (10 Jan 2005).
  const between = (more: Partial<TimelineInput> = {}, project = MOVED_FROM_1996) =>
    model(
      project,
      [{ id: 'amend', type: 'Amendment Package', displayName: 'A', datePosted: '2004-05-03' }],
      {
        lists: phaseList(2002, 'Pre-EA'),
        projectDocuments: phaseDocuments(2002, 'Pre-EA', 3, '2003-06-02', '2004-06-01'),
        commentPeriods: [
          {
            id: 'cp',
            start: '2004-03-01',
            end: null,
            label: null,
            href: null,
            relatedDocuments: [],
          },
        ],
        ...more,
      },
    );
  const moved = (...legislationTransitions: DemiProject['legislationTransitions'] & object) =>
    between({}, { ...MOVED_FROM_1996, legislationTransitions });
  const acts = (built: TimelineModel) =>
    built.items
      .filter((item) => ['phase', 'document', 'milestone'].includes(item.kind))
      .map((item) => [item.id, item.actYear]);

  it('files what is dated before the recorded move under the old Act', () => {
    expect(acts(moved({ fromYear: 1996, toYear: 2002, date: '2005-01-10' }))).toEqual([
      ['phase-1996-pre-application', 1996],
      ['comment-period-cp', 1996],
      ['document-amend', 1996],
    ]);
  });

  it('starts the new Act on its in-force date when no move is recorded', () => {
    expect(acts(between())).toEqual([
      ['phase-2002-pre-ea', 2002],
      ['comment-period-cp', 2002],
      ['document-amend', 2002],
    ]);
  });

  it('never starts an Act before it was in force, whatever the record says', () => {
    const early = between(
      {
        projectDocuments: [],
        commentPeriods: [
          {
            id: 'cp',
            start: '2002-06-03',
            end: null,
            label: null,
            href: null,
            relatedDocuments: [],
          },
        ],
      },
      {
        ...MOVED_FROM_1996,
        legislationTransitions: [{ fromYear: 1996, toYear: 2002, date: '2001-01-08' }],
      },
    );

    expect(byId(early, 'comment-period-cp')?.actYear).toBe(1996);
  });

  it('skips a record with no date for one that has one', () => {
    const built = moved(
      { fromYear: 1996, toYear: 2002, date: null },
      { fromYear: 1996, toYear: 2002, date: '2005-01-10' },
    );

    expect(built.transitions[0].date).toBe('2005-01-10');
    expect(byId(built, 'comment-period-cp')?.actYear).toBe(1996);
  });

  it('files nothing under a listed Act with no in-force date', () => {
    const built = model(
      {
        name: 'Listed under the Building Canada Act',
        legislation: '2018 Environmental Assessment Act',
        legislationYearList: [2018, 2025],
        currentLegislationYear: 'legislation_2025',
        legislation_2018: { legislation: '2018 Environmental Assessment Act' },
      },
      [{ id: 'amend', type: 'Amendment Package', displayName: 'A', datePosted: '2026-03-02' }],
      {
        commentPeriods: [
          {
            id: 'cp',
            start: '2026-02-02',
            end: null,
            label: null,
            href: null,
            relatedDocuments: [],
          },
        ],
      },
    );

    expect(acts(built)).toEqual([
      ['comment-period-cp', 2018],
      ['document-amend', 2018],
    ]);
  });
});

/** Listed 2002 then 2018, the move recorded on 1 Jan 2021, after the 2018 Act came into force. */
const RECORDED_MOVE: DemiProject = {
  name: 'Recorded move',
  legislation: '2018 Environmental Assessment Act',
  legislationYearList: [2002, 2018],
  currentLegislationYear: 'legislation_2018',
  legislationTransitions: [{ fromYear: 2002, toYear: 2018, date: '2021-01-01' }],
  legislation_2002: { phaseHistory: [phaseRef('Pre-EA', 2002)] },
  legislation_2018: { phaseHistory: [phaseRef('Process Planning', 2018)] },
};

describe('rows dated before the recorded move into their Act', () => {
  const built = model(RECORDED_MOVE, undefined, {
    lists: phaseList(2018, 'Early Engagement'),
    projectDocuments: phaseDocuments(2018, 'Early Engagement', 3, '2020-03-02', '2020-06-01'),
    commentPeriods: [
      // On the day of the move, so before the band that follows it.
      { id: 'cp', start: '2021-01-01', end: null, label: null, href: null, relatedDocuments: [] },
    ],
  });
  const ids = built.items.map((item) => item.id);

  it('list a document-dated phase after the band and the undated rows', () => {
    expect(ids.filter((id) => /^(transition|band|phase)-.*2018/.test(id))).toEqual([
      'transition-2002-2018',
      'band-2018',
      'phase-2018-process-planning',
      'phase-2018-early-engagement',
    ]);
  });

  it('list a comment period after the band of its Act', () => {
    expect(byId(built, 'comment-period-cp')?.actYear).toBe(2018);
    expect(ids.indexOf('comment-period-cp')).toBeGreaterThan(ids.indexOf('band-2018'));
  });
});

describe('phase row ids', () => {
  const withHistory = (...names: string[]): DemiProject => ({
    ...CERTIFIED_2002,
    legislation_2002: {
      ...(CERTIFIED_2002['legislation_2002'] as object),
      phaseHistory: names.map((name) => phaseRef(name, 2002)),
    },
  });

  it('keep a row its id when an earlier row drops out', () => {
    const both = model(withHistory('Pre-EA', 'Application Review'));
    const one = model(withHistory('Application Review'));

    expect(byId(both, 'phase-2002-application-review')?.title).toBe('Application Review');
    expect(byId(one, 'phase-2002-application-review')?.title).toBe('Application Review');
  });

  it.each([
    ['Évaluation spéciale', 'phase-2002-evaluation-speciale'],
    ['Site Visit (2nd)', 'phase-2002-site-visit-2nd'],
    ['???', 'phase-2002-row'],
  ])('key "%s" as %s', (name, id) => {
    expect(byId(model(withHistory(name)), id)?.title).toBe(name);
  });

  it('merge a history name and a document tag that differ only in case', () => {
    const built = model(withHistory('Site Visit'), undefined, {
      lists: phaseList(2002, 'site visit'),
      projectDocuments: phaseDocuments(2002, 'site visit', 2, '2007-01-08', '2007-03-05'),
    });

    expect(
      ofKind(built, 'phase')
        .filter((item) => /site visit/i.test(item.title))
        .map((item) => [item.id, item.documentCount]),
    ).toEqual([['phase-2002-site-visit', 2]]);
  });
});

describe('documents of a stage only the second assessment dates', () => {
  const built = model(SECOND_ASSESSMENT, undefined, {
    lists: phaseList(2018, 'EAC Decision'),
    projectDocuments: phaseDocuments(2018, 'EAC Decision', 3, '2025-07-08', '2025-07-22'),
  });
  const decisionRows = ofKind(built, 'phase').filter(
    (item) => item.title === 'Referral and Decision',
  );

  it('list on the branch row, with no main-line copy dated from them', () => {
    expect(decisionRows.map((item) => item.branch)).toEqual([true]);
    expect(built.documents[decisionRows[0].id].documents).toHaveLength(3);
  });

  it('count the stage as used on the Act', () => {
    expect(
      built.acts[0].rows.find((one) => one.row.name === 'Referral and Decision')?.onProject,
    ).toBe(true);
  });
});

describe('dropped phase tags', () => {
  it('keep the tag of a document no phase row takes', () => {
    const built = model(AJAX, undefined, {
      lists: AJAX_LISTS,
      projectDocuments: [
        ...AJAX_PHASE_DOCUMENTS,
        // Before the 2002 Act was in force: a mis-dated import.
        ...phaseDocuments(2002, 'Pre-EA', 3, '2001-01-08', '2001-06-01'),
      ],
    });

    expect([...built.droppedPhaseTags]).toEqual(['projectPhase-2002-Pre-EA']);
  });
});

describe('useTimelineModel', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: makeQueryClient() }, children);

  const rows = (count: number, from: number) =>
    Array.from({ length: count }, (_, index) =>
      Object.assign(new Document(), {
        _id: `doc-${from + index}`,
        displayName: `Package ${from + index}`,
        type: 'type-package',
        datePosted: new Date('2011-03-07T07:00:00.000Z'),
      }),
    );

  /** Answers a page at a time: the type-filtered read with `amendments`, the full read with both. */
  const serve = (amendments: Document[], phased: Document[] = []) =>
    vi.mocked(readDocuments).mockImplementation(async ({ page, pageSize, filters }) => {
      const all = filters?.['typeId'] ? amendments : [...amendments, ...phased];
      return { rows: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
    });

  beforeEach(() => {
    vi.mocked(readDocuments).mockReset();
    serve(rows(150, 0));
    commentPeriodRows.mockReset();
    commentPeriodRows.mockResolvedValue([]);
  });

  const loaded = async () => {
    const { result } = renderHook(() => useTimelineModel('proj-1'), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    return result.current!;
  };

  it('stops at the 2000 rows an anonymous read reaches and marks the lists incomplete', async () => {
    serve(rows(10, 0), rows(2390, 10));

    const built = await loaded();

    const pages = vi.mocked(readDocuments).mock.calls.map(([query]) => query.page);
    expect(Math.max(...pages)).toBe(20);
    expect(built.documentsComplete).toBe(false);
  });

  it('pages in posting order, so offset pages neither repeat nor skip rows', async () => {
    await loaded();

    const sorts = vi.mocked(readDocuments).mock.calls.map(([query]) => query.sortBy);
    expect(new Set(sorts)).toEqual(new Set(['datePosted']));
  });

  it('reads the amendment documents on their own when the full read is capped', async () => {
    const amendments = rows(10, 5000);
    const others = rows(2390, 0).map((one) => Object.assign(one, { type: 'other' }));
    vi.mocked(readDocuments).mockImplementation(async ({ page, pageSize, filters }) => {
      // The capped full read never reaches the amendments, posted last.
      const all = filters?.['typeId'] ? amendments : [...others, ...amendments];
      return { rows: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
    });

    const built = await loaded();

    expect(ofKind(built, 'document')).toHaveLength(10);
  });

  it('lists a row once when it comes back on two pages', async () => {
    const all = rows(150, 0);
    vi.mocked(readDocuments).mockImplementation(async ({ page }) => ({
      rows: page === 1 ? all.slice(0, 100) : all.slice(99),
      total: 150,
    }));

    const built = await loaded();

    expect(ofKind(built, 'document')).toHaveLength(150);
  });

  it('counts an undated row as read, so the lists stay complete', async () => {
    const undated = Object.assign(new Document(), { _id: 'doc-undated', displayName: 'Undated' });
    serve([...rows(2, 0), undated]);

    const built = await loaded();

    expect(built.documentsComplete).toBe(true);
  });

  it('flags the project and amendment document reads that failed', async () => {
    vi.mocked(readDocuments).mockRejectedValue(new Error('gateway down'));

    const built = await loaded();

    expect(built).toMatchObject({
      documentsFailed: true,
      documentsComplete: false,
      amendmentsFailed: true,
      commentPeriodsFailed: false,
    });
  });

  it('flags a failed comment period read on its own', async () => {
    commentPeriodRows.mockRejectedValue(new Error('gateway down'));

    const built = await loaded();

    expect(built).toMatchObject({ commentPeriodsFailed: true, documentsFailed: false });
  });

  it('reads an end at the epoch or before the start as no end', async () => {
    commentPeriodRows.mockResolvedValue([
      { _id: 'epoch', dateStarted: '2010-03-01T08:00:00.000Z', dateCompleted: '1970-01-01' },
      {
        _id: 'backwards',
        dateStarted: '2010-05-03T07:00:00.000Z',
        dateCompleted: '2010-04-01T07:00:00.000Z',
      },
      {
        _id: 'dated',
        dateStarted: '2010-06-01T07:00:00.000Z',
        dateCompleted: '2010-07-02T07:00:00.000Z',
      },
    ]);

    const built = await loaded();

    expect(
      ofKind(built, 'milestone')
        .filter((item) => item.commentPeriod)
        .map((item) => [item.id, item.end]),
    ).toEqual([
      ['comment-period-epoch', null],
      ['comment-period-backwards', null],
      ['comment-period-dated', '2010-07-02T07:00:00.000Z'],
    ]);
  });

  it('is null while loading, then reads every page of amendment documents', async () => {
    const { result } = renderHook(() => useTimelineModel('proj-1'), { wrapper });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(ofKind(result.current!, 'document')).toHaveLength(150);
    expect(ofKind(result.current!, 'document')[0].title).toBe('Amendment Package');
  });

  it('keeps the dated documents when one has no datePosted', async () => {
    const undated = Object.assign(new Document(), {
      _id: 'doc-undated',
      displayName: 'Undated package',
      type: 'type-package',
    });
    serve([...rows(2, 0), undated]);
    const { result } = renderHook(() => useTimelineModel('proj-1'), { wrapper });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(ofKind(result.current!, 'document').map((item) => item.id)).toEqual([
      'document-doc-0',
      'document-doc-1',
    ]);
  });

  it('dates a 2002 phase from the documents filed under it', async () => {
    const referral = rows(2, 0).map((document, index) =>
      Object.assign(document, {
        type: 'other',
        projectPhase: 'phase-referral',
        datePosted: new Date(index ? '2008-06-02T07:00:00.000Z' : '2008-01-15T08:00:00.000Z'),
      }),
    );
    serve(rows(1, 0), referral);
    const { result } = renderHook(() => useTimelineModel('proj-1'), { wrapper });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(
      ofKind(result.current!, 'phase').find((item) => item.title === 'Referral'),
    ).toMatchObject({
      start: '2008-01-15T08:00:00.000Z',
      end: '2008-06-02T07:00:00.000Z',
      documentCount: 2,
    });
  });
});
