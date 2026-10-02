import { RichTextView } from '../rich-text';
import type { ColumnsBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection, Subheading } from './block-section';
import '../extended.css';
import './columns-block.css';

/** Bullet lists side by side under their own headings, stacked when the column is narrow. */
export function ColumnsBlockView({
  block,
  context,
}: {
  block: ColumnsBlock;
  context: BlockContext;
}) {
  if (block.columns.length === 0) return null;
  return (
    <BlockSection block={block} context={context} headingClassName="extended-block__spaced-title">
      <div className="extended-columns">
        {block.columns.map((column) => (
          <div key={column.heading}>
            <Subheading block={block} context={context} className="extended-columns__heading">
              {column.heading}
            </Subheading>
            <ul className="extended-columns__bullets extended-copy">
              {column.items.map((item, index) => (
                <li key={index}>
                  <RichTextView text={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </BlockSection>
  );
}
