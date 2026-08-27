interface DatePickerProps {
  id: string;
  /** yyyy-mm-dd, the format both `<input type="date">` and the filter code use. */
  value: string;
  minDate?: Date | null;
  maxDate?: Date | null;
  isDisabled?: boolean;
  onChange: (value: string) => void;
}

function toInputDate(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString().split('T')[0] : undefined;
}

export function DatePicker({ id, value, minDate, maxDate, isDisabled = false, onChange }: DatePickerProps) {
  return (
    <div className="date-picker-container">
      <div className="date-input-wrapper">
        <input
          id={id}
          className="date-input"
          type="date"
          value={value ?? ''}
          min={toInputDate(minDate)}
          max={toInputDate(maxDate)}
          disabled={isDisabled}
          onChange={event => onChange(event.target.value)}
          aria-label="Date input field"
        />

        {value && !isDisabled && (
          <button
            className="icon-btn"
            onClick={() => onChange('')}
            type="button"
            title="Clear Date"
            aria-label="Clear date button"
          >
            <span className="material-icons">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
