import { useEffect, useRef, useState } from 'react';
import { ValuePicker } from './value-picker';
import { YearPicker } from './year-picker';
import type { FilterValue, FilterValues, GridColumn } from './types';

/** Typing should not fire a request per keystroke; pickers and years apply at once. */
const TEXT_DEBOUNCE_MS = 300;

function TextFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // What the parent last agreed on: the draft is only pushed when it moves away from this.
  const applied = useRef(value);
  const emit = useRef(onChange);

  useEffect(() => {
    emit.current = onChange;
  });

  useEffect(() => {
    if (value === applied.current) return;
    applied.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = draft;
      emit.current(draft);
    }, TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <label>
      <span className="display-grid__visually-hidden">{`Filter by ${label}`}</span>
      <input
        type="text"
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

function asText(value: FilterValue | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
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
