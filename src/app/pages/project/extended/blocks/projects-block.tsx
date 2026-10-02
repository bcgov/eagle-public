import { Link } from 'react-router';
import type { ProjectsBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection } from './block-section';
import '../extended.css';

/** Other projects on EPIC, each linked to its project page. Left out when there are none. */
export function ProjectsBlockView({
  block,
  context,
}: {
  block: ProjectsBlock;
  context: BlockContext;
}) {
  if (block.items.length === 0) return null;
  return (
    <BlockSection block={block} context={context} className="extended-copy">
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ul className="extended-related" role="list">
        {block.items.map((item) => (
          <li key={item.id}>
            <p className="extended-related__name">
              <Link to={`/p/${encodeURIComponent(item.id)}`}>{item.name}</Link>
            </p>
            <p className="extended-related__detail">{item.note}</p>
          </li>
        ))}
      </ul>
    </BlockSection>
  );
}
