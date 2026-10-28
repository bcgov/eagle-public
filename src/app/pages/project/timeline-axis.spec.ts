import { describe, it, expect } from 'vitest';
import {
  DAY,
  axisTicks,
  fullRange,
  packRows,
  phaseFill,
  time,
  visibleRange,
} from './timeline-axis';
import { CEDAR, TODAY } from './timeline.fixture';
import { buildTimelineModel, type PhaseItem, type WorkItem } from './use-timeline-model';

const FROM = Date.UTC(2000, 0, 1);

function monthsBetweenTicks(years: number): number {
  const [first, second] = axisTicks({ from: FROM, to: FROM + years * 365.25 * DAY }, 0);
  const a = new Date(first.time);
  const b = new Date(second.time);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
}

describe('axisTicks', () => {
  it.each([
    [1, 1],
    [2, 3],
    [5, 12],
    [10, 24],
    [20, 60],
  ])('ticks a %i-year span every %i months', (years, months) => {
    expect(monthsBetweenTicks(years)).toBe(months);
  });

  it('labels January with the year and other months by name', () => {
    const labels = axisTicks({ from: FROM, to: FROM + 365 * DAY }, 0).map((tick) => tick.label);

    expect(labels.slice(0, 3)).toEqual(['2000', 'Feb', 'Mar']);
  });

  it('leaves out a tick that would sit on the Today label', () => {
    const today = Date.UTC(2000, 5, 2);
    const labels = axisTicks({ from: FROM, to: FROM + 365 * DAY }, today).map((tick) => tick.label);

    expect(labels).not.toContain('Jun');
  });
});

describe('time', () => {
  it('reads an Eagle epoch date as no date, as the model does', () => {
    expect(time('1969-12-31T08:00:00.000Z')).toBeNull();
  });
});

const cedar = buildTimelineModel({ project: CEDAR, documents: [], lists: [], today: TODAY });

describe('phaseFill', () => {
  const phases = buildTimelineModel({
    project: CEDAR,
    documents: [],
    lists: [],
    today: TODAY,
  }).items.filter((item): item is PhaseItem => item.kind === 'phase');
  const [phase] = phases;
  const other = phases.find((item) => item.row && item.row.token !== phase.row?.token)!.row!;

  it('colours a phase by its stage row over its name', () => {
    expect(phaseFill({ ...phase, row: other })).toBe(`var(${other.token}, ${other.hex})`);
  });

  it('colours a phase with no row by its Track stage name', () => {
    expect(phaseFill({ ...phase, row: null })).toBe(phaseFill(phase));
  });

  it('greys a phase no stage matches', () => {
    expect(phaseFill({ ...phase, row: null, title: 'Unknown step' })).toBe('var(--theme-gray-60)');
  });
});

describe('packRows', () => {
  const finished = cedar.items.find(
    (item): item is WorkItem => item.kind === 'work' && !item.plannedDecision,
  )!;
  const at = (start: string, end: string): WorkItem => ({ ...finished, start, end });

  it('stacks overlapping works and reuses a row once it is free', () => {
    const rows = packRows(
      [
        at('2020-01-01', '2020-06-01'),
        at('2020-03-01', '2020-09-01'),
        at('2020-07-01', '2020-08-01'),
      ],
      Date.UTC(2026, 0, 1),
    ).map(({ row }) => row);

    expect(rows).toEqual([0, 1, 0]);
  });

  it('puts a work that starts the day another ends on a new row', () => {
    const rows = packRows(
      [at('2020-01-01', '2020-06-01'), at('2020-06-01', '2020-09-01')],
      Date.UTC(2026, 0, 1),
    ).map(({ row }) => row);

    expect(rows).toEqual([0, 1]);
  });
});

const full = fullRange(cedar);

describe('fullRange', () => {
  it('runs the whole life from 1 January of the first dated year', () => {
    expect(new Date(full.from).toISOString().slice(0, 10)).toBe('2020-01-01');
  });

  it('ends the whole life on the month start five months past the planned decision', () => {
    expect(new Date(full.to).toISOString().slice(0, 10)).toBe('2027-08-01');
  });
});

describe('visibleRange', () => {
  it('never zooms closer than a year', () => {
    const visible = visibleRange(full, { center: full.from + 1000 * DAY, span: 30 * DAY });

    expect(visible.span).toBe(365 * DAY);
  });

  it('keeps a view at the edge inside the whole life', () => {
    const visible = visibleRange(full, { center: full.from, span: 365 * DAY });

    expect(visible.from).toBe(full.from);
  });
});
