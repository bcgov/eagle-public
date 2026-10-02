import { Link } from 'react-router';
import { ContentLink } from '../content-link';
import { RichTextView } from '../rich-text';
import type { BandBlock } from '../types';
import { headingId, type BlockContext } from './block-context';
import '../extended.css';
import './band-block.css';

/**
 * A full-width band: eyebrow, heading, paragraphs and links beside a row of step tiles. Drawn from
 * a tab's `banner`, between the tab strip and the tab, so it spans the page outside
 * `.page-container`. Its heading is always an h2.
 */
export function BandBlockView({ block, context }: { block: BandBlock; context: BlockContext }) {
  const id = headingId(context.segment, block.id);
  return (
    <section className="extended-band" aria-labelledby={block.heading ? id : undefined}>
      <div className="page-container extended-band__inner">
        <div className="extended-band__intro">
          {block.eyebrow && <p className="overview-tab__eyebrow">{block.eyebrow}</p>}
          {block.heading && (
            <h2 id={id} className="extended-band__title">
              {block.heading}
            </h2>
          )}
          {block.paragraphs.map((paragraph, index) => (
            <p key={index} className="extended-band__text extended-copy">
              <RichTextView text={paragraph} />
            </p>
          ))}
          {(block.primary || block.secondary) && (
            <div className="overview-tab__callout-actions">
              {block.primary && (
                <Link
                  className="overview-tab__cta"
                  to={`${context.basePath}/${block.primary.tab}`}
                  state={{ focusTab: true }}
                >
                  {block.primary.label}
                  <i className="material-icons extended-band__icon" aria-hidden="true">
                    arrow_forward
                  </i>
                </Link>
              )}
              {block.secondary && (
                <ContentLink className="overview-tab__cta-secondary" href={block.secondary.href}>
                  {block.secondary.label}
                </ContentLink>
              )}
            </div>
          )}
        </div>

        {block.steps.length > 0 && (
          // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none`
          <ol className="extended-band__steps extended-numbered--blue" role="list">
            {block.steps.map((step, index) => (
              <li key={step.name} className="extended-tile">
                <span className="extended-numbered__num extended-band__num" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="extended-band__step-name">{step.name}</span>
                <span className="extended-band__step-short">{step.short}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
