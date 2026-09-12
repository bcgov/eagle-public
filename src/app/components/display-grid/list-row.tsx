import { Fragment, useId, useState, type ReactNode } from 'react';
import { isSafeUrl } from 'app/utils/safe-url';
import { Highlight, excerptAround } from './highlight';
import { RecordLink } from './record-link';
import './list-row.css';

/** Over this many characters the body is clamped and offered a Show more. */
const CLAMP_AT = 260;

export interface ListRowAttachment {
  name: string;
  href: string;
  /** File type as the record states it, e.g. `PDF`. */
  type?: string;
  /** Already formatted, e.g. `1.2 MB`. */
  size?: string;
}

export interface ListRowField {
  label: string;
  value: ReactNode;
}

export interface ListRowProps {
  /** Meta line parts, joined with a middot. A part may be a link the caller built. */
  meta: ReactNode[];
  title: string;
  /** Omitted where the record has no page of its own — an activity, for instance. */
  href?: string;
  /** The href leaves the app — a file download, say. */
  external?: boolean;
  body?: string;
  /** Search terms from `toTerms`, for the excerpt and the highlights. */
  terms?: string[];
  attachments?: ListRowAttachment[];
  /** Shown instead of a body, for records that have none. */
  fields?: ListRowField[];
  /** Controlled expansion. Left out, the row keeps its own. */
  expanded?: boolean;
  onToggle?: () => void;
}

function attachmentMeta(attachment: ListRowAttachment): string {
  return [attachment.type, attachment.size].filter(Boolean).join(' · ');
}

/**
 * One record per row, full width: meta line, headline, clamped body and the record's attachments.
 * Used for activities, and for any record shown as a content hit rather than a grid row.
 */
export function ListRow({
  meta,
  title,
  href,
  external,
  body,
  terms,
  attachments,
  fields,
  expanded,
  onToggle,
}: ListRowProps) {
  const docsId = useId();
  const [selfExpanded, setSelfExpanded] = useState(false);
  const isOpen = expanded ?? selfExpanded;
  const toggle = onToggle ?? (() => setSelfExpanded((open) => !open));

  const full = body ?? '';
  const long = full.length > CLAMP_AT;
  // Collapsed, the excerpt starts at the first hit: a match in paragraph three is no use if the
  // row shows paragraph one.
  const shown = isOpen || !long ? full : excerptAround(full, terms, { length: CLAMP_AT });
  const attached = attachments ?? [];
  const pairs = full ? [] : (fields ?? []);

  return (
    <div className="display-grid__row">
      <p className="display-grid__row-meta">
        {meta.map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? <span aria-hidden="true"> · </span> : null}
            {part}
          </Fragment>
        ))}
      </p>

      <h3 className="display-grid__row-title">
        <RecordLink href={href} external={external} className="display-grid__row-link">
          <Highlight text={title} terms={terms} />
        </RecordLink>
      </h3>

      {pairs.length > 0 ? (
        <dl className="display-grid__row-fields">
          {pairs.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {full ? (
        <p
          className={
            isOpen
              ? 'display-grid__row-body'
              : 'display-grid__row-body display-grid__row-body--clamped'
          }
        >
          <Highlight text={shown} terms={terms} />
        </p>
      ) : null}

      {long ? (
        <button
          type="button"
          className="display-grid__row-more"
          aria-expanded={isOpen}
          onClick={toggle}
        >
          {isOpen ? 'Show less' : 'Show more'}
        </button>
      ) : null}

      {attached.length > 0 ? (
        <div className="display-grid__row-docs">
          <p className="display-grid__row-docs-count" id={docsId}>
            {attached.length === 1 ? '1 document' : `${attached.length} documents`}
          </p>
          <ul aria-labelledby={docsId}>
            {attached.map((attachment) => (
              <li key={attachment.href}>
                {isSafeUrl(attachment.href) ? (
                  <a href={attachment.href} download>
                    {attachment.name}
                  </a>
                ) : (
                  <span>{attachment.name}</span>
                )}
                <span className="display-grid__row-docs-meta">{attachmentMeta(attachment)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
