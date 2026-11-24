import { DateField } from './date-field';
import { FilterPopover } from './filter-popover';

interface DateRangePickerProps {
  /** The column's label; the button reads "Filter by <label>". */
  label: string;
  /** yyyy-mm-dd or empty, the `<id>Start` and `<id>End` the advanced panel writes too. */
  start: string;
  end: string;
  onStartChange: (value: string | null) => void;
  onEndChange: (value: string | null) => void;
}

/** What the button shows. A whole calendar year, as an old year link becomes, reads as the year. */
function rangeText(start: string, end: string): string {
  const year = start.slice(0, 4);
  if (start === `${year}-01-01` && end === `${year}-12-31`) return year;
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `To ${end}`;
  return 'Any date';
}

/** A date column's filter: a From and a To date, each picked from a calendar or typed. */
export function DateRangePicker({
  label,
  start,
  end,
  onStartChange,
  onEndChange,
}: DateRangePickerProps) {
  const text = rangeText(start, end);

  return (
    <FilterPopover
      label={label}
      buttonText={text}
      buttonTitle={start || end ? text : undefined}
      active={Boolean(start || end)}
      onClear={() => {
        onStartChange(null);
        onEndChange(null);
      }}
      focusOnOpen
    >
      <div className="display-grid__picker-dates">
        <DateField
          layout="picker"
          label="From"
          value={start}
          maxDate={end || undefined}
          onChange={onStartChange}
        />
        <DateField
          layout="picker"
          label="To"
          value={end}
          minDate={start || undefined}
          onChange={onEndChange}
        />
      </div>
    </FilterPopover>
  );
}
