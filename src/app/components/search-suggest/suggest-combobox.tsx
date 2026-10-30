import {
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import { SUGGEST_LIMIT, type SuggestItem } from 'app/api/suggest';
import type { SearchKind } from 'app/api/unified-search';
import { opensExternally } from 'app/components/display-grid/grid-helpers';
import type { RecordType } from 'app/components/display-grid/use-grid-url-state';
import { typeaheadKeywords } from 'app/components/filters/typeahead';
import { fromNativePeriod, periodDetailsHref } from 'app/models/commentperiod';
import { recordConfig } from 'app/pages/search/types';
import { searchUrl } from 'app/routes/legacy-search';
import { isSafeUrl } from 'app/utils/safe-url';
import { useSuggestions } from './use-suggestions';
import './suggest-combobox.css';

type InputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'placeholder' | 'className' | 'aria-label'
>;

interface SuggestComboboxProps {
  record: RecordType;
  value: string;
  onChange: (value: string) => void;
  /** The search the form would run: Enter with nothing highlighted, or the footer row. */
  onSubmit: () => void;
  inputProps?: InputProps;
}

interface RowText {
  label?: string;
  sub?: string;
}

/** Glyphs the bundled Material Icons subset carries; `campaign` is not in it. */
const ICONS: Record<SearchKind, string> = {
  projects: 'landscape',
  documents: 'insert_drive_file',
  updates: 'announcement',
  notifications: 'notifications_none',
  'comment-periods': 'forum',
};

const TEXT: { [K in SearchKind]: (item: SuggestItem<K>) => RowText } = {
  projects: (item) => ({ label: item.name }),
  documents: (item) => ({ label: item.displayName, sub: item.projectName }),
  updates: (item) => ({ label: item.headline, sub: item.projectName || item.notificationName }),
  notifications: (item) => ({ label: item.name }),
  // DEMI matches the label, else the project name, so the row shows whichever it matched.
  'comment-periods': (item) =>
    item.informationLabel
      ? { label: item.informationLabel, sub: item.projectName }
      : { label: item.projectName },
};

const DOCUMENTS_NOTE =
  'Suggestions match document names. Press Enter to also search inside documents.';

interface Option {
  key: string;
  /** Spoken name where the content splits words across elements. */
  name?: string;
  content: ReactNode;
  className: string;
  activate: () => void;
}

/** The label with the typed start left regular and the rest bold; no bold when it starts otherwise. */
function emphasised(label: string, typed: string): ReactNode {
  const head = label.slice(0, typed.length);
  if (typed === '' || head.toLowerCase() !== typed.toLowerCase()) return label;
  const rest = label.slice(typed.length);
  return (
    <>
      {head}
      {rest && <b>{rest}</b>}
    </>
  );
}

/** Where a suggestion opens: the link the record type's search column draws for the same row. */
function rowTarget(
  record: RecordType,
  item: SuggestItem,
  typed: string,
): { href: string; external: boolean } | undefined {
  // A period row draws its own link, so no column holds it.
  if (record === 'commentPeriods') {
    const href = periodDetailsHref(fromNativePeriod({ ...item }));
    return href ? { href, external: false } : undefined;
  }
  const column = recordConfig(record).columns.find((c) => c.link && c.href);
  if (!column) return undefined;
  // The column links read the full search row; the spread copy is that shape, holding the slim fields.
  const row: Record<string, unknown> = { ...item };
  const href =
    column.searchHref?.(row, { keywords: typed, filters: {}, yearIds: [] }) ?? column.href?.(row);
  if (!href) return undefined;
  return { href, external: Boolean(opensExternally(column, row)) };
}

/**
 * A keyword box that lists matching records under it as you type (WAI-ARIA combobox with list
 * autocomplete). Focus stays in the box; the arrow keys move the highlighted option.
 */
export function SuggestCombobox({
  record,
  value,
  onChange,
  onSubmit,
  inputProps,
}: SuggestComboboxProps) {
  const navigate = useNavigate();
  const id = useId();
  const listId = `${id}-list`;
  const noteId = `${id}-note`;
  const [open, setOpen] = useState(false);
  const { items, isError, isPlaceholderData, key } = useSuggestions(record, value);
  // Tied to the suggestions it was set on, so new rows or another kind start unhighlighted.
  const [highlight, setHighlight] = useState({ key, index: -1 });
  const active = highlight.key === key ? highlight.index : -1;

  const config = recordConfig(record);
  const kind = config.kind;
  const typed = value.trim();
  const visible = open && typeaheadKeywords(value) !== '';

  function setActive(index: number): void {
    setHighlight({ key, index });
  }

  function close(): void {
    setOpen(false);
    setActive(-1);
  }

  function submit(): void {
    close();
    onSubmit();
  }

  const rows: Option[] = (items ?? [])
    .map((item) => ({ item, ...(TEXT[kind] as (item: SuggestItem) => RowText)(item) }))
    .filter((row): row is typeof row & { label: string } => Boolean(row.label))
    .slice(0, SUGGEST_LIMIT)
    .map(({ item, label, sub }, index) => ({
      key: item.id ? `row-${item.id}` : `index-${index}`,
      name: sub ? `${label}, ${sub}` : label,
      className: 'search-suggest__row',
      content: (
        <>
          <i className="material-icons" aria-hidden="true">
            {ICONS[kind]}
          </i>
          <span className="search-suggest__text">
            <span className="search-suggest__label">{emphasised(label, typed)}</span>
            {sub && <span className="search-suggest__sub">{sub}</span>}
          </span>
        </>
      ),
      activate: () => {
        const target = rowTarget(record, item, typed);
        close();
        if (target?.external && isSafeUrl(target.href)) {
          window.open(target.href, '_blank', 'noopener');
        } else {
          void navigate(target && !target.external ? target.href : searchUrl(record, label));
        }
      },
    }));

  const footer: Option = {
    key: 'footer',
    className: 'search-suggest__foot',
    content: (
      <>
        <i className="material-icons" aria-hidden="true">
          search
        </i>
        <span>{`Search all ${config.noun ?? config.label.toLowerCase()} for “${typed}”`}</span>
      </>
    ),
    activate: submit,
  };
  const options = [...rows, footer];
  const note = kind === 'documents' && !isError ? DOCUMENTS_NOTE : '';
  const current = visible && active < options.length ? active : -1;
  const optionId = (index: number) => `${id}-option-${index}`;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!visible) setOpen(true);
        else setActive((current + 1) % options.length);
        break;
      case 'ArrowUp':
        if (!visible) return;
        event.preventDefault();
        setActive(current <= 0 ? options.length - 1 : current - 1);
        break;
      case 'Enter':
        // Enter that confirms an IME composition is the input method's, not a search;
        // Safari flags that Enter only by keyCode 229.
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        // Handled here so the surrounding form does not submit a second time.
        event.preventDefault();
        if (current >= 0) options[current].activate();
        else submit();
        break;
      case 'Escape':
        // An open list closes first; a closed one leaves Escape to clear the search box.
        if (!visible) return;
        event.preventDefault();
        close();
        break;
    }
  }

  return (
    <>
      <input
        {...inputProps}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={current >= 0 ? optionId(current) : undefined}
        aria-describedby={visible && note ? noteId : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (typeaheadKeywords(value) !== '') setOpen(true);
        }}
        onBlur={close}
      />
      <div
        className={`search-suggest${rows.length === 0 ? ' search-suggest--empty' : ''}`}
        hidden={!visible}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label={`${config.label} suggestions`}
          className="search-suggest__list"
        >
          {options.map((option, index) => (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- options never take focus; the box handles their keys
            <li
              key={option.key}
              id={optionId(index)}
              role="option"
              aria-label={option.name}
              aria-selected={index === current}
              className={option.className}
              onMouseDown={(event) => event.preventDefault()}
              onClick={option.activate}
            >
              {option.content}
            </li>
          ))}
        </ul>
        {note && (
          <p id={noteId} className="search-suggest__note">
            {note}
          </p>
        )}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {visible && items && !isPlaceholderData
          ? `${rows.length} suggestion${rows.length === 1 ? '' : 's'}`
          : ''}
      </span>
    </>
  );
}
