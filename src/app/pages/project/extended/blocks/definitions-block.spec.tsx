import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { DefinitionsBlock } from '../types';

describe('definitions block', () => {
  it('pairs each term with its detail', async () => {
    renderBlocks([
      {
        type: 'definitions',
        id: 'roles',
        heading: 'Who does what',
        items: [
          { term: 'City of Harbour', detail: 'Owns the building' },
          { term: 'Library Board', detail: 'Runs the library under the Library Act' },
        ],
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Who does what' });
    const terms = within(section).getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual(['City of Harbour', 'Library Board']);
    expect(within(section).getAllByRole('definition')[1]).toHaveTextContent(
      'Runs the library under the Library Act',
    );
  });

  it('is left out when it has no items', async () => {
    const empty: DefinitionsBlock = {
      type: 'definitions',
      id: 'roles',
      heading: 'Roles',
      items: [],
    };
    renderBlocks([empty, { type: 'prose', id: 'p', heading: 'After', text: 'x' }]);

    await screen.findByRole('heading', { name: 'After' });
    expect(screen.queryByRole('heading', { name: 'Roles' })).not.toBeInTheDocument();
  });
});
