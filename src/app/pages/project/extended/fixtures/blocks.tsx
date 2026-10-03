import type { Project } from 'app/models/project';
import { renderAt } from '../../../../../test-utils';
import { ExtendedPageContext } from '../../project-context';
import { BlockList } from '../blocks/block-list';
import type { BlockContext } from '../blocks/block-context';
import type { Block, ExtendedPage } from '../types';

/** A made-up page for block specs: a small library extension, nothing like any real project. */
export const SAMPLE_PAGE: ExtendedPage = {
  version: 1,
  displayName: 'Harbour Library',
  autoLinks: [{ text: 'Library Act', href: 'https://example.org/library-act' }],
  updates: [
    {
      date: '3 Mar 2026',
      source: 'City of Harbour',
      headline: 'Design approved',
      href: 'https://example.org/design',
      summary: 'Council approved the design under the Library Act.',
    },
    {
      date: '2 Feb 2026',
      source: 'Library Board',
      headline: 'Open house held',
      href: 'https://example.org/open-house',
      summary: 'About 200 people came.',
    },
    {
      date: '1 Jan 2026',
      source: 'City of Harbour',
      headline: 'Project announced',
      href: 'https://example.org/announced',
      summary: 'A new wing for the library.',
    },
  ],
  timeline: {
    title: 'Build progress',
    note: 'City process',
    currentStep: 1,
    stateLabels: { complete: 'Done', current: 'Under way', upcoming: 'Next' },
    steps: [
      { name: 'Design', dateLabel: 'Jan 2026', detail: 'Plans drawn.' },
      { name: 'Build', dateLabel: 'Mar 2026', detail: 'Crews on site.' },
      { name: 'Open', dateLabel: 'Sep 2026', detail: 'Doors open.' },
    ],
  },
};

/** Where the blocks render: `/p/lib-1/<segment>`. */
const SAMPLE_BASE = '/p/lib-1';

/**
 * Renders `blocks` the way a content tab does, under the page's context so running copy links its
 * `autoLinks` terms. Any segment matches, so a link to a sibling tab lands on a route.
 */
export function renderBlocks(
  blocks: Block[],
  {
    content = SAMPLE_PAGE,
    project = null,
    segment = 'about',
    level = 2,
    labelled = true,
  }: Partial<BlockContext> & { project?: Project | null } = {},
) {
  const context: BlockContext = {
    segment,
    content,
    project,
    basePath: SAMPLE_BASE,
    level,
    labelled,
  };
  return renderAt(`${SAMPLE_BASE}/${segment}`, [
    {
      path: '/p/:projId/:segment',
      element: (
        <ExtendedPageContext value={content}>
          <BlockList blocks={blocks} context={context} />
        </ExtendedPageContext>
      ),
    },
  ]);
}
