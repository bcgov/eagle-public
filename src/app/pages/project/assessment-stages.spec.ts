import { describe, it, expect } from 'vitest';
import {
  AMENDMENT_STAGE,
  DETAILED_STAGES,
  EAO_DAYS,
  TOTAL_DAYS,
  YEAR_TICKS,
  detailedStages,
  durationLabel,
  inkFor,
  layout,
  simplifiedStages,
} from './assessment-stages';
import { LISTS, makeProject } from './assessment-stages.fixture';

const SIMPLE_2018 = [
  'Early Engagement',
  'EA Readiness Decision',
  'Process Planning',
  'Application Development & Review',
  'Effects Assessment',
  'Referral',
  'Post decision',
];

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `inkFor` returns a CSS var with a hex fallback; the fallback is what a contrast check needs. */
function inkHex(hex: string): string {
  return inkFor(hex).match(/#[0-9a-f]{6}/i)![0];
}

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
  it('splits done, current and upcoming around the project phase', () => {
    const states = detailedStages(makeProject('Application Development & Review')).map(
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
});

describe('simplifiedStages', () => {
  it('collapses the post-decision phases and drops Other', () => {
    const stages = simplifiedStages(LISTS, makeProject('Process Planning'));

    expect(stages.map((s) => s.name)).toEqual(SIMPLE_2018);
    expect(stages.map((s) => s.state)).toEqual([
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

    expect(stages.map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
      'done',
      'current',
    ]);
    expect(stages[6].id.split(' ')).toHaveLength(10);
  });

  it('reads the 2002 rows for a 2002 project', () => {
    const stages = simplifiedStages(LISTS, makeProject('Application Review', '2002'));

    expect(stages.map((s) => s.name)).toEqual([
      'Pre-Application',
      'Application Review',
      'Referral',
      'Post decision',
    ]);
    expect(stages.map((s) => s.state)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    // no 2002 colour map, so the palette fills in order
    expect(stages[0].hex).toBe('#54858d');
    expect(stages[1].hex).toBe('#da6d65');
  });

  it('leaves every stage upcoming when the project has no current phase', () => {
    const stages = simplifiedStages(LISTS, makeProject(null));

    expect(stages.map((s) => s.state)).toEqual(Array(7).fill('upcoming'));
  });
});

describe('inkFor', () => {
  it.each([
    ['#54858d', '#ffffff'],
    ['#043673', '#ffffff'],
    ['#3c6e47', '#ffffff'],
    ['#6D7274', '#ffffff'],
    ['#da6d65', '#2d2d2d'],
    ['#3EB1D7', '#2d2d2d'],
    ['#e7a913', '#2d2d2d'],
    ['#EDB6B2', '#2d2d2d'],
  ])('picks ink for %s', (fill, ink) => {
    expect(inkHex(fill)).toBe(ink);
  });

  it('keeps every shipped fill at 3:1 or better against its ink', () => {
    const fills = new Set(
      [
        ...DETAILED_STAGES,
        AMENDMENT_STAGE,
        ...simplifiedStages(LISTS, makeProject('Process Planning')),
        ...simplifiedStages(LISTS, makeProject('Application Review', '2002')),
      ].map((stage) => stage.hex),
    );

    expect(fills.size).toBeGreaterThan(9);
    for (const fill of fills) {
      expect(contrast(fill, inkHex(fill))).toBeGreaterThanOrEqual(3);
    }
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
