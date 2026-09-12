import { useEffect, useRef, useState } from 'react';
import {
  CustomMultiSelect,
  type CustomMultiSelectOption,
} from 'app/components/filters/custom-multi-select';
import type { ValueOption } from './types';

/** Over this many values a checkbox list stops being readable and the typeahead takes over. */
const TYPEAHEAD_FROM = 40;

/** A list shorter than this below the button is not usable, so the popover flips above instead. */
const MIN_BELOW = 220;

const MAX_HEIGHT = 320;
const MIN_HEIGHT = 140;
const WIDTH = 232;

/** Where the popover sits, measured off the button when it opens. */
interface Anchor {
  left: number;
  below: number;
  above: number;
}

interface ValuePickerProps {
  /** The column's label; the button reads "Filter by <label>". */
  label: string;
  options: ValueOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function ValuePicker({ label, options, selected, onChange }: ValuePickerProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  const picked = options.filter((option) => selected.includes(option.value));
  const buttonText =
    picked.length === 0
      ? 'All'
      : picked.length === 1
        ? picked[0].label
        : `${picked.length} selected`;
  const fullList = picked.length ? picked.map((option) => option.label).join(', ') : undefined;

  useEffect(() => {
    if (!open) return;

    function close(restoreFocus: boolean): void {
      setAnchor(null);
      if (restoreFocus) buttonRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') close(true);
    }

    /* The button moves with any scroll and a fixed popover does not follow it, so an outer
       scroll closes it. The popover's own option list scrolls too, and that must not. */
    function onScroll(event: Event): void {
      const target = event.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      close(false);
    }

    const onResize = () => close(false);

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  function toggleOpen(): void {
    if (open) {
      setAnchor(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ left: rect.left, below: rect.bottom + 2, above: rect.top - 2 });
  }

  function toggleValue(value: string): void {
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  }

  let popover = null;
  if (anchor) {
    const roomBelow = window.innerHeight - anchor.below - 16;
    const roomAbove = anchor.above - 16;
    // Opening past the bottom of the viewport is the same clipping in a new place.
    const flip = roomBelow < MIN_BELOW && roomAbove > roomBelow;
    const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, flip ? roomAbove : roomBelow));

    popover = (
      <div
        ref={popoverRef}
        className="display-grid__picker"
        role="group"
        aria-label={`Filter by ${label}`}
        style={{
          left: Math.round(anchor.left),
          ...(flip
            ? { bottom: Math.round(window.innerHeight - anchor.above) }
            : { top: Math.round(anchor.below) }),
          width: WIDTH,
          maxHeight: Math.round(height),
        }}
      >
        {options.length > TYPEAHEAD_FROM ? (
          <CustomMultiSelect
            items={options}
            selected={picked}
            bindLabel="label"
            placeholder={`Search ${label.toLowerCase()}`}
            onChange={(next: CustomMultiSelectOption[]) =>
              onChange(next.map((option) => String(option['value'])))
            }
          />
        ) : (
          options.map((option) => (
            <label key={option.value} className="display-grid__option">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleValue(option.value)}
              />
              {option.label}
            </label>
          ))
        )}
        {picked.length > 0 && (
          <div className="display-grid__picker-foot">
            <button
              type="button"
              className="display-grid__picker-clear"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`display-grid__control display-grid__pick${
          picked.length ? ' display-grid__control--on' : ''
        }`}
        aria-label={`Filter by ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={fullList}
        onClick={toggleOpen}
      >
        <span className="display-grid__pick-label">{buttonText}</span>
        <span className="display-grid__pick-caret" aria-hidden="true">
          ▼
        </span>
      </button>
      {popover}
    </>
  );
}
