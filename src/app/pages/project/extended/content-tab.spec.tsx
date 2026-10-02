import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../../../test-utils';
import { ExtendedPageContext } from '../project-context';
import { ContentTab } from './content-tab';
import { SAMPLE_PAGE } from './fixtures/blocks';
import type { Block, ContentTabEntry } from './types';

const PROSE: Block = { type: 'prose', id: 'why', heading: 'Why a new wing', text: 'More room.' };
const LINKS: Block = {
  type: 'links',
  id: 'read',
  heading: 'Read more',
  style: 'list',
  items: [{ label: 'City plan', href: 'https://example.org/plan' }],
};
const CONTACTS: Block = {
  type: 'contacts',
  id: 'ask',
  heading: 'Ask us',
  items: [{ label: 'Desk', link: { label: 'desk@example.org', href: 'mailto:desk@example.org' } }],
};

function renderTab(entry: ContentTabEntry, state?: unknown) {
  return renderAt(
    [{ pathname: `/p/lib-1/${entry.segment}`, state }],
    [
      {
        path: '/p/:projId/:segment',
        // The shell provides the page, which links its `autoLinks` terms in running copy.
        element: (
          <ExtendedPageContext value={SAMPLE_PAGE}>
            <ContentTab entry={entry} content={SAMPLE_PAGE} project={null} basePath="/p/lib-1" />
          </ExtendedPageContext>
        ),
      },
    ],
  );
}

describe('ContentTab', () => {
  it('draws a tab without a title as main and aside columns of h2 sections', async () => {
    renderTab({ segment: 'faq', main: [PROSE], aside: [LINKS, CONTACTS] });

    const main = await screen.findByRole('region', { name: 'Why a new wing' });
    expect(within(main).getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'extended-faq-why',
    );
    const aside = screen.getByRole('complementary');
    expect(within(aside).getAllByRole('region')).toHaveLength(2);
    expect(aside).not.toHaveAttribute('aria-labelledby');
  });

  it('puts the title and intro over the blocks, which become h3 card titles', async () => {
    renderTab({
      segment: 'faq',
      title: 'Questions',
      intro: 'Answers about the Library Act.',
      main: [PROSE],
    });

    expect(await screen.findByRole('heading', { level: 2, name: 'Questions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Library Act/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Why a new wing' })).toHaveClass(
      'extended-card__title',
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('names a one-block aside by that block heading, and leaves the block unnamed', async () => {
    renderTab({ segment: 'faq', title: 'Questions', main: [PROSE], aside: [LINKS] });

    const aside = await screen.findByRole('complementary', { name: 'Read more' });
    expect(within(aside).queryByRole('region')).not.toBeInTheDocument();
  });

  it('moves focus to the title when an in-page link opened the tab', async () => {
    renderTab({ segment: 'faq', title: 'Questions', main: [PROSE] }, { focusTab: true });

    expect(await screen.findByRole('heading', { level: 2, name: 'Questions' })).toHaveFocus();
  });

  it('clears the focus flag from history once it has moved focus', async () => {
    const { router } = renderTab(
      { segment: 'faq', title: 'Questions', main: [PROSE] },
      {
        focusTab: true,
      },
    );

    expect(await screen.findByRole('heading', { level: 2, name: 'Questions' })).toHaveFocus();
    expect(router.state.location.pathname).toBe('/p/lib-1/faq');
    expect(router.state.location.state).toBeNull();
  });

  it.each([
    ['with an aside', { aside: [LINKS] }],
    ['without an aside', {}],
  ])('moves focus to the tab itself when it has no title, %s', async (_name, extra) => {
    const { container } = renderTab(
      { segment: 'faq', main: [PROSE], ...extra },
      { focusTab: true },
    );

    await screen.findByRole('region', { name: 'Why a new wing' });
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.parentElement).toBe(container);
  });

  it('moves focus to the full updates list heading on a tab with no title', async () => {
    const updates: Block = { type: 'updates', id: 'all', heading: 'All updates' };
    renderTab({ segment: 'news', main: [updates] }, { focusTab: true });

    expect(await screen.findByRole('heading', { level: 2, name: 'All updates' })).toHaveFocus();
  });

  it('leaves focus alone when the tab opened from the strip', async () => {
    renderTab({ segment: 'faq', title: 'Questions', main: [PROSE] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Questions' })).not.toHaveFocus();
  });

  it('draws a tab with neither title nor aside as its blocks alone', async () => {
    const { container } = renderTab({ segment: 'faq', main: [PROSE] });

    const section = await screen.findByRole('region', { name: 'Why a new wing' });
    expect(section.parentElement).toBe(container);
  });
});
