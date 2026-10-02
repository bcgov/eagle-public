import { Skeleton } from 'app/components/skeleton/skeleton';
import { newlines } from 'app/utils/newlines';
import { safeHtml } from 'app/utils/safe-html';
import { useProjectContext } from '../../project-context';
import type { SummaryBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection, Subheading } from './block-section';
import '../extended.css';
import './summary-block.css';

/** The content's description, or the record's when the content has none. */
function Description({ content, record }: { content: string; record?: string }) {
  // Read softly: a test may render the block without the shell's outlet.
  const loading = useProjectContext()?.projectLoading ?? false;
  if (content.trim()) return <p className="details-panel__description">{content}</p>;
  if (loading) {
    return (
      <div className="extended-summary__description" aria-busy="true">
        <span className="visually-hidden">Loading project description</span>
        <Skeleton lines={3} />
      </div>
    );
  }
  if (!record?.trim()) return null;
  return (
    <p
      className="details-panel__description"
      dangerouslySetInnerHTML={safeHtml(newlines(record))}
    ></p>
  );
}

/** About: the description, headline figures, and a numbered list such as major components. */
export function SummaryBlockView({
  block,
  context,
}: {
  block: SummaryBlock;
  context: BlockContext;
}) {
  return (
    <BlockSection block={block} context={context}>
      <Description
        content={block.description ?? ''}
        record={context.project?.description?.toString()}
      />
      {!!block.stats?.length && (
        <dl className="extended-summary__stats">
          {block.stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {block.itemsHeading && (
        <Subheading block={block} context={context} className="extended-block__subtitle">
          {block.itemsHeading}
        </Subheading>
      )}
      {!!block.items?.length && (
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none`
        <ol className="extended-numbered" role="list">
          {block.items.map((item, index) => (
            <li key={item}>
              <span className="extended-numbered__num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="extended-summary__item">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </BlockSection>
  );
}
