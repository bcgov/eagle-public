import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { BandBlock } from '../types';

const BAND: BandBlock = {
  type: 'band',
  id: 'how',
  eyebrow: 'How it is built',
  heading: 'The Library Act',
  paragraphs: ['The Library Act sets the steps.', 'A second, quieter line.'],
  steps: [
    { name: 'Plan', short: 'Board drafts' },
    { name: 'Build', short: 'Crews on site' },
  ],
  primary: { label: 'How the Act works', tab: 'act' },
  secondary: { label: 'Read the Act', href: 'https://example.org/act-text' },
};

describe('band block', () => {
  it('draws the intro, its two links and the step tiles', async () => {
    renderBlocks([BAND], { segment: 'overview' });

    const band = await screen.findByRole('region', { name: 'The Library Act' });
    expect(within(band).getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'extended-overview-how',
    );
    expect(within(band).getByText('How it is built')).toBeInTheDocument();
    expect(within(band).getByRole('link', { name: /^How the Act works/ })).toHaveAttribute(
      'href',
      '/p/lib-1/act',
    );
    expect(within(band).getByRole('link', { name: /^Read the Act/ })).toHaveAttribute(
      'href',
      'https://example.org/act-text',
    );
    expect(
      within(band)
        .getAllByRole('listitem')
        .map((step) => step.textContent),
    ).toEqual(['1PlanBoard drafts', '2BuildCrews on site']);
    for (const numeral of within(band).getAllByText(/^[12]$/)) {
      expect(numeral).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('leaves the links out when the band has none', async () => {
    const { primary: _primary, secondary: _secondary, ...plain } = BAND;
    renderBlocks([plain]);

    const band = await screen.findByRole('region', { name: 'The Library Act' });
    expect(within(band).queryByRole('link', { name: /Act works|Read the Act/ })).toBeNull();
  });
});
