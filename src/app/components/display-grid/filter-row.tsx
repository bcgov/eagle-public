import { FILTER_TEXT_MAX, useDebouncedDraft } from './use-debounced-draft';
import { ValuePicker } from './value-picker';
import { YearPicker } from './year-picker';
import type { FilterValue, FilterValues, GridColumn } from './types';

/** Typing should not fire a request per keystroke; pickers and years apply at once. */
function TextFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useDebouncedDraft(value, onChange);

  return (
    <label>
      <span className="display-grid__visually-hidden">{`Filter by ${label}`}</span>
      <input
        type="text"
        /* The browser's own history of this box is noise: what has been searched for is in the
           address bar, and the menu would cover the row below. `text`, not `search`, so the one
           searchbox on the page stays the keyword field at the top. */
        autoComplete="off"
        maxLength={FILTER_TEXT_MAX}
        className={`display-grid__control${draft ? ' display-grid__control--on' : ''}`}
        placeholder={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
}

function asArray(value: FilterValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * One stored value as the single string a text or year control holds.
 *
 * Joined, not first: the URL splits a value on commas, so a typed name that carries one arrives
 * here in pieces and has to be put back before it is shown. A year has no comma to split on.
 */
function asText(value: FilterValue | undefined): string {
  return Array.isArray(value) ? value.join(',') : (value ?? '');
}

interface FilterRowProps<Row> {
  columns: GridColumn<Row>[];
  values: FilterValues;
  onChange: (id: string, value: FilterValue) => void;
  selectable?: boolean;
  /** The header row's measured height. The filter row sticks directly under it. */
  top: number;
}

export function FilterRow<Row>({
  columns,
  values,
  onChange,
  selectable = false,
  top,
}: FilterRowProps<Row>) {
  return (
    <tr className="display-grid__filter-row" data-tour="filterrow">
      {selectable && <td className="display-grid__filter-cell" style={{ top }} />}
      {columns.map((column) => {
        const id = column.filterId ?? column.key;
        const options = column.options ?? [];
        return (
          <td key={column.key} className="display-grid__filter-cell" style={{ top }}>
            {column.filter === 'text' && (
              <TextFilter
                label={column.label}
                value={asText(values[id])}
                onChange={(next) => onChange(id, next)}
              />
            )}
            {column.filter === 'year' && (
              <YearPicker
                label={column.label}
                years={options.map((option) => option.value)}
                value={asText(values[id])}
                onChange={(next) => onChange(id, next)}
              />
            )}
            {column.filter === 'values' && (
              <ValuePicker
                label={column.label}
                options={options}
                selected={asArray(values[id])}
                onChange={(next) => onChange(id, next)}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}
