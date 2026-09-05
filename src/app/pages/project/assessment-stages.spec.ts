import { describe, it, expect } from 'vitest';
import {
  DETAILED_STAGES,
  EAO_DAYS,
  TOTAL_DAYS,
  YEAR_TICKS,
  detailedStages,
  durationLabel,
  layout,
  offRailPhase,
  phaseSetYear,
  simplifiedStages,
  withPhaseDates,
} from './assessment-stages';
import { LISTS, PHASES, makeProject } from './assessment-stages.fixture';

const SIMPLE_2018 = [
  'Project Designation',
  'Early Engagement',
  'Readiness Decision',
  'Process Planning',
  'Application Development and Review',
  'Effects Assessment',
  'Referral',
  'Post decision',
];

const SIMPLE_2002 = [
  'Pre-EA',
  'Pre-Application',
  'Evaluation',
  'Application Review',
  'Further Assessment',
  'Referral',
  'Post decision',
];

describe('detailed stage table', () => {
  it('holds the ten Track 2018 stages and their day totals', () => {
    expect(DETAILED_STAGES).toHaveLength(10);
    expect(DETAILED_STAGES.reduce((sum, s) => sum + (s.statutoryDays ?? 0), 0)).toBe(TOTAL_DAYS);
    expect(TOTAL_DAYS).toBe(2455);
    expect(EAO_DAYS).toBe(630);
  });

  it('stripes only the three proponent-time stages', () => {
    expect(DETAILED_STAGES.filter((s) => s.provisional).map((s) => s.n)).toEqual([2, 5, 7]);
    expect(DETAILED_STAGES.filter((s) => s.owner === 'proponent').map((s) => s.n)).toEqual([
      2, 5, 7,
    ]);
  });

  it('places the year ticks against the total timeline', () => {
    expect(YEAR_TICKS.map((t) => t.label)).toEqual(['Start', '1y', '2y', '3y', '4y', '5y', '6y']);
    expect(YEAR_TICKS[0].left).toBe(0);
    expect(YEAR_TICKS[1].left).toBeCloseTo(14.87, 2);
    expect(YEAR_TICKS[6].left).toBeCloseTo(89.21, 2);
  });
});

describe('phaseSetYear', () => {
  it('takes the phase row legislation, so a 2002 Act project in a 2018 phase reads 2018', () => {
    expect(phaseSetYear(makeProject('Complete', 2018, 2002))).toBe(2018);
    expect(phaseSetYear(makeProject('Application Review', 2002))).toBe(2002);
  });

  it('falls back to the Act, mapping 1996 onto the 2002 phases', () => {
    expect(phaseSetYear(makeProject(null, 2018, 1996))).toBe(2002);
    expect(phaseSetYear(makeProject(null, 2018, 2002))).toBe(2002);
    expect(phaseSetYear(null)).toBe(2018);
  });
});

describe('layout', () => {
  it('lays the stages end to end across the full width', () => {
    const laid = layout(DETAILED_STAGES);

    expect(laid[0].start).toBe(0);
    expect(laid[0].width).toBeCloseTo((90 / 2455) * 100, 6);
    expect(laid[9].start + laid[9].width).toBeCloseTo(100, 6);
  });

  it('scales a finished stage to its elapsed days and leaves the rest statutory', () => {
    const stages = DETAILED_STAGES.map((stage, index) =>
      index === 0 ? { ...stage, state: 'done' as const, elapsedDays: 200 } : stage,
    );

    const laid = layout(stages);

    expect(laid[0].days).toBe(200);
    expect(laid[1].days).toBe(365);
    expect(laid[1].start).toBeCloseTo((200 / 2565) * 100, 6);
  });

  it('ignores elapsed days on a stage that is not finished', () => {
    const laid = layout([{ ...DETAILED_STAGES[0], state: 'current', elapsedDays: 200 }]);

    expect(laid[0].days).toBe(90);
  });
});

describe('detailedStages', () => {
  it.each([
    ['Early Engagement', 0, 1],
    ['Readiness Decision', 2, 2],
    ['Process Planning', 3, 3],
    ['Effects Assessment', 7, 8],
    ['Referral', 9, 9],
  ])('maps %s to stages %i-%i', (phase, first, last) => {
    const states = detailedStages(makeProject(phase)).map((s) => s.state);

    expect(states.indexOf('current')).toBe(first);
    expect(states.lastIndexOf('current')).toBe(last);
    expect(states.slice(0, first).every((s) => s === 'done')).toBe(true);
    expect(states.slice(last + 1).every((s) => s === 'upcoming')).toBe(true);
  });

  it('splits done, current and upcoming around the project phase', () => {
    const states = detailedStages(makeProject('Application Development and Review')).map(
      (s) => s.state,
    );

    expect(states).toEqual([
      'done',
      'done',
      'done',
      'done',
      'current',
      'current',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('marks every stage done once the project is past decision', () => {
    for (const phase of ['Post Decision - Amendment', 'Complete']) {
      expect(detailedStages(makeProject(phase)).map((s) => s.state)).toEqual(
        Array(10).fill('done'),
      );
    }
  });

  it('starts nothing while the project is still in Project Designation', () => {
    expect(detailedStages(makeProject('Project Designation')).map((s) => s.state)).toEqual(
      Array(10).fill('upcoming'),
    );
  });
});

describe('simplifiedStages', () => {
  it('collapses the post-decision phases and drops Other', () => {
    const stages = simplifiedStages(LISTS, makeProject('Process Planning'));

    expect(stages.map((s) => s.name)).toEqual(SIMPLE_2018);
    expect(stages.map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('marks the collapsed post-decision stage current for any of its phases', () => {
    const stages = simplifiedStages(LISTS, makeProject('Post Decision - Suspension'));

    expect(stages.map((s) => s.state)).toEqual([...Array(7).fill('done'), 'current']);
    // every Post Decision row plus Complete and the certificate transfer
    expect(stages[7].id.split(' ')).toHaveLength(11);
  });

  it('reads the 2002 rows and leaves Termination and Withdrawal off the rail', () => {
    const stages = simplifiedStages(LISTS, makeProject('Application Review', 2002));

    expect(stages.map((s) => s.name)).toEqual(SIMPLE_2002);
    expect(stages.map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    // no 2002 colour map, so the palette fills in list order
    expect(stages[0].hex).toBe('#54858d');
    expect(stages[3].hex).toBe('#4d95d0');
  });

  it('uses the 2002 rail for a 1996 Act project', () => {
    expect(simplifiedStages(LISTS, makeProject(null, 2018, 1996)).map((s) => s.name)).toEqual(
      SIMPLE_2002,
    );
  });

  it('uses the 2018 rail for a 2002 Act project sitting in the 2018 Complete phase', () => {
    const stages = simplifiedStages(LISTS, makeProject('Complete', 2018, 2002));

    expect(stages.map((s) => s.name)).toEqual(SIMPLE_2018);
    expect(stages[7].state).toBe('current');
  });

  it('leaves every stage upcoming for a withdrawn project', () => {
    const stages = simplifiedStages(LISTS, makeProject('Withdrawal', 2002));

    expect(stages.map((s) => s.name)).toEqual(SIMPLE_2002);
    expect(stages.map((s) => s.state)).toEqual(Array(7).fill('upcoming'));
  });

  it('leaves every stage upcoming when the project has no current phase', () => {
    expect(simplifiedStages(LISTS, makeProject(null)).map((s) => s.state)).toEqual(
      Array(8).fill('upcoming'),
    );
  });
});

describe('offRailPhase', () => {
  it.each(['Other', 'Termination', 'Withdrawal'])('names %s', (phase) => {
    expect(offRailPhase(makeProject(phase, 2002))).toBe(phase);
  });

  it('is null for a phase on the rail', () => {
    expect(offRailPhase(makeProject('Process Planning'))).toBeNull();
    expect(offRailPhase(makeProject('Post Decision - Construction'))).toBeNull();
  });
});

describe('withPhaseDates', () => {
  const project = makeProject('Effects Assessment');
  const detailed = () => withPhaseDates(detailedStages(project), PHASES);
  const simple = () => withPhaseDates(simplifiedStages(LISTS, project), PHASES);

  function byName<T extends { name: string }>(stages: T[]): Record<string, T> {
    return Object.fromEntries(stages.map((stage) => [stage.name, stage]));
  }

  it('matches Track names through case, punctuation and & against and', () => {
    const stages = byName(detailed());

    expect(stages['Early Engagement'].dates).toBe('Aug 2020 – Jan 2021');
    expect(stages['Proponent time: project description'].dates).toBe('Jan – Mar 2021');
    expect(stages['Application Development and Review'].dates).toBe('Aug – Sep 2022');
  });

  it.each(['Referral/Decision', 'EA Certificate Decision'])(
    'matches the last stage against Track name %s',
    (name) => {
      const stages = withPhaseDates(detailedStages(makeProject('Referral')), [
        { name, startDate: '2023-03-01T00:00:00.000Z', endDate: '2023-03-20T00:00:00.000Z' },
      ]);

      expect(byName(stages)['Referral / Decision'].dates).toBe('Mar 2023');
    },
  );

  it('collapses the Track phases a simplified stage rolls up', () => {
    const stages = byName(simple());

    // Early Engagement plus the proponent time after it: earliest start, latest end.
    expect(stages['Early Engagement'].dates).toBe('Aug 2020 – Mar 2021');
    expect(stages['Early Engagement'].elapsedDays).toBe(242);
    expect(stages['Application Development and Review'].dates).toBe('Dec 2021 – Dec 2022');
  });

  it('measures a finished stage but not a current or unfinished one', () => {
    const stages = byName(detailed());

    expect(stages['Early Engagement'].elapsedDays).toBe(167);
    expect(stages['Readiness Decision'].elapsedDays).toBe(27);
    expect(stages['Effects Assessment'].state).toBe('current');
    expect(stages['Effects Assessment'].elapsedDays).toBeUndefined();
  });

  it('labels an open stage from its start date alone', () => {
    expect(byName(detailed())['Effects Assessment'].dates).toBe('Since Feb 2023');
  });

  it('draws a finished stage at its real length and the rest at the statutory maximum', () => {
    const laid = byName(layout(detailed()));

    expect(laid['Early Engagement'].days).toBe(167);
    expect(laid['Recommendation'].days).toBe(40);
  });

  it('leaves a stage alone when its phase carries no dates', () => {
    const stages = withPhaseDates(detailedStages(project), [
      { name: 'Process Planning', startDate: null, endDate: null },
    ]);

    expect(byName(stages)['Process Planning'].dates).toBeUndefined();
  });

  it('ignores phases and stages that do not pair up', () => {
    const stages = byName(
      withPhaseDates(detailedStages(project), [
        { name: 'Post-EAC Document Review', startDate: '2024-01-01', endDate: '2024-02-01' },
        ...PHASES,
      ]),
    );

    expect(stages['Recommendation'].dates).toBeUndefined();
    expect(stages['Early Engagement'].dates).toBe('Aug 2020 – Jan 2021');
  });

  it.each([
    ['Readiness Decision', 'Apr 2021'],
    ['Process Planning', 'Sep – Nov 2021'],
  ])('shortens the label for %s within one month or year', (name, label) => {
    expect(byName(detailed())[name].dates).toBe(label);
  });

  it('changes nothing without phases', () => {
    const stages = detailedStages(project);

    expect(withPhaseDates(stages, null)).toBe(stages);
    expect(withPhaseDates(stages, [])).toBe(stages);
  });
});

describe('durationLabel', () => {
  it.each([
    [365, '1 year'],
    [1095, '3 years'],
    [120, '120 days'],
    [30, '30 days'],
    [0, '0 days'],
  ])('labels %i days', (days, label) => {
    expect(durationLabel(days)).toBe(label);
  });
});
