import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CEDAR, TODAY } from './timeline.fixture';
import { buildTimelineModel, type PhaseItem, type ProponentItem } from './use-timeline-model';
import { WhoseTime } from './whose-time';

const model = buildTimelineModel({ project: CEDAR, documents: [], lists: [], today: TODAY });
const ITEMS = model.items.filter(
  (item): item is PhaseItem | ProponentItem => item.kind === 'phase' || item.kind === 'proponent',
);

function renderTime(selectedId: string | null = null) {
  const onSelect = vi.fn();
  render(
    <WhoseTime
      time={{ eaoDays: 120, proponentDays: 800 }}
      items={ITEMS}
      span="4 Aug 2020 – 14 Mar 2023"
      today={TODAY.getTime()}
      selectedId={selectedId}
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

describe('WhoseTime', () => {
  it('heads the section with the span it covers', () => {
    renderTime();

    expect(
      screen.getByRole('heading', { name: 'Whose time · 4 Aug 2020 – 14 Mar 2023' }),
    ).toBeInTheDocument();
  });

  it('totals EAO and proponent time on their rows', () => {
    renderTime();

    const rows = screen.getAllByText(/^(EAO|Proponent|4 months|2\.2 years)$/);
    expect(rows.map((one) => one.textContent)).toEqual([
      'EAO',
      '4 months',
      'Proponent',
      '2.2 years',
    ]);
  });

  it('draws one bar per phase and per proponent span', () => {
    renderTime();

    expect(screen.getAllByRole('button')).toHaveLength(ITEMS.length);
    expect(screen.getAllByRole('button', { name: /^With the proponent, / })).toHaveLength(2);
  });

  it('selects a phase from its bar', async () => {
    const user = userEvent.setup();
    const onSelect = renderTime();

    await user.click(screen.getByRole('button', { name: /^Process Planning, 7 Sep 2021/ }));

    expect(onSelect).toHaveBeenCalledWith('phase-3');
  });

  it('marks the selected phase’s bar pressed', () => {
    renderTime('phase-3');

    expect(screen.getByRole('button', { name: /^Process Planning/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Early Engagement/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
