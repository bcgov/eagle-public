import { RichTextView } from '../rich-text';
import type { TableBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';
import './table-block.css';

/** Named rows with a value on the right, between an intro and a footnote. */
export function TableBlockView({ block, context }: { block: TableBlock; context: BlockContext }) {
  return (
    <BlockSection block={block} context={context} className="extended-copy">
      {block.intro && (
        <p className="extended-table__intro">
          <RichTextView text={block.intro} />
        </p>
      )}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ul className="extended-table" role="list">
        {block.rows.map((row) => (
          <li key={row.name} className="extended-table__row">
            <span className="extended-table__who">
              <span className="extended-table__name">{row.name}</span>
              {row.note && <span className="extended-table__note">{row.note}</span>}
            </span>
            <span className="extended-table__share">{row.value}</span>
          </li>
        ))}
      </ul>
      {block.footnote && (
        <p className="extended-table__footnote">
          <RichTextView text={block.footnote} />
        </p>
      )}
    </BlockSection>
  );
}
