import { ContentLink } from '../content-link';
import type { ContactsBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';

/** Who to contact for what, in the Overview contact card's markup. Left out when there are none. */
export function ContactsBlockView({
  block,
  context,
}: {
  block: ContactsBlock;
  context: BlockContext;
}) {
  if (block.items.length === 0) return null;
  return (
    <BlockSection block={block} context={context}>
      {block.items.map((contact) => (
        <div key={contact.label} className="overview-tab__contact">
          <p className="overview-tab__list-title">{contact.label}</p>
          <ContentLink href={contact.link.href}>{contact.link.label}</ContentLink>
        </div>
      ))}
    </BlockSection>
  );
}
