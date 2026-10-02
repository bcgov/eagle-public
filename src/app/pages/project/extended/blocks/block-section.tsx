import type { ReactNode, Ref } from 'react';
import type { Block } from '../types';
import { classNames, headingId, type BlockContext } from './block-context';

interface HeadingProps {
  block: Block;
  context: BlockContext;
  className?: string;
}

/**
 * A block's heading: an h2 on a tab without a title, a card title under one. With `headingRef` it
 * can take focus, for a block whose heading stands in for the tab's.
 */
export function BlockHeading({
  block,
  context,
  className,
  headingRef,
}: HeadingProps & { headingRef?: Ref<HTMLHeadingElement> }) {
  const Tag = context.level === 2 ? 'h2' : 'h3';
  return (
    <Tag
      id={headingId(context.segment, block.id)}
      ref={headingRef}
      tabIndex={headingRef ? -1 : undefined}
      className={classNames(context.level === 3 && 'extended-card__title', className)}
    >
      {block.heading}
    </Tag>
  );
}

/** A heading inside a block: one level under the block's heading, or at its level when it has none. */
export function Subheading({
  block,
  context,
  className,
  children,
}: {
  block: Block;
  context: BlockContext;
  className: string;
  children: ReactNode;
}) {
  const level = block.heading ? context.level + 1 : context.level;
  const Tag = level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
  return <Tag className={className}>{children}</Tag>;
}

interface SectionProps extends HeadingProps {
  headingClassName?: string;
  children: ReactNode;
}

/** The section most blocks share: named by its heading, a card when `framed`. */
export function BlockSection({
  block,
  context,
  className,
  headingClassName,
  children,
}: SectionProps) {
  const labelled = !!block.heading && context.labelled;
  return (
    <section
      className={classNames(block.framed && 'extended-card', className)}
      aria-labelledby={labelled ? headingId(context.segment, block.id) : undefined}
    >
      {block.heading && (
        <BlockHeading block={block} context={context} className={headingClassName} />
      )}
      {children}
    </section>
  );
}
