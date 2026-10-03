import { useContext } from 'react';
import { Link } from 'react-router';
import { ContentLink } from '../content-link';
import { RichTextView } from '../rich-text';
import type { ExtendedUpdate, UpdatesBlock } from '../types';
import { TabFocusTarget } from '../use-focus-tab-title';
import { headingId, type BlockContext } from './block-context';
import { BlockHeading } from './block-section';
import '../../decisions-tab.css';
import '../extended.css';
import './updates-block.css';

interface ViewProps {
  block: UpdatesBlock;
  context: BlockContext;
  updates: ExtendedUpdate[];
}

/** The newest few in a side card, with "See all" opening the tab that lists every one. */
function UpdatesCard({ block, context, updates }: ViewProps) {
  const id = headingId(context.segment, block.id);
  return (
    <section
      className="side-card"
      aria-labelledby={block.heading && context.labelled ? id : undefined}
    >
      <div className="side-card__header">
        {block.heading && <BlockHeading block={block} context={context} />}
        {block.tab && (
          <Link to={`${context.basePath}/${block.tab}`} state={{ focusTab: true }}>
            See all {updates.length}
            <span className="visually-hidden"> updates</span>
          </Link>
        )}
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
      <ul className="side-card__list" role="list">
        {updates.slice(0, block.shown).map((update) => (
          <li key={update.href + update.date}>
            <p className="side-card__meta">
              {update.date} · {update.source}
            </p>
            <ContentLink
              className="side-card__headline extended-updates__headline"
              href={update.href}
            >
              {update.headline}
            </ContentLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every update, newest first, in the Decisions tab's date-led card. When the tab names it as its
 * focus target, an in-page link that opens the tab moves focus to its heading. */
function UpdatesList({ block, context, updates }: ViewProps) {
  const target = useContext(TabFocusTarget);
  const id = headingId(context.segment, block.id);
  return (
    <section
      className="extended-updates"
      aria-labelledby={block.heading && context.labelled ? id : undefined}
    >
      {block.heading && (
        <BlockHeading
          block={block}
          context={context}
          className="extended-tab__title"
          headingRef={target?.blockId === block.id ? target.ref : undefined}
        />
      )}
      {block.intro && (
        <p className="extended-tab__intro">
          <RichTextView text={block.intro} />
        </p>
      )}

      {updates.length > 0 && (
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none`
        <ol role="list" className="decisions-tab__list">
          {updates.map((update) => (
            <li
              className="decisions-tab__item extended-updates__item"
              key={update.href + update.date}
            >
              <p className="decisions-tab__item-date">{update.date}</p>
              <div>
                <h3 className="decisions-tab__item-title">
                  <ContentLink href={update.href}>{update.headline}</ContentLink>
                </h3>
                <p className="decisions-tab__item-detail extended-copy">
                  <RichTextView text={update.summary} />
                </p>
                <p className="extended-updates__source">Source: {update.source}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * The page's updates. With `shown`, a side card of the newest few, left out when there are none;
 * without, the full list. Each headline links to the other government's release.
 */
export function UpdatesBlockView({
  block,
  context,
}: {
  block: UpdatesBlock;
  context: BlockContext;
}) {
  const updates = context.content.updates ?? [];
  if (block.shown === undefined) {
    return <UpdatesList block={block} context={context} updates={updates} />;
  }
  return updates.length > 0 ? (
    <UpdatesCard block={block} context={context} updates={updates} />
  ) : null;
}
