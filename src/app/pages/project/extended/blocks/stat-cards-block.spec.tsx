import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { StatCardsBlock } from '../types';

const BLOCK: StatCardsBlock = {
  type: 'statCards',
  id: 'reach',
  heading: 'Who took part',
  cards: [
    {
      value: '200',
      text: 'People at the open house.',
      source: { label: 'Library Board', href: 'https://example.org/board' },
    },
    { value: '45', text: 'Written comments.' },
  ],
  note: 'Counts are rounded.',
};

describe('stat cards block', () => {
  it('shows each figure with its text and, where given, its source', async () => {
    renderBlocks([BLOCK]);

    const section = await screen.findByRole('region', { name: 'Who took part' });
    expect(within(section).getByText('200')).toBeInTheDocument();
    expect(within(section).getByText(/^People at the open house\. Source:/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /^Library Board/ })).toHaveAttribute(
      'href',
      'https://example.org/board',
    );
    expect(within(section).getByText('Written comments.')).not.toHaveTextContent('Source');
    expect(within(section).getByText('Counts are rounded.')).toBeInTheDocument();
  });
});
