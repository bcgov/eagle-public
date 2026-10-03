import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';

describe('steps block', () => {
  it('names each step under the block heading, with its detail and note', async () => {
    renderBlocks(
      [
        {
          type: 'steps',
          id: 'how',
          heading: 'How a branch opens',
          noteLabel: 'Harbour',
          steps: [
            { name: 'Plan', detail: 'The board drafts a plan.', note: 'done in 2025' },
            { name: 'Build', detail: 'Crews build under the Library Act.' },
          ],
        },
      ],
      { level: 3 },
    );

    const section = await screen.findByRole('region', { name: 'How a branch opens' });
    const names = within(section).getAllByRole('heading', { level: 4 });
    expect(names.map((name) => name.textContent)).toEqual(['Plan', 'Build']);
    expect(within(section).getByText('Harbour: done in 2025')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /^Library Act/ })).toBeInTheDocument();
    const [first, second] = within(section).getAllByRole('listitem');
    expect(first).toHaveTextContent(/^1Plan/);
    expect(second).not.toHaveTextContent('Harbour:');
  });
});
