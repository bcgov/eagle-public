import { describe, it, expect } from 'vitest';
import {
  actYear,
  offRailPhase,
  phaseSetYear,
  simplifiedStages,
  stageRowFor,
  stageSetFor,
  trackPhaseStyle,
  withPhaseDates,
} from './assessment-stages';
import type { Project } from 'app/models/project';
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

  it('takes the default Act for a label the registry does not hold', () => {
    expect(phaseSetYear(makeProject(null, 2018, 2031))).toBe(2018);
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

describe('actYear', () => {
  function withLegislation(legislation: string | undefined): Project {
    return { ...makeProject(null), legislation } as Project;
  }

  it.each([
    ['1996 Environmental Assessment Act', 1996],
    ['2002 Environmental Assessment Act', 2002],
    ['2018 Environmental Assessment Act', 2018],
    ['Building Canada Act', 2025],
  ])('reads %s as %i', (legislation, year) => {
    expect(actYear(withLegislation(legislation))).toBe(year);
  });

  it.each([
    '2031 Environmental Assessment Act',
    'Environmental Assessment Act',
    'Bill 12018',
    '',
    undefined,
  ])('is not a year for legislation %j', (legislation) => {
    expect(actYear(withLegislation(legislation))).toBeNaN();
  });

  it('is not a year with no project', () => {
    expect(actYear(null)).toBeNaN();
  });
});

describe('withPhaseDates', () => {
  const project = makeProject('Process Planning');
  const simple = (phases = PHASES) => withPhaseDates(simplifiedStages(LISTS, project), phases);

  function byName<T extends { name: string }>(stages: T[]): Record<string, T> {
    return Object.fromEntries(stages.map((stage) => [stage.name, stage]));
  }

  it('collapses the Track phases a simplified stage rolls up', () => {
    const stages = byName(simple());

    // Early Engagement plus the proponent time after it: earliest start, latest end.
    expect(stages['Early Engagement'].dates).toBe('Jul 2025 – Jun 2026');
    expect(stages['Application Development and Review'].dates).toBe('Nov 2026 – Oct 2027');
    expect(stages['Effects Assessment'].dates).toBe('Jan – Jun 2028');
    expect(stages['Referral'].dates).toBe('Jun – Jul 2028');
    // Project Designation is before the first Track phase, so it stays blank.
    expect(stages['Project Designation'].dates).toBeUndefined();
  });

  it.each(['Pre-EA (EAC Assessment)', 'Post-EAC Document Review'])(
    'ignores the phase named %s',
    (name) => {
      const kept = PHASES.filter((phase) => phase.name !== 'Pre-EA (EAC Assessment)');
      const extra = { name, startDate: '2024-01-01', endDate: '2024-02-01' };

      expect(simple([extra, ...kept])).toEqual(simple(kept));
    },
  );

  it('labels an open stage from its start date alone', () => {
    const stages = simple([
      { name: 'Process Planning', startDate: '2026-07-12T09:00:00.000Z', endDate: null },
    ]);

    expect(byName(stages)['Process Planning'].dates).toBe('Since Jul 2026');
  });

  it('leaves a stage alone when its phase carries no dates', () => {
    const stages = simple([{ name: 'Process Planning', startDate: null, endDate: null }]);

    expect(byName(stages)['Process Planning'].dates).toBeUndefined();
  });

  it('changes nothing without phases', () => {
    const stages = simplifiedStages(LISTS, project);

    expect(withPhaseDates(stages, null)).toBe(stages);
    expect(withPhaseDates(stages, [])).toBe(stages);
  });
});

describe('stageSetFor', () => {
  const names = (year: number) => stageSetFor(year).map((row) => row.name);

  it('draws the 1996 Act from the EA 101 phases, each with its own steps', () => {
    expect(names(1996)).toEqual([
      'Pre-Application',
      'Application Review',
      'Referral',
      'Post Decision',
    ]);
    expect(stageSetFor(1996)[0].steps).toEqual([
      'Application for a PAC',
      'Draft Project Report Specifications',
    ]);
    expect(stageSetFor(1996)[2].steps).toEqual([
      'Referral to Ministers',
      "Ministers' PAC Decision Issued/Refused",
    ]);
  });

  it('keeps the 2002 Act phases apart from the 1996 ones', () => {
    expect(names(2002)).toEqual([
      'Pre-EA',
      'Pre-Application',
      'Evaluation',
      'Application Review',
      'Referral',
      'Post Decision',
    ]);
  });

  it('merges the 2018 rows Track dates as one phase each', () => {
    expect(names(2018)).toEqual([
      'Early Engagement',
      'Readiness Decision',
      'Process Planning',
      'Application Development and Review',
      'Effects Assessment and Recommendation',
      'Referral and Decision',
      'Post Decision',
    ]);
  });

  it('has no set for an Act with no phases', () => {
    expect(stageSetFor(2025)).toEqual([]);
  });
});

describe('stageRowFor', () => {
  it.each([
    ['Early Engagement', 'Early Engagement'],
    ['Readiness Decision', 'Readiness Decision'],
    ['Process Planning', 'Process Planning'],
    ['EAC Application Review', 'Application Development and Review'],
    ['Effects Assessment & Recommendation', 'Effects Assessment and Recommendation'],
    ['EAC Decision', 'Referral and Decision'],
  ])('maps the Track phase %s to the 2018 row %s', (track, row) => {
    expect(stageRowFor(2018, track)?.name).toBe(row);
  });

  it.each([
    ['Pre-EA', 'Pre-Application'],
    ['Pre-Application', 'Pre-Application'],
    ['Evaluation', 'Application Review'],
    ['Application Review', 'Application Review'],
    ['Referral', 'Referral'],
    ['Post Decision - Amendment', 'Post Decision'],
  ])('maps the stored 2002 name %s onto the 1996 row %s', (stored, row) => {
    expect(stageRowFor(1996, stored)?.name).toBe(row);
  });

  it('keeps a 2002 name on its own 2002 row', () => {
    expect(stageRowFor(2002, 'Evaluation')?.name).toBe('Evaluation');
  });

  it('finds no row for a name the Act does not hold', () => {
    expect(stageRowFor(2018, 'Pre-EA (EAC Assessment)')).toBeNull();
    expect(stageRowFor(2002, 'Further Assessment')).toBeNull();
  });
});

describe('trackPhaseStyle', () => {
  it.each([
    'DPD Development (Proponent Time)',
    'EAC Application Development (Proponent Time)',
    'Revised EAC Application Development (Proponent Time)',
  ])('puts %s on the proponent clock in grey', (name) => {
    expect(trackPhaseStyle(name)).toEqual({
      owner: 'proponent',
      token: '--eao-proponent-dark',
      hex: '#6d7274',
    });
  });

  it("gives an EAO phase its row's fill", () => {
    expect(trackPhaseStyle('Effects Assessment & Recommendation')).toEqual({
      owner: 'eao',
      token: '--eao-effects-assessment-dark',
      hex: '#e7a913',
    });
  });

  it('has no style for a phase Track names that the stages do not hold', () => {
    expect(trackPhaseStyle('Pre-EA (EAC Assessment)')).toBeNull();
  });
});
