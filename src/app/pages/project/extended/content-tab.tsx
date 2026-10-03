import type { RefCallback } from 'react';
import type { Project } from 'app/models/project';
import { BlockList } from './blocks/block-list';
import { classNames, headingId, type BlockContext } from './blocks/block-context';
import { RichTextView } from './rich-text';
import type { Block, ContentTabEntry, ExtendedPage, RichText } from './types';
import { TabFocusTarget, useFocusTabTitle, useOpenedByLink } from './use-focus-tab-title';
import './extended.css';
import './content-tab.css';

export interface ContentTabProps {
  entry: ContentTabEntry;
  content: ExtendedPage;
  /** The project record: the summary block's fallback description comes from it. */
  project: Project | null;
  /** `/p/:projId`, for links to sibling tabs. */
  basePath: string;
}

/** A block whose heading takes the tab's focus: a full updates list with a heading. */
function holdsTabFocus(block: Block): boolean {
  return block.type === 'updates' && block.shown === undefined && !!block.heading;
}

/** The tab's own heading, which takes focus when an in-page link opened the tab. */
function TabTitle({
  title,
  intro,
  titleRef,
}: {
  title: string;
  intro?: RichText;
  titleRef: RefCallback<HTMLElement>;
}) {
  return (
    <div>
      <h2 ref={titleRef} tabIndex={-1} className="extended-tab__title">
        {title}
      </h2>
      {intro && (
        <p className="extended-tab__lead extended-copy">
          <RichTextView text={intro} />
        </p>
      )}
    </div>
  );
}

/**
 * A tab drawn from content: its `main` blocks, beside its `aside` blocks when it has any, under its
 * title when it has one. `banner` is drawn by the shell, outside the tab. The wrapper carries
 * `extended-<segment>` for styles that belong to one tab.
 */
export function ContentTab({ entry, content, project, basePath }: ContentTabProps) {
  const { segment, title, intro, main, aside = [] } = entry;
  const context: BlockContext = {
    segment,
    content,
    project,
    basePath,
    level: title ? 3 : 2,
    labelled: true,
  };
  const focusRef = useFocusTabTitle();
  const heading = title ? <TabTitle title={title} intro={intro} titleRef={focusRef} /> : null;
  // With no title, a full updates list's heading stands in for it; failing that, the tab itself
  // takes focus, so it never drops to the page body.
  const focusBlock = title ? undefined : main.find(holdsTabFocus);
  const focusable = useOpenedByLink() && !title && !focusBlock;
  const containerProps = focusable ? { ref: focusRef, tabIndex: -1 } : {};
  const mainList = (
    <TabFocusTarget value={focusBlock ? { blockId: focusBlock.id, ref: focusRef } : null}>
      <BlockList blocks={main} context={context} />
    </TabFocusTarget>
  );

  if (aside.length > 0) {
    // A single block names the aside itself, so its section is left unnamed.
    const asideLabel =
      aside.length === 1 && aside[0]!.heading ? headingId(segment, aside[0]!.id) : undefined;
    return (
      <div
        {...containerProps}
        className={classNames(
          'record-layout',
          entry.layout === 'wide' && 'extended-layout--wide',
          `extended-${segment}`,
        )}
      >
        <div className="record-layout__main">
          {heading}
          {mainList}
        </div>
        <aside className="record-layout__aside" aria-labelledby={asideLabel}>
          <BlockList blocks={aside} context={{ ...context, labelled: !asideLabel }} />
        </aside>
      </div>
    );
  }

  if (heading) {
    return (
      <div className={`extended-stack extended-${segment}`}>
        {heading}
        {mainList}
      </div>
    );
  }

  return focusable ? <div {...containerProps}>{mainList}</div> : mainList;
}
