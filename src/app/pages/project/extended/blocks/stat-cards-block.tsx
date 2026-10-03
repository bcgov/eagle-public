import { ContentLink } from '../content-link';
import { RichTextView } from '../rich-text';
import type { StatCardsBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';
import './stat-cards-block.css';

/** Big figures in grey tiles, each with its source, and a note under them. */
export function StatCardsBlockView({
  block,
  context,
}: {
  block: StatCardsBlock;
  context: BlockContext;
}) {
  return (
    <BlockSection block={block} context={context} className="extended-copy">
      <div className="extended-stat-cards">
        {block.cards.map((card, index) => (
          <div key={index} className="extended-tile">
            <p className="extended-stat-cards__value">{card.value}</p>
            <p className="extended-stat-cards__text">
              <RichTextView text={card.text} />
              {card.source && (
                <>
                  {' '}
                  Source: <ContentLink href={card.source.href}>{card.source.label}</ContentLink>
                </>
              )}
            </p>
          </div>
        ))}
      </div>
      {block.note && (
        <p className="extended-stat-cards__note">
          <RichTextView text={block.note} />
        </p>
      )}
    </BlockSection>
  );
}
