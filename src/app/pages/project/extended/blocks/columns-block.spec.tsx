import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';

describe('columns block', () => {
  it('draws one headed bullet list per column', async () => {
    renderBlocks(
      [
        {
          type: 'columns',
          id: 'compare',
          heading: 'Before and after',
          columns: [
            { heading: 'Now', items: ['One room', 'No lift'] },
            { heading: 'After', items: ['Four rooms'] },
          ],
        },
      ],
      { level: 3 },
    );

    const section = await screen.findByRole('region', { name: 'Before and after' });
    const headings = within(section).getAllByRole('heading', { level: 4 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Now', 'After']);
    const lists = within(section).getAllByRole('list');
    expect(lists.map((list) => within(list).getAllByRole('listitem').length)).toEqual([2, 1]);
  });
});
