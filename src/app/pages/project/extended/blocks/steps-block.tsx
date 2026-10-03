import { RichTextView } from '../rich-text';
import type { StepsBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection, Subheading } from './block-section';
import '../extended.css';
import './steps-block.css';

/** Numbered steps joined by a line, each with its detail and an optional note. */
export function StepsBlockView({ block, context }: { block: StepsBlock; context: BlockContext }) {
  if (block.steps.length === 0) return null;
  return (
    <BlockSection block={block} context={context} headingClassName="extended-block__spaced-title">
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ol role="list" className="extended-numbered extended-numbered--blue extended-steps__list">
        {block.steps.map((step, index) => (
          <li key={step.name} className="extended-steps__step">
            <span className="extended-steps__marker" aria-hidden="true">
              <span className="extended-numbered__num">{index + 1}</span>
              <span className="extended-steps__line" />
            </span>
            <div className="extended-steps__body">
              <Subheading block={block} context={context} className="extended-steps__name">
                {step.name}
              </Subheading>
              <p className="extended-steps__detail extended-copy">
                <RichTextView text={step.detail} />
              </p>
              {step.note && (
                <p className="extended-steps__note">
                  {block.noteLabel ? <>{block.noteLabel}: </> : null}
                  {step.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </BlockSection>
  );
}
