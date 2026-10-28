import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DemiProject } from 'app/api/api';
import { TimelineLanes, type TimelineLanesProps } from './timeline-lanes';
import {
  AMENDMENT_DOCUMENTS,
  CEDAR,
  CERTIFIED_2002,
  SECOND_ASSESSMENT,
  TODAY,
  TRANSITIONED,
  milestone,
  work,
} from './timeline.fixture';
import { buildTimelineModel } from './use-timeline-model';

const modelOf = (project: DemiProject) =>
  buildTimelineModel({ project, documents: [], lists: [], today: TODAY });

function renderLanes(project: DemiProject) {
  const model = modelOf(project);
  const onSelect = vi.fn();
  const element = (extra: Partial<TimelineLanesProps>) => (
    <TimelineLanes model={model} selectedId={null} onSelect={onSelect} {...extra} />
  );
  const { rerender } = render(element({}));
  const idOf = (title: string) => model.items.find((item) => item.title === title)!.id;
  return {
    onSelect,
    idOf,
    rerender: (extra: Partial<TimelineLanesProps>) => rerender(element(extra)),
  };
}

const button = (name: string) => screen.getByRole('button', { name });
const zoomIn = () => button('Zoom in');
// The key explains the hidden chart, so it is hidden with it.
const key = () => screen.getByRole('list', { hidden: true });
const heading = () =>
  screen.getByText(/^(Whole life, to scale|Showing )/, { selector: 'p' }).textContent;
/** The last month in view, read off the announced range "Showing Mon YYYY – Mon YYYY". */
const viewEnd = () => Date.parse(`1 ${screen.getByRole('status').textContent!.split(' – ')[1]}`);

beforeAll(() => {
  // jsdom has no pointer capture.
  Element.prototype.setPointerCapture ??= () => undefined;
});

// jsdom has no layout: a 1000px track beside the 152px label column.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1152);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('TimelineLanes zoom', () => {
  it('disables + once the view is down to one year', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);

    await user.click(zoomIn());
    await user.click(zoomIn());
    expect(zoomIn()).toBeEnabled();

    await user.click(zoomIn());
    expect(zoomIn()).toBeDisabled();
  });

  it('starts on the whole life, with zoom out and Last 10 years off for a short life', () => {
    renderLanes(CEDAR);

    expect(button('Show the whole life')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Zoom out')).toBeDisabled();
    expect(button('Show the last 10 years')).toBeDisabled();
    expect(heading()).toBe('Whole life, to scale');
  });

  it('zooms in on Ctrl + wheel', () => {
    renderLanes(CEDAR);

    fireEvent.wheel(screen.getByTitle(/^Amendment #1 · /), { ctrlKey: true, deltaY: -100 });

    expect(heading()).toMatch(/^Showing /);
    expect(button('Show the whole life')).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves the view to where the mini-map is clicked', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const minimap = screen.getByTitle('Click to move the view');
    vi.spyOn(minimap, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 16));
    expect(heading()).not.toMatch(/– Aug 2027$/);

    await user.pointer({ keys: '[MouseLeft]', target: minimap, coords: { clientX: 1000 } });

    expect(heading()).toMatch(/– Aug 2027$/);
  });
});

describe('TimelineLanes view', () => {
  it('offers Last 10 years on a life longer than 10 years', async () => {
    const user = userEvent.setup();
    renderLanes(CERTIFIED_2002);

    await user.click(button('Show the last 10 years'));

    expect(button('Show the last 10 years')).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toMatch(/– Mar 2027$/);
  });

  it('goes back to the whole life for another project', async () => {
    const user = userEvent.setup();
    const { rerender } = renderLanes(CEDAR);
    await user.click(zoomIn());

    rerender({ model: modelOf(CERTIFIED_2002) });

    expect(heading()).toBe('Whole life, to scale');
  });

  it('opens a new project on its whole life even when the list window arrives with it', async () => {
    const user = userEvent.setup();
    const { rerender } = renderLanes(CEDAR);
    await user.click(zoomIn());

    rerender({
      model: modelOf(CERTIFIED_2002),
      listWindow: { from: '2008-02-11', to: '2008-09-24' },
    });

    expect(heading()).toBe('Whole life, to scale · list showing 2008');
  });

  it('pans a zoomed view later with a rightward sideways wheel', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const before = viewEnd();

    fireEvent.wheel(screen.getByTitle(/^Amendment #1 · /), { deltaX: 300, deltaY: 0 });

    expect(viewEnd()).toBeGreaterThan(before);
  });

  it('reads a wheel in lines as 16px a line', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const bar = screen.getByTitle(/^Amendment #1 · /);
    fireEvent.wheel(bar, { deltaX: 160, deltaY: 0 });
    const byPixels = viewEnd();
    fireEvent.wheel(bar, { deltaX: -160, deltaY: 0 });

    fireEvent.wheel(bar, { deltaX: 10, deltaY: 0, deltaMode: WheelEvent.DOM_DELTA_LINE });

    expect(viewEnd()).toBe(byPixels);
  });

  it('leaves a sideways wheel to the page on the whole life', () => {
    renderLanes(CEDAR);

    const notCancelled = fireEvent.wheel(screen.getByTitle(/^Amendment #1 · /), {
      deltaX: 300,
      deltaY: 0,
    });

    expect(notCancelled).toBe(true);
    expect(heading()).toBe('Whole life, to scale');
  });
});

describe('TimelineLanes announcements', () => {
  it('announces the zoom range but not the list part of the heading', async () => {
    const user = userEvent.setup();
    const { rerender } = renderLanes(CEDAR);
    await user.click(zoomIn());

    rerender({ listWindow: { from: '2023-01-05', to: '2023-06-01' } });

    expect(heading()).toMatch(/ · list showing 2023$/);
    expect(screen.getByRole('status')).toHaveTextContent(/^Showing \w{3} \d{4} – \w{3} \d{4}$/);
  });
});

describe('TimelineLanes drag', () => {
  async function dragAcross(pixels: number) {
    const user = userEvent.setup();
    const lanes = renderLanes(CEDAR);
    await user.click(zoomIn());
    const bar = screen.getByTitle(/^Amendment #1 · /);
    await user.pointer([
      { keys: '[MouseLeft>]', target: bar, coords: { clientX: 500 } },
      { target: bar, coords: { clientX: 500 + pixels } },
      { keys: '[/MouseLeft]', target: bar },
    ]);
    return lanes;
  }

  it('still selects a bar when the pointer moves under 4px', async () => {
    const { onSelect, idOf } = await dragAcross(3);

    expect(onSelect).toHaveBeenCalledWith(idOf('Amendment #1'));
  });

  it('does not select at 4px', async () => {
    const { onSelect } = await dragAcross(4);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pans the view with the drag', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const before = heading();
    const bar = screen.getByTitle(/^Amendment #1 · /);

    await user.pointer([
      { keys: '[MouseLeft>]', target: bar, coords: { clientX: 500 } },
      { target: bar, coords: { clientX: 300 } },
      { keys: '[/MouseLeft]', target: bar },
    ]);

    expect(heading()).not.toBe(before);
  });

  it('does not pan with the right button', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const before = heading();
    const bar = screen.getByTitle(/^Amendment #1 · /);

    await user.pointer([
      { keys: '[MouseRight>]', target: bar, coords: { clientX: 500 } },
      { target: bar, coords: { clientX: 300 } },
      { keys: '[/MouseRight]', target: bar },
    ]);

    expect(heading()).toBe(before);
  });

  it('stops the drag when the browser cancels the pointer', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const before = heading();
    const bar = screen.getByTitle(/^Amendment #1 · /);
    await user.pointer({ keys: '[MouseLeft>]', target: bar, coords: { clientX: 500 } });

    fireEvent.pointerCancel(window);
    await user.pointer({ target: bar, coords: { clientX: 300 } });

    expect(heading()).toBe(before);
  });

  it('stops the drag when a move arrives with no button held', async () => {
    const user = userEvent.setup();
    renderLanes(CEDAR);
    await user.click(zoomIn());
    const before = heading();
    const bar = screen.getByTitle(/^Amendment #1 · /);
    fireEvent.pointerDown(bar, { button: 0, clientX: 500 });

    await user.pointer({ target: bar, coords: { clientX: 300 } });

    expect(heading()).toBe(before);
  });
});

describe('TimelineLanes list window', () => {
  const window2026 = { from: '2026-01-05', to: '2026-06-01' };

  it('pans a zoomed view to the list rows in view', async () => {
    const user = userEvent.setup();
    const { rerender } = renderLanes(CEDAR);
    await user.click(zoomIn());

    rerender({ listWindow: window2026 });

    expect(heading()).toMatch(/– Aug 2027 · list showing 2026$/);
  });

  it('leaves the whole life where it is', () => {
    const { rerender } = renderLanes(CEDAR);

    rerender({ listWindow: window2026 });

    expect(heading()).toBe('Whole life, to scale · list showing 2026');
  });
});

describe('TimelineLanes marks', () => {
  it('draws an open work as planned to a hollow decision dot', () => {
    renderLanes(CEDAR);

    expect(screen.getByTitle('Amendment #3 · planned to 15 Mar 2027')).toBeInTheDocument();
    expect(screen.getByTitle('Amendment #3 · Planned decision 15 Mar 2027')).toBeInTheDocument();
    expect(screen.queryByTitle(/^Amendment #1 · Planned decision/)).not.toBeInTheDocument();
  });

  it('draws no planned segment once the planned decision has passed', () => {
    renderLanes({
      ...CEDAR,
      works: [
        work({
          title: 'Late amendment',
          startDate: '2025-01-06',
          isActive: true,
          workState: 'IN_PROGRESS',
          milestones: [milestone('Decision', { anticipated: '2026-03-02' }, 'END')],
        }),
      ],
    });

    expect(screen.queryByTitle(/^Late amendment · planned to/)).not.toBeInTheDocument();
    expect(screen.getByTitle('Late amendment · Planned decision 2 Mar 2026')).toBeInTheDocument();
  });

  it('boxes an undated transition between its known dates', () => {
    renderLanes(TRANSITIONED);

    expect(
      screen.getByTitle('Transitioned to the 2018 Act · Date: Not recorded'),
    ).toBeInTheDocument();
    expect(within(key()).getByText('Transition happened in here')).toBeInTheDocument();
  });

  it('counts a single amendment document in the singular', () => {
    const model = buildTimelineModel({
      project: CERTIFIED_2002,
      documents: AMENDMENT_DOCUMENTS.slice(0, 1),
      lists: [],
      today: TODAY,
    });
    render(<TimelineLanes model={model} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('1 document before Track')).toBeInTheDocument();
  });

  it('names the First and Second assessment lane rows', () => {
    renderLanes(SECOND_ASSESSMENT);

    expect(screen.getByText('First assessment')).toBeInTheDocument();
    expect(screen.getByText('Second assessment')).toBeInTheDocument();
    expect(screen.getByTitle('Second assessment begins')).toBeInTheDocument();
  });

  it('keeps a one-assessment project on a single Project row', () => {
    renderLanes(CEDAR);

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.queryByText('Second assessment')).not.toBeInTheDocument();
  });

  it('draws the items the filter leaves out faint', () => {
    const { idOf, rerender } = renderLanes(CEDAR);

    rerender({ dimmedIds: new Set([idOf('Amendment #2')]) });

    expect(screen.getByTitle(/^Amendment #2 · /)).toHaveClass('timeline-lanes__mark--dimmed');
    expect(screen.getByTitle(/^Amendment #1 · /)).not.toHaveClass('timeline-lanes__mark--dimmed');
  });
});

describe('TimelineLanes view slider', () => {
  const slider = () => screen.getByRole('slider', { name: 'View on the whole life' });

  /** A quarter of the life in view, centred, the slider focused. */
  async function quarterView() {
    const user = userEvent.setup();
    const lanes = renderLanes(CEDAR);
    await user.click(zoomIn());
    await user.click(zoomIn());
    slider().focus();
    return { user, ...lanes };
  }

  it('starts in the middle of its 0 to 100 range', async () => {
    await quarterView();

    expect(slider()).toHaveAttribute('aria-valuenow', '50');
  });

  it.each([
    ['{ArrowLeft}', '47'],
    ['{ArrowDown}', '47'],
    ['{ArrowRight}', '53'],
    ['{ArrowUp}', '53'],
    ['{Shift>}{ArrowLeft}{/Shift}', '33'],
    ['{Shift>}{ArrowRight}{/Shift}', '67'],
    ['{PageDown}', '33'],
    ['{PageUp}', '67'],
    ['{Home}', '0'],
    ['{End}', '100'],
  ])('moves the view on %s to %s', async (keys, value) => {
    const { user } = await quarterView();

    await user.keyboard(keys);

    expect(slider()).toHaveAttribute('aria-valuenow', value);
  });

  it('leaves the view where it is on a click on the view box itself', async () => {
    const { user } = await quarterView();
    const minimap = screen.getByTitle('Click to move the view');
    vi.spyOn(minimap, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 16));

    await user.pointer({ keys: '[MouseLeft]', target: slider(), coords: { clientX: 1000 } });

    expect(slider()).toHaveAttribute('aria-valuenow', '50');
  });
});

const in2023 = { from: '2023-01-05', to: '2023-06-01' };
const in2026 = { from: '2026-01-05', to: '2026-06-01' };

describe('TimelineLanes drag hint', () => {
  it('says the box scrolls the list on the whole life', () => {
    renderLanes(CEDAR).rerender({ listWindow: in2023 });

    expect(screen.getByText(/^Drag the box to scroll the list · Ctrl or/)).toBeInTheDocument();
  });

  it('says the box scrolls and the rest pans when zoomed', async () => {
    const user = userEvent.setup();
    const { rerender } = renderLanes(CEDAR);
    await user.click(zoomIn());
    rerender({ listWindow: in2023 });

    expect(
      screen.getByText(/^Drag the box to scroll, outside it to pan · Ctrl or/),
    ).toBeInTheDocument();
  });
});

describe('TimelineLanes list box drag', () => {
  const box = () => screen.queryByTitle('Drag to scroll the list');
  const range = () => screen.getByRole('status').textContent;

  /** Zoomed to the middle of Cedar's life, the list box on 2023 and held down. */
  async function holding() {
    const user = userEvent.setup();
    const lanes = renderLanes(CEDAR);
    await user.click(zoomIn());
    lanes.rerender({ listWindow: in2023 });
    await user.pointer({ keys: '[MouseLeft>]', target: box()!, coords: { clientX: 500 } });
    return { user, ...lanes };
  }

  it('holds the view still while the list scrolls past it under the drag', async () => {
    const { rerender } = await holding();
    const before = range();

    rerender({ listWindow: in2026 });

    expect(range()).toBe(before);
  });

  it('keeps the held box mounted while it is dragged off the lanes', async () => {
    const { rerender } = await holding();
    const held = box();

    rerender({ listWindow: in2026 });

    // The grid holds the capture (past the 4px threshold), but an unmounted box ends the drag.
    expect(box()).toBe(held);
  });

  it('follows the list again once the drag ends', async () => {
    const { user, rerender } = await holding();
    rerender({ listWindow: in2026 });

    await user.pointer({ keys: '[/MouseLeft]', target: box()! });

    expect(range()).toMatch(/– Aug 2027$/);
  });

  it('ends the drag on a release outside the lanes before the 4px threshold', async () => {
    const { user, rerender } = await holding();
    await user.pointer({ target: box()!, coords: { clientX: 502 } });

    fireEvent.pointerUp(window);
    rerender({ listWindow: in2026 });

    expect(range()).toMatch(/– Aug 2027$/);
  });

  it('keeps dragging when a mark on the lanes loses its own pointer capture', async () => {
    const { user, rerender } = await holding();
    await user.pointer({ target: box()!, coords: { clientX: 520 } });
    const before = range();

    fireEvent.lostPointerCapture(screen.getByTitle(/^Amendment #1 · /));
    rerender({ listWindow: in2026 });

    expect(range()).toBe(before);
  });

  it('ends the drag when the lanes lose the pointer capture', async () => {
    const { user, rerender } = await holding();
    await user.pointer({ target: box()!, coords: { clientX: 520 } });

    fireEvent.lostPointerCapture(box()!.parentElement!);
    rerender({ listWindow: in2026 });

    expect(range()).toMatch(/– Aug 2027$/);
  });

  it('ends the drag when the box goes away under it', async () => {
    const { rerender } = await holding();
    rerender({ listWindow: null });

    rerender({ listWindow: in2026 });

    expect(range()).toMatch(/– Aug 2027$/);
  });
});

describe('TimelineLanes key', () => {
  it.each([
    ['with an end', '2021-04-12', 'Comment period', 'Milestone'],
    ['with no end', null, 'Milestone', 'Comment period'],
  ])('keys a comment period %s', (_what, end, shown, absent) => {
    const model = buildTimelineModel({
      project: CEDAR,
      documents: [],
      lists: [],
      commentPeriods: [
        { id: 'cp', start: '2021-03-01', end, label: null, href: null, relatedDocuments: [] },
      ],
      today: TODAY,
    });
    render(<TimelineLanes model={model} selectedId={null} onSelect={vi.fn()} />);

    expect(within(key()).getByText(shown)).toBeInTheDocument();
    expect(within(key()).queryByText(absent)).not.toBeInTheDocument();
  });

  it('lists only the marks Cedar draws: no Not dated', () => {
    renderLanes(CEDAR);

    expect(within(key()).queryByText('Not dated')).not.toBeInTheDocument();
    expect(within(key()).getByText('Planned, to the planned decision')).toBeInTheDocument();
    expect(within(key()).getByText('Planned decision')).toBeInTheDocument();
  });

  it('lists Not dated for a 2002 project with undated phases', () => {
    renderLanes(CERTIFIED_2002);

    expect(within(key()).getByText('Not dated')).toBeInTheDocument();
    expect(within(key()).queryByText('Planned decision')).not.toBeInTheDocument();
  });
});
