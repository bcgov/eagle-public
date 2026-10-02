import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks, SAMPLE_PAGE } from '../fixtures/blocks';
import type { UpdatesBlock } from '../types';

const CARD: UpdatesBlock = {
  type: 'updates',
  id: 'latest',
  heading: 'Latest news',
  shown: 2,
  tab: 'news',
};

const LIST: UpdatesBlock = {
  type: 'updates',
  id: 'all',
  heading: 'News',
  intro: 'Everything so far, newest first.',
};

describe('updates block as a side card', () => {
  it('shows the newest `shown` updates and links to the tab with the rest', async () => {
    renderBlocks([CARD]);

    const card = await screen.findByRole('region', { name: 'Latest news' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/^3 Mar 2026 · City of HarbourDesign approved/);
    expect(items[1]).toHaveTextContent(/^2 Feb 2026 · Library BoardOpen house held/);
    expect(within(card).getByRole('link', { name: /^See all 3/ })).toHaveAttribute(
      'href',
      '/p/lib-1/news',
    );
  });

  it('leaves its section unnamed where the region around it carries the name', async () => {
    renderBlocks([CARD], { labelled: false });

    await screen.findByRole('heading', { level: 2, name: 'Latest news' });
    expect(screen.queryByRole('region', { name: 'Latest news' })).not.toBeInTheDocument();
  });

  it('is left out when the page has no updates', async () => {
    renderBlocks([CARD, { type: 'prose', id: 'p', heading: 'After', text: 'x' }], {
      content: { ...SAMPLE_PAGE, updates: [] },
    });

    await screen.findByRole('heading', { name: 'After' });
    expect(screen.queryByRole('heading', { name: 'Latest news' })).not.toBeInTheDocument();
  });
});

describe('updates block as the full list', () => {
  it('lists every update with its summary and source under the intro', async () => {
    renderBlocks([LIST], { segment: 'news' });

    const section = await screen.findByRole('region', { name: 'News' });
    expect(within(section).getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'extended-news-all',
    );
    expect(within(section).getByText('Everything so far, newest first.')).toBeInTheDocument();
    const titles = within(section).getAllByRole('heading', { level: 3 });
    expect(titles).toHaveLength(3);
    expect(titles[0]).toHaveTextContent(/^Design approved/);
    expect(titles[2]).toHaveTextContent(/^Project announced/);
    expect(within(section).getAllByText(/^Source: /)).toHaveLength(3);
  });

  it('runs its intro as rich text', async () => {
    renderBlocks([{ ...LIST, intro: 'Every step under the Library Act so far.' }]);

    const section = await screen.findByRole('region', { name: 'News' });
    const intro = section.querySelector<HTMLElement>('.extended-tab__intro')!;
    expect(within(intro).getByRole('link', { name: /^Library Act/ })).toBeInTheDocument();
  });

  it('heads the list at the block level under a tab title, and leaves focus to that title', async () => {
    renderBlocks([LIST], { segment: 'news', level: 3 });

    const heading = await screen.findByRole('heading', { level: 3, name: 'News' });
    expect(heading).toHaveClass('extended-card__title');
    expect(heading).not.toHaveAttribute('tabindex');
  });

  it('keeps its heading and intro when there are no updates', async () => {
    renderBlocks([LIST], { content: { ...SAMPLE_PAGE, updates: [] } });

    const section = await screen.findByRole('region', { name: 'News' });
    expect(within(section).queryByRole('list')).not.toBeInTheDocument();
  });
});
