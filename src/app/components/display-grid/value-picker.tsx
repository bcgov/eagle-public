import { useId, useState } from 'react';
import { FilterPopover } from './filter-popover';
import { actHeading, groupByAct, hasActs, optionLabel } from './grid-helpers';
import type { ValueOption } from './types';

/** Over this many values the list is too long to scan, so a search box above it narrows it. */
const SEARCH_FROM = 40;

interface ValuePickerProps {
  /** The column's label; the button reads "Filter by <label>". */
  label: string;
  options: ValueOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** A line under the heading, read with the popover. */
  hint?: string;
}

/** The popover's checkbox list. It mounts with the popover, so each opening starts unfiltered. */
function PickerList({ label, options, selected, onChange }: Omit<ValuePickerProps, 'hint'>) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const searchable = options.length > SEARCH_FROM;

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;
  const grouped = hasActs(options);

  function toggleValue(value: string): void {
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  }

  function checkbox(option: ValueOption) {
    return (
      <label key={option.value} className="display-grid__option">
        <input
          type="checkbox"
          checked={selected.includes(option.value)}
          onChange={() => toggleValue(option.value)}
        />
        {option.label}
      </label>
    );
  }

  return (
    <>
      {searchable && (
        <input
          type="search"
          className="display-grid__control display-grid__picker-search"
          aria-label={`Search ${label.toLowerCase()}`}
          placeholder={`Search ${label.toLowerCase()}`}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <div className="display-grid__picker-list">
        {shown.length === 0 ? (
          <p className="display-grid__picker-empty">No matches</p>
        ) : grouped ? (
          groupByAct(shown).map((group) => {
            const groupId = `${listId}-act-${group.legislation}`;
            return (
              <div key={group.legislation} role="group" aria-labelledby={groupId}>
                <p className="display-grid__picker-group" id={groupId}>
                  {actHeading(group.legislation)}
                </p>
                {group.options.map(checkbox)}
              </div>
            );
          })
        ) : (
          shown.map(checkbox)
        )}
      </div>
    </>
  );
}

export function ValuePicker({ label, options, selected, onChange, hint }: ValuePickerProps) {
  const picked = options.filter((option) => selected.includes(option.value));
  const buttonText =
    picked.length === 0
      ? 'All'
      : picked.length === 1
        ? optionLabel(picked[0])
        : `${picked.length} selected`;

  return (
    <FilterPopover
      label={label}
      buttonText={buttonText}
      buttonTitle={picked.length ? picked.map(optionLabel).join(', ') : undefined}
      active={picked.length > 0}
      onClear={() => onChange([])}
      hint={hint}
      focusOnOpen={options.length > SEARCH_FROM}
    >
      <PickerList label={label} options={options} selected={selected} onChange={onChange} />
    </FilterPopover>
  );
}
