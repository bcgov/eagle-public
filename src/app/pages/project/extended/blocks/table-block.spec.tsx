import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { TableBlock } from '../types';

const BLOCK: TableBlock = {
  type: 'table',
  id: 'funding',
  heading: 'Funding',
  intro: 'Three partners pay for the wing.',
  rows: [
    { name: 'City of Harbour', note: 'Capital budget', value: '60%' },
    { name: 'Province', value: '30%' },
    { name: 'Friends of the Library', note: 'Donations', value: '10%' },
  ],
  footnote: ['Figures from the ', { text: 'city budget', href: 'https://example.org/budget' }],
};

describe('table block', () => {
  it('draws each row with its note and value, between the intro and the footnote', async () => {
    renderBlocks([BLOCK]);

    const section = await screen.findByRole('region', { name: 'Funding' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'City of HarbourCapital budget60%',
      'Province30%',
      'Friends of the LibraryDonations10%',
    ]);
    expect(within(section).getByText('Three partners pay for the wing.')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /^city budget/ })).toHaveAttribute(
      'href',
      'https://example.org/budget',
    );
  });
});
