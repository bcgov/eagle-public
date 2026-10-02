import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { LinksBlock } from '../types';

const ITEMS: LinksBlock['items'] = [
  { label: 'City plan', href: 'https://example.org/plan', detail: 'The ten-year plan' },
  { label: 'Board minutes', href: 'https://example.org/minutes' },
];

describe('links block', () => {
  it('draws cards with each link and its detail', async () => {
    renderBlocks([{ type: 'links', id: 'more', heading: 'More', style: 'cards', items: ITEMS }]);

    const section = await screen.findByRole('region', { name: 'More' });
    const links = within(section).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://example.org/plan',
      'https://example.org/minutes',
    ]);
    expect(links.every((link) => link.getAttribute('target') === '_blank')).toBe(true);
    expect(within(section).getByText('The ten-year plan')).toBeInTheDocument();
    expect(section).toHaveClass('extended-copy');
  });

  it.each([
    ['list', 'extended-links__list'],
    ['compact', 'extended-sources'],
  ] as const)('draws a %s as a plain link list', async (style, listClass) => {
    renderBlocks([{ type: 'links', id: 'more', heading: 'More', style, items: ITEMS }]);

    const section = await screen.findByRole('region', { name: 'More' });
    expect(within(section).getByRole('list')).toHaveClass('extended-link-list', listClass);
    expect(within(section).queryByText('The ten-year plan')).not.toBeInTheDocument();
    expect(within(section).getAllByRole('link')).toHaveLength(2);
  });
});
