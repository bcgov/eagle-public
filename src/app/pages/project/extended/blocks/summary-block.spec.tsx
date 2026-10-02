import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { Project } from 'app/models/project';
import { renderBlocks } from '../fixtures/blocks';
import type { SummaryBlock } from '../types';

const RECORD = { _id: 'lib-1', description: 'Record description of the library.' } as Project;

function summary(description?: string): SummaryBlock {
  return {
    type: 'summary',
    id: 'about',
    heading: 'About the library',
    description,
    stats: [
      { label: 'Floor area', value: '2,000 m²' },
      { label: 'Seats', value: '300' },
    ],
    itemsHeading: 'What it adds',
    items: ['A reading room', 'A maker space'],
  };
}

describe('summary block description', () => {
  it('shows the content description over the record one', async () => {
    renderBlocks([summary('Content description of the library.')], { project: RECORD });

    expect(await screen.findByText('Content description of the library.')).toBeInTheDocument();
    expect(screen.queryByText('Record description of the library.')).not.toBeInTheDocument();
  });

  it('falls back to the record description when the content has none', async () => {
    renderBlocks([summary('  ')], { project: RECORD });

    expect(await screen.findByText('Record description of the library.')).toBeInTheDocument();
  });

  it('shows no description when neither the content nor the record has one', async () => {
    renderBlocks([summary()], { project: { _id: 'lib-1' } as Project });

    await screen.findByRole('heading', { level: 2, name: 'About the library' });
    expect(screen.queryByText(/description of the library/)).not.toBeInTheDocument();
    expect(screen.queryByText('Loading project description')).not.toBeInTheDocument();
  });
});

describe('summary block', () => {
  it('names its section by its heading, with the segment and block id in the heading id', async () => {
    renderBlocks([summary('A new wing.')], { segment: 'overview' });

    const section = await screen.findByRole('region', { name: 'About the library' });
    expect(within(section).getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'extended-overview-about',
    );
  });

  it('lists the figures and the numbered items', async () => {
    renderBlocks([summary('A new wing.')]);

    await screen.findByRole('heading', { level: 2, name: 'About the library' });
    expect(screen.getByText('Floor area').nextSibling).toHaveTextContent('2,000 m²');
    expect(screen.getByRole('heading', { level: 3, name: 'What it adds' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1A reading room',
      '2A maker space',
    ]);
  });

  it('puts its subheading one level under a card title on a titled tab', async () => {
    renderBlocks([summary('A new wing.')], { level: 3 });

    expect(await screen.findByRole('heading', { level: 3, name: 'About the library' })).toHaveClass(
      'extended-card__title',
    );
    expect(screen.getByRole('heading', { level: 4, name: 'What it adds' })).toBeInTheDocument();
  });

  it('puts its subheading at the block heading level when the block has no heading', async () => {
    renderBlocks([{ ...summary('A new wing.'), heading: undefined }]);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'What it adds' }),
    ).toBeInTheDocument();
  });

  it('hides the drawn numerals from assistive technology, since the list numbers its items', async () => {
    renderBlocks([summary('A new wing.')]);

    await screen.findByRole('heading', { level: 2, name: 'About the library' });
    const numerals = screen.getAllByText(/^[12]$/);
    expect(numerals).toHaveLength(2);
    for (const numeral of numerals) expect(numeral).toHaveAttribute('aria-hidden', 'true');
  });
});
