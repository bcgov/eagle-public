import { RichTextView } from '../rich-text';
import type { DefinitionsBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';
import './definitions-block.css';

/** Terms and what each means, e.g. who does what. Left out when there are none. */
export function DefinitionsBlockView({
  block,
  context,
}: {
  block: DefinitionsBlock;
  context: BlockContext;
}) {
  if (block.items.length === 0) return null;
  return (
    <BlockSection block={block} context={context} className="extended-copy">
      <dl className="extended-definitions">
        {block.items.map((item) => (
          <div key={item.term}>
            <dt>{item.term}</dt>
            <dd>
              <RichTextView text={item.detail} />
            </dd>
          </div>
        ))}
      </dl>
    </BlockSection>
  );
}
