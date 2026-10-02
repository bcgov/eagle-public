import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { ListBlock } from '../types';

const ITEMS: ListBlock['items'] = [
  'Quiet study rooms',
  ['A ', { text: 'maker space', href: 'https://example.org/maker' }, ' with tools'],
];

describe('list block', () => {
  it('numbers the items after the lead line, numerals hidden from screen readers', async () => {
    renderBlocks(
      [
        {
          type: 'list',
          id: 'goals',
          heading: 'Goals',
          style: 'numbered',
          intro: 'The wing should offer:',
          items: ITEMS,
        },
      ],
      { level: 3 },
    );

    const section = await screen.findByRole('region', { name: 'Goals' });
    expect(within(section).getByText('The wing should offer:')).toBeInTheDocument();
    const list = within(section).getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/^1Quiet study rooms$/);
    expect(items[1]).toHaveTextContent(/^2A maker space.* with tools$/);
    expect(within(items[0]!).getByText('1')).toHaveAttribute('aria-hidden', 'true');
    expect(within(list).getByRole('link', { name: /^maker space/ })).toBeInTheDocument();
  });

  it('bullets the items in a card when framed', async () => {
    renderBlocks([
      {
        type: 'list',
        id: 'notes',
        heading: 'Notes',
        style: 'bulleted',
        framed: true,
        items: ITEMS,
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Notes' });
    expect(section).toHaveClass('extended-card');
    expect(within(section).getByRole('list').tagName).toBe('UL');
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent(/^Quiet study rooms$/);
  });

  it('runs its lead line as rich text, linking terms and explicit links', async () => {
    renderBlocks([
      {
        type: 'list',
        id: 'rules',
        heading: 'Rules',
        style: 'bulleted',
        intro: [
          'Under the Library Act, see ',
          { text: 'the bylaw', href: 'https://example.org/b' },
        ],
        items: ITEMS,
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Rules' });
    expect(within(section).getByRole('link', { name: /^Library Act/ })).toHaveAttribute(
      'href',
      'https://example.org/library-act',
    );
    expect(within(section).getByRole('link', { name: /^the bylaw/ })).toBeInTheDocument();
  });
});
