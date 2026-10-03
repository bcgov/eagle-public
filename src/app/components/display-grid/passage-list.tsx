import { Fragment, useId, useState } from 'react';
import { Highlight } from './highlight';
import { PASSAGE_LOCATOR } from './passage-locator';
import { RecordLink } from './record-link';
import './passage-list.css';

/**
 * Passages a row shows before it is expanded. Two carry enough of the document's own words to
 * judge the hit, and still leave the next file name on the screen.
 */
const COLLAPSED_PASSAGES = 2;

export interface PassageHit {
  /** The page it sits on where the index records one, otherwise its place in the document. */
  locator: number;
  text: string;
  /** The locator is a real page number, so it reads "Page N" and links into the file. */
  pageNumbered?: boolean;
}

export interface PassageRow {
  id: string;
  name: string;
  /** The file itself. Already scheme-checked by the caller. */
  href: string;
  date: string | null;
  type: string | null;
  author: string | null;
  passages: PassageHit[];
  /** Matching passages in the document, which can be more than the search returned. */
  total: number;
}

export interface PassageListProps {
  rows: PassageRow[];
  /** Search terms from `toTerms`, for the highlights. */
  terms: string[];
  loading?: boolean;
  /** Row checkboxes, on the same gate the table's are: a row is the document its passages are in. */
  selectable?: boolean;
  /** Document ids already in the basket, which the table fills from the same list. */
  selectedIds?: string[];
  /** Called with the document id of the row that was ticked. */
  onToggle?: (id: string) => void;
}

function passageCount(total: number): string {
  return `${total} matching passage${total === 1 ? '' : 's'}`;
}

function moreLabel(open: boolean, rest: number): string {
  if (open) return 'Show fewer passages';
  return `${rest} more passage${rest === 1 ? '' : 's'}`;
}

function PassageRowView({
  row,
  terms,
  selectable = false,
  selected = false,
  onToggle,
}: {
  row: PassageRow;
  terms: string[];
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}) {
  const countId = useId();
  const passagesId = useId();
  const [open, setOpen] = useState(false);

  const shown = open ? row.passages : row.passages.slice(0, COLLAPSED_PASSAGES);
  const rest = row.passages.length - COLLAPSED_PASSAGES;
  const meta = [row.date, row.type, row.author].filter((part): part is string => !!part);

  return (
    <li
      className={`display-grid__list-item${
        selectable ? ' display-grid__list-item--selectable' : ''
      }`}
    >
      {selectable && (
        <input
          type="checkbox"
          className="display-grid__checkbox display-grid__list-check"
          aria-label={`Select ${row.name}`}
          checked={selected}
          onChange={() => onToggle?.(row.id)}
        />
      )}
      <div className="display-grid__row">
        <p className="display-grid__row-meta">
          {meta.map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <>
                  {' '}
                  <span aria-hidden="true">·</span>{' '}
                </>
              ) : null}
              {part}
            </Fragment>
          ))}
        </p>

        <h3 className="display-grid__row-title">
          <RecordLink href={row.href} external className="display-grid__row-link">
            <Highlight text={row.name} terms={terms} />
          </RecordLink>
        </h3>

        <p className="display-grid__passage-count" id={countId}>
          {passageCount(row.total)}
        </p>

        <ul className="display-grid__passages" id={passagesId} aria-labelledby={countId}>
          {shown.map((hit, index) => (
            <li className="display-grid__passage" key={`${index}-${hit.locator}`}>
              <span className="display-grid__passage-locator">
                {/* Plain text until the locator is a page: `RecordLink` drops an absent href. */}
                <RecordLink href={PASSAGE_LOCATOR.href(row, hit)} external>
                  {PASSAGE_LOCATOR.label(hit)}
                </RecordLink>
              </span>
              <span className="display-grid__passage-text">
                <Highlight text={hit.text} terms={terms} />
              </span>
            </li>
          ))}
        </ul>

        {rest > 0 ? (
          <button
            type="button"
            className="display-grid__row-more"
            aria-expanded={open}
            aria-controls={passagesId}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            {moreLabel(open, rest)}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The documents tab with the scope set to inside the documents: one row per file, and under the
 * file name the passages the index matched rather than the record's fields. Renders inside the
 * grid box, because it borrows the list row's own meta, headline and Show more styles.
 */
export function PassageList({
  rows,
  terms,
  loading,
  selectable = false,
  selectedIds = [],
  onToggle,
}: PassageListProps) {
  return (
    <div
      className={loading && rows.length > 0 ? 'display-grid__body--loading' : undefined}
      aria-busy={loading || undefined}
    >
      <ol className="display-grid__list">
        {rows.map((row) => (
          <PassageRowView
            key={row.id}
            row={row}
            terms={terms}
            selectable={selectable}
            selected={selectedIds.includes(row.id)}
            onToggle={onToggle}
          />
        ))}
      </ol>
    </div>
  );
}
