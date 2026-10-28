import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { DemiProject } from 'app/api/api';
import {
  CEDAR,
  CERTIFIED_2002,
  SECOND_ASSESSMENT,
  TODAY,
  TRANSITIONED,
  milestone,
  work,
} from './timeline.fixture';
import { TimelineStrip } from './timeline-strip';
import { buildTimelineModel, type TimelineItem, type TimelineModel } from './use-timeline-model';

function modelOf(project: DemiProject): TimelineModel {
  return buildTimelineModel({ project, documents: [], lists: [], today: TODAY });
}

// The strip is aria-hidden decoration, so it has no accessible surface to query by role.
function renderStrip(
  model: TimelineModel,
  { selectedId = null, dimmedIds }: { selectedId?: string | null; dimmedIds?: Set<string> } = {},
) {
  const { container } = render(
    <TimelineStrip model={model} selectedId={selectedId} dimmedIds={dimmedIds} />,
  );
  const strip = container.firstElementChild as HTMLElement;
  const mark = (id: string) => {
    const found = strip.querySelector<HTMLElement>(`[data-item="${id}"]`);
    if (!found) throw new Error(`no mark for ${id}`);
    return found;
  };
  const drawnIds = [...strip.querySelectorAll('[data-item]')].map((el) =>
    el.getAttribute('data-item'),
  );
  return { strip, mark, drawnIds };
}

function find(model: TimelineModel, test: (item: TimelineItem) => boolean): TimelineItem {
  const item = model.items.find(test);
  if (!item) throw new Error('no such item in the fixture');
  return item;
}

const titled = (model: TimelineModel, title: string) =>
  find(model, (item) => item.title === title).id;

describe('TimelineStrip', () => {
  it('hides the whole strip from assistive technology', () => {
    const { strip } = renderStrip(modelOf(CEDAR));

    expect(strip).toHaveAttribute('aria-hidden', 'true');
  });

  it('names in its key the marks it draws, and none it leaves to the lanes', () => {
    const { strip } = renderStrip(modelOf(CEDAR));

    const key = [...strip.querySelectorAll('li')].map((li) => li.textContent);
    expect(key).toEqual([
      'Planned, to the planned decision',
      'Completed',
      'In progress',
      'After the certificate',
      'Today',
    ]);
  });

  it('draws one bar for each dated phase and each work', () => {
    const model = modelOf(CEDAR);
    const barred = model.items
      .filter((item) => item.kind === 'work' || (item.kind === 'phase' && item.start))
      .map((item) => item.id);

    const { drawnIds } = renderStrip(model);

    expect(drawnIds.filter((id) => id && barred.includes(id)).sort()).toEqual(barred.sort());
    expect(new Set(drawnIds).size).toBe(drawnIds.length);
  });

  it('draws the planned part of an open work as a dashed bar, and none on a finished one', () => {
    const model = modelOf(CEDAR);
    const { mark } = renderStrip(model);

    expect(
      mark(titled(model, 'Amendment #3')).querySelector('.timeline-strip__planned'),
    ).not.toBeNull();
    expect(
      mark(titled(model, 'Amendment #1')).querySelector('.timeline-strip__planned'),
    ).toBeNull();
  });

  it('packs works that follow one another into one row', () => {
    const model = modelOf(CEDAR);
    const { mark } = renderStrip(model);

    expect(mark(titled(model, 'Amendment #2')).style.top).toBe(
      mark(titled(model, 'Amendment #1')).style.top,
    );
  });

  it('keeps an open work past its planned decision running to Today, so a later work stacks below', () => {
    const model = modelOf({
      ...CEDAR,
      works: [
        work({
          title: 'Overdue',
          startDate: '2025-01-06',
          isActive: true,
          workState: 'IN_PROGRESS',
          milestones: [milestone('Decision', { anticipated: '2026-03-02' }, 'END')],
        }),
        work({ title: 'Later', startDate: '2026-05-04', decisionDate: '2026-06-01' }),
      ],
    });

    const { mark } = renderStrip(model);
    const overdue = mark(titled(model, 'Overdue'));

    expect(overdue.querySelector('.timeline-strip__planned')).toBeNull();
    expect(mark(titled(model, 'Later')).style.top).not.toBe(overdue.style.top);
  });

  it('puts a second assessment on its own track, hooked to the main line at its start', () => {
    const model = modelOf(SECOND_ASSESSMENT);
    const branchStart = find(model, (item) => item.kind === 'branchStart');
    const firstPhase = find(model, (item) => item.kind === 'phase' && !item.branch);
    const branchPhase = find(model, (item) => item.kind === 'phase' && item.branch);

    const { mark } = renderStrip(model);

    expect(mark(branchStart.id)).toHaveClass('timeline-strip__hook');
    expect(parseFloat(mark(branchPhase.id).style.top)).toBeGreaterThan(
      parseFloat(mark(firstPhase.id).style.top),
    );
  });

  it('starts a new row for a work received the day the previous one was decided', () => {
    const model = modelOf({
      ...CEDAR,
      works: [
        work({ title: 'First', startDate: '2024-01-08', decisionDate: '2024-03-04' }),
        work({ title: 'Same day', startDate: '2024-03-04', decisionDate: '2024-05-06' }),
      ],
    });

    const { mark } = renderStrip(model);

    expect(mark(titled(model, 'Same day')).style.top).not.toBe(
      mark(titled(model, 'First')).style.top,
    );
  });

  it('fills a work decided on the day it was received', () => {
    const model = modelOf({
      ...CEDAR,
      works: [work({ title: 'One day', startDate: '2024-01-08', decisionDate: '2024-01-08' })],
    });

    const { mark } = renderStrip(model);
    const fill = mark(titled(model, 'One day')).querySelector<HTMLElement>(
      '.timeline-strip__work-fill',
    );

    expect(fill?.style.width).toBe('100%');
  });

  it('draws one hatch for an Act with undated phases, ringed when any of them is selected', () => {
    const model = modelOf(CERTIFIED_2002);
    const undated = model.items.filter((item) => item.kind === 'phase' && !item.start);
    expect(undated.length).toBeGreaterThan(1);

    const { strip } = renderStrip(model, { selectedId: undated[undated.length - 1].id });
    const hatches = strip.querySelectorAll('.timeline-strip__undated');

    expect(hatches).toHaveLength(1);
    expect(hatches[0]).toHaveClass('is-selected');
  });

  it('fades the hatch only when every undated phase it stands for is filtered out', () => {
    const model = modelOf(CERTIFIED_2002);
    const undated = model.items
      .filter((item) => item.kind === 'phase' && !item.start)
      .map((item) => item.id);
    const hatchOf = (dimmed: string[]) =>
      renderStrip(model, { dimmedIds: new Set(dimmed) }).strip.querySelector(
        '.timeline-strip__undated',
      );

    expect(hatchOf(undated.slice(0, -1))).not.toHaveClass('is-dimmed');
    expect(hatchOf(undated)).toHaveClass('is-dimmed');
  });

  it('leaves an open work that has not started yet unfilled, its planned part from its start', () => {
    const model = modelOf({
      ...CEDAR,
      works: [
        work({
          title: 'Not started',
          startDate: '2027-01-04',
          isActive: true,
          workState: 'IN_PROGRESS',
          milestones: [milestone('Decision', { anticipated: '2027-06-07' }, 'END')],
        }),
      ],
    });

    const { mark } = renderStrip(model);
    const bar = mark(titled(model, 'Not started'));

    expect(bar.querySelector<HTMLElement>('.timeline-strip__work-fill')?.style.width).toBe('0%');
    expect(bar.querySelector<HTMLElement>('.timeline-strip__planned')?.style.left).toBe('0%');
  });

  it('leaves an open work that has not started and has no planned date unfilled', () => {
    const model = modelOf({
      ...CEDAR,
      works: [
        work({
          title: 'Not started',
          startDate: '2027-01-04',
          isActive: true,
          workState: 'IN_PROGRESS',
          milestones: [milestone('Received', { actual: '2027-01-04' }, 'START')],
        }),
      ],
    });

    const { mark } = renderStrip(model);
    const fill = mark(titled(model, 'Not started')).querySelector<HTMLElement>(
      '.timeline-strip__work-fill',
    );

    expect(fill?.style.width).toBe('0%');
  });

  it('draws a refused substantial start in the danger style', () => {
    const model = modelOf({
      ...CEDAR,
      works: [
        work({
          workTypeId: 10,
          workType: 'Substantial start',
          milestones: [
            milestone(
              'SubStart Determination Decision',
              { actual: '2026-06-15' },
              'END',
              'Project is Not Substantially Started',
            ),
          ],
        }),
      ],
    });
    const substantial = find(model, (item) => item.kind === 'substantialStart');

    const { mark } = renderStrip(model);

    expect(mark(substantial.id).querySelector('.timeline-strip__diamond--refused')).not.toBeNull();
  });

  it('puts the diamond of a substantial start with only a decision date on that date', () => {
    const model = modelOf({
      ...CEDAR,
      eacExpires: undefined,
      works: [
        work({
          workTypeId: 10,
          workType: 'Substantial start',
          milestones: [
            milestone(
              'SubStart Determination Decision',
              { actual: '2026-06-15' },
              'END',
              'Project is Substantially Started',
            ),
          ],
        }),
      ],
    });
    const substantial = find(model, (item) => item.kind === 'substantialStart');

    const { mark } = renderStrip(model);

    expect(
      mark(substantial.id).querySelector<HTMLElement>('.timeline-strip__diamond')?.style.left,
    ).toBe('0%');
  });

  it('shows the first year under the strip when Today is not near its start', () => {
    const { strip } = renderStrip(modelOf(CEDAR));

    expect(strip.querySelector('.timeline-strip__labels')?.textContent).toContain('2020');
  });

  it('drops the first-year label when Today sits at the left end, so the two do not overlap', () => {
    const model = modelOf({
      ...SECOND_ASSESSMENT,
      // No certificate and no assessments, so the life starts this year.
      eaCertificate: undefined,
      works: [
        work({
          title: 'Long open work',
          startDate: '2026-03-02',
          isActive: true,
          workState: 'IN_PROGRESS',
          milestones: [milestone('Decision', { anticipated: '2034-06-05' }, 'END')],
        }),
      ],
    });

    const { strip } = renderStrip(model);

    expect(strip.querySelector('.timeline-strip__labels')?.textContent).toBe('Today');
    expect(strip.querySelector<HTMLElement>('.timeline-strip__today-label')?.style.left).toBe(
      '0px',
    );
  });

  it('runs the main line on thin past a first assessment that ended', () => {
    const model = modelOf(SECOND_ASSESSMENT);
    const ended = find(model, (item) => item.kind === 'certificate' && !item.branch);

    const { mark } = renderStrip(model);

    expect(mark(ended.id).querySelector('.timeline-strip__certificate-line--thin')).not.toBeNull();
  });

  it('draws an undated Act transition as a dashed box', () => {
    const model = modelOf(TRANSITIONED);
    const transition = find(model, (item) => item.kind === 'transition');

    const { mark } = renderStrip(model);

    expect(mark(transition.id)).toHaveClass('timeline-strip__transition');
  });

  it('outlines the selected item only', () => {
    const model = modelOf(CEDAR);
    const selected = titled(model, 'Amendment #2');

    const { strip } = renderStrip(model, { selectedId: selected });

    expect(
      [...strip.querySelectorAll('.is-selected')].map((el) => el.getAttribute('data-item')),
    ).toEqual([selected]);
  });

  it('fades the items the filters leave out', () => {
    const model = modelOf(CEDAR);
    const out = titled(model, 'Amendment #1');

    const { mark } = renderStrip(model, { dimmedIds: new Set([out]) });

    expect(mark(out)).toHaveClass('is-dimmed');
    expect(mark(titled(model, 'Amendment #2'))).not.toHaveClass('is-dimmed');
  });
});
