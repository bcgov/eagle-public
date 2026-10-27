import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DemiProject } from 'app/api/api';
import { CEDAR, CROWN_MOUNTAIN, TODAY, TRANSITIONED, milestone, work } from './timeline.fixture';
import { TimelineDetails } from './timeline-details';
import { TimelineList, defaultExpandedIds } from './timeline-list';
import { buildTimelineModel, type TimelineModel } from './use-timeline-model';

function modelOf(project: DemiProject): TimelineModel {
  return buildTimelineModel({ project, documents: [], lists: [], today: TODAY });
}

/** The list wired the way the tab wires it: selection and expansion held by the parent. */
function Harness({ model, initial = null }: { model: TimelineModel; initial?: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  const [expanded, setExpanded] = useState(() => new Set(defaultExpandedIds(model)));
  const onExpand = (id: string, open: boolean) =>
    setExpanded((now) => {
      const next = new Set(now);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  return (
    <TimelineList
      model={model}
      selectedId={selectedId}
      onSelect={setSelectedId}
      expandedIds={expanded}
      onExpand={onExpand}
      details={<TimelineDetails model={model} selectedId={selectedId} onSelect={setSelectedId} />}
    />
  );
}

const row = (name: RegExp | string) => screen.getByRole('button', { name });

// The 2002 phase, not the Track phase "Pre-EA (EAC Assessment)".
const PRE_EA = /^Pre-EA(?! \()/;

function listItemOf(name: RegExp) {
  const item = screen
    .getAllByRole('listitem')
    .find((li) => within(li).queryByRole('button', { name }));
  if (!item) throw new Error(`no row named ${name}`);
  return item;
}

function narrowViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: media.includes('max-width: 767'),
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

// jsdom has no layout, so it has no scrollIntoView either.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe('TimelineList keyboard', () => {
  it('moves focus down and up the rows with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Harness model={modelOf(CEDAR)} />);

    row(/^Early Engagement/).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('button', { name: /^With the proponent/ })[0]).toHaveFocus();

    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}');
    expect(row(/^Early Engagement/)).toHaveFocus();
  });

  it('jumps to the first and last rows with Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness model={modelOf(CEDAR)} />);

    row(/^Early Engagement/).focus();
    await user.keyboard('{End}');
    expect(row(/^Today, 26 Oct 2026/)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(row(/^Under the Environmental Assessment Act \(2018\)/)).toHaveFocus();
  });

  it('selects the focused row on Enter, and only that row', async () => {
    const user = userEvent.setup();
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);

    row(/^Process Planning/).focus();
    await user.keyboard('{Enter}');

    expect(row(/^Process Planning/)).toHaveAttribute('aria-pressed', 'true');
    expect(row(/^Environmental Assessment Certificate issued/)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('TimelineList scrolling', () => {
  it('centres a selected row that sits below the list’s scrolled view', async () => {
    const user = userEvent.setup();
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);
    // Layout stand-ins: a 200px window onto rows 54px apart.
    const list = screen.getByRole('list', { name: 'Timeline, oldest first' });
    Object.defineProperties(list, {
      clientHeight: { value: 200 },
      scrollHeight: { value: 2000 },
      scrollTop: { value: 0, writable: true },
    });
    screen.getAllByRole('listitem').forEach((li, i) =>
      Object.defineProperties(li.firstElementChild, {
        offsetTop: { value: i * 54 },
        offsetHeight: { value: 54 },
      }),
    );
    const last = screen.getAllByRole('listitem').length - 1;

    row(/^Early Engagement/).focus();
    await user.keyboard('{End}{Enter}');

    expect(list.scrollTop).toBe(last * 54 - (200 - 54) / 2);
  });
});

describe('TimelineList history row', () => {
  it('starts collapsed with its phases hidden', () => {
    render(<Harness model={modelOf(TRANSITIONED)} />);

    expect(row(/^2002 Act phases/)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: PRE_EA })).not.toBeInTheDocument();
  });

  it('expands on a click to show its phases, undated', async () => {
    const user = userEvent.setup();
    render(<Harness model={modelOf(TRANSITIONED)} />);

    await user.click(row(/^2002 Act phases/));

    expect(row(/^2002 Act phases/)).toHaveAttribute('aria-expanded', 'true');
    expect(row(PRE_EA)).toHaveTextContent('Not dated');
    expect(row(/^Pre-Application/)).toBeInTheDocument();
  });

  it('opens with the right arrow and closes with the left', async () => {
    const user = userEvent.setup();
    render(<Harness model={modelOf(TRANSITIONED)} />);

    row(/^2002 Act phases/).focus();
    await user.keyboard('{ArrowRight}');
    expect(row(PRE_EA)).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('button', { name: PRE_EA })).not.toBeInTheDocument();
  });
});

describe('TimelineList rows', () => {
  it('marks Today as the current date', () => {
    render(<Harness model={modelOf(CEDAR)} />);

    expect(listItemOf(/^Today/)).toHaveAttribute('aria-current', 'date');
  });

  it('gives open work its time so far and its planned decision', () => {
    render(<Harness model={modelOf(CEDAR)} />);

    expect(row(/^Amendment #3/)).toHaveTextContent(
      '13 months so far · decision planned 15 Mar 2027',
    );
  });

  it('gives running proponent time its time so far, not its planned length', () => {
    render(<Harness model={modelOf(CROWN_MOUNTAIN)} />);

    expect(screen.getAllByRole('button', { name: /^With the proponent/ })[1]).toHaveTextContent(
      'Proponent time · 5 months so far before Effects Assessment and Recommendation',
    );
  });

  it('marks a phase that has not started as planned', () => {
    render(<Harness model={modelOf(CROWN_MOUNTAIN)} />);

    expect(screen.getAllByRole('button', { name: /^Effects Assessment/ })[0]).toHaveTextContent(
      'Planned · 2 Apr 2027 – 30 Aug 2027 · 5 months',
    );
  });

  it('explains proponent time on the row itself', () => {
    render(<Harness model={modelOf(CEDAR)} />);

    expect(screen.getAllByRole('button', { name: /^With the proponent/ })[0]).toHaveTextContent(
      'Proponent time · 6 months before Readiness Decision · EAO’s clock paused',
    );
  });

  it('says when a transition date is not recorded, and between which dates', () => {
    render(<Harness model={modelOf(TRANSITIONED)} />);

    expect(row(/^Transitioned to the 2018 Act/)).toHaveTextContent(
      /Date: Not recorded · between \d+ \w{3} \d{4} and \d+ \w{3} \d{4}/,
    );
  });
});

const STATUSES = [
  ['COMPLETED', 'Completed', 'check'],
  ['CLOSED', 'Closed', 'block'],
  ['WITHDRAWN', 'Withdrawn', 'undo'],
  ['TERMINATED', 'Terminated', 'close'],
  ['IN_PROGRESS', 'In progress', 'more_horiz'],
  ['SUSPENDED', 'Suspended', 'pause'],
] as const;

const SIX_STATUSES: DemiProject = {
  name: 'Six statuses',
  works: STATUSES.map(([workState], i) =>
    work({
      title: `Work ${workState}`,
      workState,
      startDate: `202${i}-03-01`,
      decisionDate: workState === 'COMPLETED' ? '2020-09-01' : null,
      milestones: [milestone('Application received', { actual: `202${i}-03-01` }, 'START')],
    }),
  ),
};

describe('TimelineList work status', () => {
  it.each(STATUSES)('draws a %s work with the %s chip and the %s node', (state, label, icon) => {
    render(<Harness model={modelOf(SIX_STATUSES)} />);

    const item = listItemOf(new RegExp(`^Work ${state}`));
    expect(within(item).getByRole('button')).toHaveTextContent(label);
    expect(within(item).getByText(icon)).toBeInTheDocument();
  });
});

describe('TimelineList on a narrow screen', () => {
  it('draws the details inside the selected row, after its button', () => {
    narrowViewport();
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);

    const item = listItemOf(/^Environmental Assessment Certificate issued/);
    const details = within(item).getByRole('complementary');
    expect(within(details).getByText('Source')).toBeInTheDocument();
    expect(
      within(item)
        .getByRole('button', { name: /^Environmental Assessment Certificate issued/ })
        .compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('moves the details to the newly selected row', async () => {
    narrowViewport();
    const user = userEvent.setup();
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);

    await user.click(row(/^Amendment #1/));

    expect(within(listItemOf(/^Amendment #1/)).getByRole('complementary')).toBeInTheDocument();
    expect(screen.getAllByRole('complementary')).toHaveLength(1);
  });

  it('folds the details away on a second tap of the same row', async () => {
    narrowViewport();
    const user = userEvent.setup();
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);

    await user.click(row(/^Environmental Assessment Certificate issued/));

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(row(/^Environmental Assessment Certificate issued/)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('tells the selected row it is open, not pressed', () => {
    narrowViewport();
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);

    const selected = row(/^Environmental Assessment Certificate issued/);
    expect(selected).toHaveAttribute('aria-expanded', 'true');
    expect(selected).not.toHaveAttribute('aria-pressed');
  });

  it('keeps the details out of the list on a wide screen', () => {
    render(<Harness model={modelOf(CEDAR)} initial="certificate" />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
