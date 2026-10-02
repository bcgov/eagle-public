import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';

describe('prose block', () => {
  it('draws its copy under its heading, linking the page terms once', async () => {
    renderBlocks([
      {
        type: 'prose',
        id: 'role',
        heading: "The city's role",
        text: 'The Library Act sets the rules. The Library Act also names the board.',
      },
    ]);

    const section = await screen.findByRole('region', { name: "The city's role" });
    expect(within(section).getByText(/sets the rules/)).toBeInTheDocument();
    expect(within(section).getAllByRole('link')).toHaveLength(1);
  });
});
