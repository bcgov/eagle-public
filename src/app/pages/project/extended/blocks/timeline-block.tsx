import { extendedSteps } from '../extended-page';
import { RichTextView } from '../rich-text';
import type { TimelineBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection, Subheading } from './block-section';
import '../extended.css';
import './timeline-block.css';

/** The page's timeline, drawn vertically. Each stop says its state in words; the dot colour only
 * repeats it. Left out when the page has no timeline. */
export function TimelineBlockView({
  block,
  context,
}: {
  block: TimelineBlock;
  context: BlockContext;
}) {
  const { timeline } = context.content;
  if (!timeline) return null;
  return (
    <BlockSection block={block} context={context} headingClassName="extended-timeline__title">
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ol role="list" className="extended-timeline">
        {extendedSteps(timeline).map((step) => (
          <li
            key={step.name}
            className={`extended-timeline__stop extended-timeline__stop--${step.state}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className="extended-timeline__marker" aria-hidden="true">
              <span className="extended-timeline__dot" />
              <span className="extended-timeline__line" />
            </span>
            <div className="extended-timeline__body">
              <Subheading block={block} context={context} className="extended-timeline__name">
                {step.name}
              </Subheading>
              <p className="extended-timeline__meta">
                {step.dateLabel} · {timeline.stateLabels[step.state]}
              </p>
              <p className="extended-timeline__detail extended-copy">
                <RichTextView text={step.detail} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </BlockSection>
  );
}
