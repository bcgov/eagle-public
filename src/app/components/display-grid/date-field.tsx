import { useId } from 'react';
import { DatePicker } from 'app/components/filters/date-picker';

interface DateFieldProps {
  label: string;
  /** The applied date, yyyy-mm-dd, or empty. */
  value: string;
  /** `null` clears the bound. A part-typed date emits nothing. */
  onChange: (value: string | null) => void;
  /** A line under the control, read with it. */
  hint?: string;
  minDate?: string;
  maxDate?: string;
  /** Which family of class names lays it out: the advanced panel's or a column popover's. */
  layout: 'panel' | 'picker';
}

function asDate(iso: string | undefined): Date | null {
  return iso ? new Date(`${iso}T00:00:00Z`) : null;
}

/** One date bound, typed or picked from the calendar, under its own label. */
export function DateField({
  label,
  value,
  onChange,
  hint,
  minDate,
  maxDate,
  layout,
}: DateFieldProps) {
  const inputId = useId();
  const hintId = hint ? `${inputId}-hint` : undefined;
  const prefix = `display-grid__${layout}`;

  return (
    <div className={`${prefix}-field`}>
      <label htmlFor={inputId} className={`${prefix}-label`}>
        {label}
      </label>
      <DatePicker
        id={inputId}
        label={label}
        value={value}
        minDate={asDate(minDate)}
        maxDate={asDate(maxDate)}
        onChange={(next) => onChange(next || null)}
        aria-describedby={hintId}
      />
      {hint && (
        <span id={hintId} className={`${prefix}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}
