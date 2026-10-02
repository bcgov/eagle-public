import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks, SAMPLE_PAGE } from '../fixtures/blocks';
import type { TimelineBlock } from '../types';

const BLOCK: TimelineBlock = { type: 'timeline', id: 'when', heading: 'When', framed: true };

describe('timeline block', () => {
  it('draws the page timeline with each state in words and one current stop', async () => {
    renderBlocks([BLOCK], { level: 3 });

    const section = await screen.findByRole('region', { name: 'When' });
    const stops = within(section).getAllByRole('listitem');
    expect(
      stops.map((stop) => within(stop).getByRole('heading', { level: 4 }).textContent),
    ).toEqual(['Design', 'Build', 'Open']);
    expect(stops[0]).toHaveTextContent('Jan 2026 · Done');
    expect(stops.filter((stop) => stop.getAttribute('aria-current') === 'step')).toEqual([
      stops[1],
    ]);
    expect(stops[1]).toHaveTextContent('Mar 2026 · Under way');
    expect(stops[2]).toHaveTextContent('Sep 2026 · Next');
  });

  it('is left out when the page has no timeline', async () => {
    const { timeline: _unused, ...withoutTimeline } = SAMPLE_PAGE;
    renderBlocks([BLOCK, { type: 'prose', id: 'p', heading: 'After', text: 'x' }], {
      content: withoutTimeline,
    });

    await screen.findByRole('heading', { name: 'After' });
    expect(screen.queryByRole('heading', { name: 'When' })).not.toBeInTheDocument();
  });
});
