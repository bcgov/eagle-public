import { useId, useState } from 'react';
import { DateField } from './date-field';
import { actHeading, groupByAct, hasActs, optionLabel } from './grid-helpers';
import { FILTER_TEXT_MAX, useDebouncedDraft } from './use-debounced-draft';
import type { AdvancedField, FilterValues, ValueOption } from './types';
import './advanced-filters.css';

/** The panel's element id, so the toolbar button can name it in `aria-controls`. */
export const ADVANCED_FILTERS_ID = 'display-grid-advanced-filters';

export interface AdvancedFiltersProps {
  fields: AdvancedField[];
  values: FilterValues;
  /** `null` clears the filter. A part-typed date emits nothing at all. */
  onChange: (id: string, value: string | null) => void;
  open: boolean;
}

function selectOption(option: ValueOption) {
  return (
    <option value={option.value} key={option.value}>
      {optionLabel(option)}
    </option>
  );
}

function asText(value: FilterValues[string] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? value.join(',') : value;
}

/**
 * A typed field, which the panel carries only where the layout has no filter row for it: a phone,
 * a list, an empty result. It applies once typing stops, on the same beat as the filter row's own
 * box, so the narrow layout does not search once per keystroke.
 */
function PanelText({
  field,
  value,
  onChange,
}: {
  field: AdvancedField;
  value: string;
  onChange: (id: string, value: string | null) => void;
}) {
  const [draft, setDraft] = useDebouncedDraft(value, (next) => onChange(field.id, next || null));

  return (
    <label className="display-grid__panel-field">
      <span className="display-grid__panel-label">{field.label}</span>
      <input
        type="text"
        autoComplete="off"
        maxLength={FILTER_TEXT_MAX}
        className="display-grid__panel-control"
        placeholder={field.placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
}

/**
 * The filterable parts of a record that no column shows: date ranges, legislation, flags.
 * Collapsed by default and `hidden` rather than unmounted, so the toolbar's `aria-controls`
 * always points at an element that exists.
 */
export function AdvancedFilters({ fields, values, onChange, open }: AdvancedFiltersProps) {
  const headingId = useId();
  /* A part-typed date holds no value, so Clear all cannot reach it through `values`. Emptying the
     whole set remounts the date fields instead, or one would keep its error with no filter left. */
  const count = Object.keys(values).length;
  const [lastCount, setLastCount] = useState(count);
  const [generation, setGeneration] = useState(0);
  if (count !== lastCount) {
    setLastCount(count);
    if (count === 0) setGeneration((current) => current + 1);
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
          const hintId = field.hint ? `${headingId}-${field.id}-hint` : undefined;
          // The hint sits inside the label, so the name points at the label text alone.
          const labelId = field.hint ? `${headingId}-${field.id}-label` : undefined;
          const hint = field.hint ? (
            <span id={hintId} className="display-grid__panel-hint">
              {field.hint}
            </span>
          ) : null;

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
              <DateField
                key={`${field.id}-${generation}`}
                layout="panel"
                label={field.label}
                hint={field.hint}
                value={asText(values[field.id])}
                onChange={(next) => onChange(field.id, next)}
              />
            );
          }

          if (field.kind === 'select') {
            const options = field.options ?? [];
            return (
              <label className="display-grid__panel-field" key={field.id}>
                <span className="display-grid__panel-label" id={labelId}>
                  {field.label}
                </span>
                <select
                  className="display-grid__panel-control"
                  aria-labelledby={labelId}
                  aria-describedby={hintId}
                  value={asText(values[field.id])}
                  onChange={(event) => onChange(field.id, event.target.value || null)}
                >
                  <option value="">All</option>
                  {hasActs(options)
                    ? groupByAct(options).map((group) => (
                        <optgroup label={actHeading(group.legislation)} key={group.legislation}>
                          {group.options.map(selectOption)}
                        </optgroup>
                      ))
                    : options.map(selectOption)}
                </select>
                {hint}
              </label>
            );
          }

          return (
            <PanelText
              key={field.id}
              field={field}
              value={asText(values[field.id])}
              onChange={onChange}
            />
          );
        })}
      </div>
    </div>
  );
}
