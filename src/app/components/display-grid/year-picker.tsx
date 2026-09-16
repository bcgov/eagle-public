import { gridCollator } from './grid-helpers';

interface YearPickerProps {
  /** The column's label; the control reads "Filter by <label>". */
  label: string;
  /** Distinct years, in any order. Newest first is applied here so callers need not sort. */
  years: string[];
  value: string;
  onChange: (year: string) => void;
}

/** A date column filters by year: the whole range in one control, no calendar to open. */
export function YearPicker({ label, years, value, onChange }: YearPickerProps) {
  const newestFirst = [...new Set(years)].sort((a, b) => gridCollator.compare(b, a));

  return (
    <label>
      <span className="display-grid__visually-hidden">{`Filter by ${label}`}</span>
      <select
        className={`display-grid__control${value ? ' display-grid__control--on' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Any date</option>
        {newestFirst.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
