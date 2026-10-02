import { RichTextView } from '../rich-text';
import type { ProseBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';
import './prose-block.css';

/** A paragraph of running copy under a heading. */
export function ProseBlockView({ block, context }: { block: ProseBlock; context: BlockContext }) {
  return (
    <BlockSection block={block} context={context}>
      <p className="extended-prose extended-copy">
        <RichTextView text={block.text} />
      </p>
    </BlockSection>
  );
}
