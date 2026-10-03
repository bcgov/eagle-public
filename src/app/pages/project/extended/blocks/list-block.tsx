import { RichTextView } from '../rich-text';
import type { ListBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';
import './list-block.css';

/** A lead line, then a numbered list with round numerals or a bulleted one. Left out when empty. */
export function ListBlockView({ block, context }: { block: ListBlock; context: BlockContext }) {
  if (block.items.length === 0) return null;
  return (
    <BlockSection block={block} context={context}>
      {block.intro && (
        <p className="extended-list__lead">
          <RichTextView text={block.intro} />
        </p>
      )}
      {block.style === 'numbered' ? (
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none`
        <ol role="list" className="extended-numbered">
          {block.items.map((item, index) => (
            <li key={index}>
              <span className="extended-numbered__num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="extended-list__item">
                <RichTextView text={item} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="extended-list__bullets extended-copy">
          {block.items.map((item, index) => (
            <li key={index}>
              <RichTextView text={item} />
            </li>
          ))}
        </ul>
      )}
    </BlockSection>
  );
}
