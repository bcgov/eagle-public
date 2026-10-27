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
  AMENDMENT_DOCUMENTS,
  CEDAR,
  CERTIFIED_2002,
  CROWN_MOUNTAIN,
  SECOND_ASSESSMENT,
  TODAY,
  TRANSITIONED,
  milestone,
  work,
} from './timeline.fixture';
import {
  buildTimelineModel,
  useTimelineModel,
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
    ],
  }),
}));

vi.mock('app/api/document', async (importOriginal) => ({
  ...(await importOriginal<typeof import('app/api/document')>()),
  readDocuments: vi.fn(),
}));

function model(project: DemiProject, documents = AMENDMENT_DOCUMENTS.slice(0, 0)) {
  return buildTimelineModel({ project, documents, lists: [], today: TODAY });
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
    expect(byId(transitioned, 'phase-2002-0')?.actYear).toBe(2002);
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

  beforeEach(() => {
    vi.mocked(readDocuments).mockReset();
    vi.mocked(readDocuments)
      .mockResolvedValueOnce({ rows: rows(100, 0), total: 150 })
      .mockResolvedValueOnce({ rows: rows(50, 100), total: 150 });
  });

  it('is null while loading, then reads every page of amendment documents', async () => {
    const { result } = renderHook(() => useTimelineModel('proj-1'), { wrapper });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(ofKind(result.current!, 'document')).toHaveLength(150);
    expect(ofKind(result.current!, 'document')[0].title).toBe('Amendment Package');
  });
});
