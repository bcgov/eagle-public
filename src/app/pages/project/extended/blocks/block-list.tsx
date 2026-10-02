import { logger } from 'app/config/logging';
import type { Block } from '../types';
import type { BlockContext } from './block-context';
import { BandBlockView } from './band-block';
import { ColumnsBlockView } from './columns-block';
import { ContactsBlockView } from './contacts-block';
import { DefinitionsBlockView } from './definitions-block';
import { LinksBlockView } from './links-block';
import { ListBlockView } from './list-block';
import { ProjectsBlockView } from './projects-block';
import { ProseBlockView } from './prose-block';
import { RouteMapBlockView } from './route-map-block';
import { StatCardsBlockView } from './stat-cards-block';
import { StepsBlockView } from './steps-block';
import { SummaryBlockView } from './summary-block';
import { TableBlockView } from './table-block';
import { TimelineBlockView } from './timeline-block';
import { UpdatesBlockView } from './updates-block';

function BlockView({ block, context }: { block: Block; context: BlockContext }) {
  switch (block.type) {
    case 'summary':
      return <SummaryBlockView block={block} context={context} />;
    case 'routeMap':
      return <RouteMapBlockView block={block} context={context} />;
    case 'table':
      return <TableBlockView block={block} context={context} />;
    case 'statCards':
      return <StatCardsBlockView block={block} context={context} />;
    case 'updates':
      return <UpdatesBlockView block={block} context={context} />;
    case 'definitions':
      return <DefinitionsBlockView block={block} context={context} />;
    case 'projects':
      return <ProjectsBlockView block={block} context={context} />;
    case 'links':
      return <LinksBlockView block={block} context={context} />;
    case 'contacts':
      return <ContactsBlockView block={block} context={context} />;
    case 'list':
      return <ListBlockView block={block} context={context} />;
    case 'steps':
      return <StepsBlockView block={block} context={context} />;
    case 'columns':
      return <ColumnsBlockView block={block} context={context} />;
    case 'prose':
      return <ProseBlockView block={block} context={context} />;
    case 'timeline':
      return <TimelineBlockView block={block} context={context} />;
    case 'band':
      return <BandBlockView block={block} context={context} />;
    default: {
      // A new block type fails type-check here until it has a case.
      const unknown: never = block;
      logger.warn(`Unknown block type ${JSON.stringify(unknown)}`, 'BlockList');
      return null;
    }
  }
}

/** The blocks of one region of a content tab, in order. */
export function BlockList({ blocks, context }: { blocks: Block[]; context: BlockContext }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} context={context} />
      ))}
    </>
  );
}
