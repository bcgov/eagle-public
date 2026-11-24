import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  anchorOf,
  closeOnOutside,
  placeAt,
  POPOVER_CHILD_ATTR,
  type Anchor,
} from 'app/components/display-grid/fixed-layer';
import './date-picker.css';

const DATE_FORMAT = 'YYYY-MM-DD';

/** Wide enough for seven 36px days and the month and year selects. */
const CALENDAR_WIDTH = 284;
const CALENDAR_HEIGHT = 340;

interface DatePickerProps {
  /** Ties the input to its visible `<label htmlFor>`, which is its name. */
  id: string;
  /** The field's visible label; the buttons read "Choose <label>" and "Clear <label>". */
  label: string;
  /** yyyy-mm-dd, or empty. */
  value: string;
  minDate?: Date | null;
  maxDate?: Date | null;
  /** A complete date or an empty field; anything part-typed or wrong is held back. */
  onChange: (value: string) => void;
  'aria-describedby'?: string;
}

/**
 * Typed text as yyyy-mm-dd, with or without the dashes. `null` unless it is a real calendar day:
 * the round trip through `Date` refuses a 31st of February, which the pattern alone accepts.
 */
function parseIsoDate(text: string): string | null {
  const typed = text.trim();
  const iso = /^\d{8}$/.test(typed)
    ? `${typed.slice(0, 4)}-${typed.slice(4, 6)}-${typed.slice(6)}`
    : typed;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const at = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === iso ? iso : null;
}

/** The calendar works in local days; the field holds the day's digits, with no time zone. */
function toLocalDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function fromLocalDay(day: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** A bound as the day its UTC date names, which is how the filter code reads it. */
function boundDay(date: Date | null | undefined): Date | undefined {
  return date ? toLocalDay(date.toISOString().slice(0, 10)) : undefined;
}

/**
 * A date field that takes typing and a calendar at once. A click opens the calendar and leaves the
 * caret in the field; the calendar button opens it with focus on the days, for the keyboard.
 */
export function DatePicker({
  id,
  label,
  value,
  minDate,
  maxDate,
  onChange,
  'aria-describedby': describedBy,
}: DatePickerProps) {
  const formatId = useId();
  const errorId = `${formatId}-error`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value);
  const [touched, setTouched] = useState(false);
  const [calendar, setCalendar] = useState<{ anchor: Anchor; focusDays: boolean } | null>(null);
  const [month, setMonth] = useState(() => toLocalDay(value || fromLocalDay(new Date())));

  // A value changed from outside - a chip dropped, Clear all, a typed date normalised - wins.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
    setTouched(false);
    if (value) setMonth(toLocalDay(value));
  }

  const parsed = parseIsoDate(text);
  // Mid-typing is not an error yet: it shows once the field is left or all eight digits are in.
  const wrong = text.trim() !== '' && !parsed && (touched || text.replace(/\D/g, '').length >= 8);
  const open = calendar !== null;

  useEffect(() => {
    if (!open) return;
    return closeOnOutside(
      (target) =>
        Boolean(calendarRef.current?.contains(target) || fieldRef.current?.contains(target)),
      () => setCalendar(null),
    );
  }, [open]);

  function openCalendar(focusDays: boolean): void {
    if (!fieldRef.current) return;
    if (parsed) setMonth(toLocalDay(parsed));
    setCalendar({ anchor: anchorOf(fieldRef.current, CALENDAR_WIDTH), focusDays });
  }

  function closeCalendar(focus?: 'input'): void {
    setCalendar(null);
    if (focus === 'input') inputRef.current?.focus();
  }

  function onType(next: string): void {
    setText(next);
    const iso = parseIsoDate(next);
    if (next.trim() === '') onChange('');
    else if (iso) {
      onChange(iso);
      setMonth(toLocalDay(iso));
    }
  }

  /* Escape takes down the calendar alone, so a popover the field sits in stays open; a Tab out of
     the calendar goes back to the field rather than off the end of the page. */
  function onCalendarKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeCalendar('input');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      closeCalendar('input');
    }
  }

  const described = [formatId, wrong && errorId, describedBy].filter(Boolean).join(' ');

  return (
    <div className="date-picker-container">
      {/* The placeholder shows the format but leaves once typing starts, so it is described too. */}
      <span id={formatId} className="visually-hidden">
        {DATE_FORMAT}
      </span>
      <div className="date-input-wrapper" ref={fieldRef}>
        <input
          ref={inputRef}
          id={id}
          className="date-input"
          type="text"
          autoComplete="off"
          placeholder={DATE_FORMAT}
          value={text}
          aria-describedby={described}
          aria-invalid={wrong || undefined}
          onChange={(event) => onType(event.target.value)}
          onClick={(event) => {
            if (event.detail > 0 && !open) openCalendar(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.stopPropagation();
              closeCalendar();
            }
          }}
          onBlur={(event) => {
            setTouched(true);
            const next = event.relatedTarget as Node | null;
            if (next && (calendarRef.current?.contains(next) || fieldRef.current?.contains(next)))
              return;
            if (open) closeCalendar();
          }}
        />
        {text && (
          <button
            className="icon-btn"
            onClick={() => {
              closeCalendar();
              onType('');
              inputRef.current?.focus();
            }}
            type="button"
            title={`Clear ${label}`}
            aria-label={`Clear ${label}`}
          >
            <span className="material-icons" aria-hidden="true">
              close
            </span>
          </button>
        )}
        <button
          className="icon-btn"
          type="button"
          title={`Choose ${label}`}
          aria-label={`Choose ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          // Opened by a click on the field, the calendar takes focus from here rather than closing.
          onClick={() => (calendar?.focusDays ? closeCalendar() : openCalendar(true))}
        >
          <span className="material-icons" aria-hidden="true">
            event
          </span>
        </button>
      </div>
      {wrong && (
        <span id={errorId} role="alert" className="date-picker-error">
          Use {DATE_FORMAT}, for example 2025-06-01
        </span>
      )}
      {calendar &&
        createPortal(
          <div className="display-grid__overlay">
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape and Tab close the calendar and hand focus back to the field */}
            <div
              ref={calendarRef}
              className="date-picker-calendar"
              role="dialog"
              aria-label={`Choose ${label}`}
              {...{ [POPOVER_CHILD_ATTR]: '' }}
              style={placeAt(calendar.anchor, CALENDAR_WIDTH, {
                minBelow: CALENDAR_HEIGHT,
                maxHeight: CALENDAR_HEIGHT,
                minHeight: CALENDAR_HEIGHT,
              })}
              onKeyDown={onCalendarKeyDown}
            >
              <DayPicker
                key={String(calendar.focusDays)}
                mode="single"
                required
                captionLayout="dropdown"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- only when the calendar button opened it, so focus lands on the days just shown
                autoFocus={calendar.focusDays}
                selected={parsed ? toLocalDay(parsed) : undefined}
                month={month}
                onMonthChange={setMonth}
                disabled={[
                  ...(minDate ? [{ before: boundDay(minDate) as Date }] : []),
                  ...(maxDate ? [{ after: boundDay(maxDate) as Date }] : []),
                ]}
                onSelect={(day) => {
                  const iso = fromLocalDay(day);
                  setText(iso);
                  onChange(iso);
                  closeCalendar('input');
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
