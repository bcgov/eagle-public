/* eslint-disable react-refresh/only-export-components -- the date rule is this panel's, and the
   grid applies the same test before it turns a typed date into a filter. */
import { useId, useState } from 'react';
import type { AdvancedField, FilterValues } from './types';
import './advanced-filters.css';

/** The panel's element id, so the toolbar button can name it in `aria-controls`. */
export const ADVANCED_FILTERS_ID = 'display-grid-advanced-filters';

const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * A typed date counts only once it is a real YYYY-MM-DD. The round trip through `Date` rejects
 * 2025-02-31, which the pattern alone accepts.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

export interface AdvancedFiltersProps {
  fields: AdvancedField[];
  values: FilterValues;
  /** `null` clears the filter. An unparseable date emits nothing at all. */
  onChange: (id: string, value: string | null) => void;
  open: boolean;
}

function asText(value: FilterValues[string] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? value.join(',') : value;
}

/** The applied text of every date field, which is what a draft is measured against. */
function dateTexts(fields: AdvancedField[], values: FilterValues): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const field of fields) {
    if (field.kind === 'date') texts[field.id] = asText(values[field.id]);
  }
  return texts;
}

/**
 * The filterable parts of a record that no column shows: date ranges, legislation, flags.
 * Collapsed by default and `hidden` rather than unmounted, so the toolbar's `aria-controls`
 * always points at an element that exists.
 */
export function AdvancedFilters({ fields, values, onChange, open }: AdvancedFiltersProps) {
  const headingId = useId();
  /* Dates are typed a character at a time, so the field holds what was typed while the applied
     filter holds only what parsed. Without the draft the input would erase itself mid-entry. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lastApplied, setLastApplied] = useState<Record<string, string>>(() =>
    dateTexts(fields, values),
  );
  const [lastCount, setLastCount] = useState(() => Object.keys(values).length);

  /* A draft only outlives the keystroke that made it. Once the applied filter changes from
     outside - a chip dropped, Clear all - the typed text is stale and the prop wins again.
     A date that never parsed has no applied text to change, so clearing the whole set is what
     drops it: otherwise it would sit there with its format error after every filter is gone. */
  const applied = dateTexts(fields, values);
  const count = Object.keys(values).length;
  const cleared = count === 0 && lastCount > 0;
  const changed = Object.keys(applied).filter((id) => applied[id] !== lastApplied[id]);
  if (changed.length > 0 || count !== lastCount) {
    setLastApplied(applied);
    setLastCount(count);
    setDrafts((current) => {
      if (cleared) return {};
      const next = { ...current };
      for (const id of changed) delete next[id];
      return next;
    });
  }

  function draftOf(field: AdvancedField): string {
    return drafts[field.id] ?? asText(values[field.id]);
  }

  function onDateInput(field: AdvancedField, typed: string): void {
    setDrafts((current) => ({ ...current, [field.id]: typed }));
    if (typed.trim() === '') {
      onChange(field.id, null);
    } else if (isValidIsoDate(typed.trim())) {
      onChange(field.id, typed.trim());
    }
    // Anything else is still being typed or is wrong: no filter change, no chip, no count.
  }

  return (
    <div
      className="display-grid__panel"
      id={ADVANCED_FILTERS_ID}
      hidden={!open}
      aria-labelledby={headingId}
    >
      <h2 className="display-grid__panel-heading" id={headingId}>
        Advanced filters
      </h2>
      <div className="display-grid__panel-grid">
        {fields.map((field) => {
          const value = draftOf(field);
          const invalid =
            field.kind === 'date' && value.trim() !== '' && !isValidIsoDate(value.trim());

          if (field.kind === 'toggle') {
            return (
              <label className="display-grid__panel-field" key={field.id}>
                <span className="display-grid__panel-label">{field.label}</span>
                <span className="display-grid__panel-toggle">
                  <input
                    type="checkbox"
                    checked={asText(values[field.id]) === 'true'}
                    onChange={(event) => onChange(field.id, event.target.checked ? 'true' : null)}
                  />
                </span>
              </label>
            );
          }

          if (field.kind === 'date') {
            return (
              <label className="display-grid__panel-field" key={field.id}>
                <span className="display-grid__panel-label">
                  {field.label} <span className="display-grid__panel-format">{DATE_FORMAT}</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={DATE_FORMAT}
                  className="display-grid__panel-control"
                  aria-invalid={invalid || undefined}
                  value={value}
                  onChange={(event) => onDateInput(field, event.target.value)}
                />
                {invalid ? (
                  <span role="alert" className="display-grid__panel-error">
                    Use {DATE_FORMAT}, for example 2025-06-01
                  </span>
                ) : null}
              </label>
            );
          }

          if (field.kind === 'select') {
            return (
              <label className="display-grid__panel-field" key={field.id}>
                <span className="display-grid__panel-label">{field.label}</span>
                <select
                  className="display-grid__panel-control"
                  value={asText(values[field.id])}
                  onChange={(event) => onChange(field.id, event.target.value || null)}
                >
                  <option value="">All</option>
                  {(field.options ?? []).map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label className="display-grid__panel-field" key={field.id}>
              <span className="display-grid__panel-label">{field.label}</span>
              <input
                type="text"
                className="display-grid__panel-control"
                placeholder={field.placeholder}
                value={asText(values[field.id])}
                onChange={(event) => onChange(field.id, event.target.value || null)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
