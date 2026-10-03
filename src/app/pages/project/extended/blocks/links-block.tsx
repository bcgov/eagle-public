import { ContentLink } from '../content-link';
import type { LinksBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';
import './links-block.css';

/** External links: cards with a line of detail, or a plain list. Left out when there are none. */
export function LinksBlockView({ block, context }: { block: LinksBlock; context: BlockContext }) {
  if (block.items.length === 0) return null;
  if (block.style === 'cards') {
    return (
      <BlockSection block={block} context={context} className="extended-copy">
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
        <ul className="extended-related" role="list">
          {block.items.map((item) => (
            <li key={item.label}>
              <p className="extended-related__name">
                <ContentLink href={item.href}>{item.label}</ContentLink>
              </p>
              {item.detail && <p className="extended-related__detail">{item.detail}</p>}
            </li>
          ))}
        </ul>
      </BlockSection>
    );
  }
  const listClass = block.style === 'compact' ? 'extended-sources' : 'extended-links__list';
  return (
    <BlockSection block={block} context={context}>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ul className={`extended-link-list ${listClass}`} role="list">
        {block.items.map((item) => (
          <li key={item.href + item.label}>
            <ContentLink href={item.href}>{item.label}</ContentLink>
          </li>
        ))}
      </ul>
    </BlockSection>
  );
}
