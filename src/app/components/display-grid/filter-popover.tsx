import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { anchorOf, closeOnOutside, placeAt, POPOVER_CHILD_ATTR, type Anchor } from './fixed-layer';

/** A list shorter than this below the button is not usable, so the popover flips above instead. */
const MIN_BELOW = 220;

const MAX_HEIGHT = 400;
const MIN_HEIGHT = 140;
const WIDTH = 232;

interface FilterPopoverProps {
  /** The column's label; the button reads "Filter by <label>". */
  label: string;
  /** What the button shows: "All", or what is in force. */
  buttonText: string;
  /** The button's tooltip, for a value too long to show. */
  buttonTitle?: string;
  /** Something is filtered, so the button is drawn as on and the popover offers Clear. */
  active: boolean;
  onClear: () => void;
  /** A line under the heading, read with the popover. */
  hint?: string;
  /** Opening puts focus in the popover's first input, so typing starts at once. */
  focusOnOpen?: boolean;
  /** The popover's body. Mounted only while it is open, so its own state starts fresh each time. */
  children: ReactNode;
}

/**
 * A column filter button and the popover it opens. The popover is portaled to the body, so neither
 * the grid's scroll box nor its sticky filter cells can clip or bury it.
 */
export function FilterPopover({
  label,
  buttonText,
  buttonTitle,
  active,
  onClear,
  hint,
  focusOnOpen = false,
  children,
}: FilterPopoverProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const popoverId = useId();
  const headingId = `${popoverId}-head`;
  const hintId = hint ? `${popoverId}-hint` : undefined;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;

    const stopOutside = closeOnOutside(
      (target) =>
        Boolean(
          popoverRef.current?.contains(target) ||
          buttonRef.current?.contains(target) ||
          (target instanceof Element && target.closest(`[${POPOVER_CHILD_ATTR}]`)),
        ),
      () => setAnchor(null),
    );

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setAnchor(null);
      buttonRef.current?.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    if (focusOnOpen) popoverRef.current?.querySelector('input')?.focus();
    return () => {
      stopOutside();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, focusOnOpen]);

  function toggleOpen(): void {
    if (open) {
      setAnchor(null);
      return;
    }
    if (buttonRef.current) setAnchor(anchorOf(buttonRef.current, WIDTH));
  }

  function tabbables(): HTMLElement[] {
    return [...(popoverRef.current?.querySelectorAll<HTMLElement>('button, input') ?? [])];
  }

  /* The popover lives at the end of the page, so Tab would skip it: the button hands focus in,
     and Tab off either end of the popover hands it back. */
  function onButtonKeyDown(event: ReactKeyboardEvent): void {
    if (!open || event.key !== 'Tab' || event.shiftKey) return;
    const first = tabbables()[0];
    if (!first) return;
    event.preventDefault();
    first.focus();
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const items = tabbables();
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (document.activeElement !== edge) return;
    event.preventDefault();
    if (!event.shiftKey) setAnchor(null);
    buttonRef.current?.focus();
  }

  let popover = null;
  if (anchor) {
    popover = createPortal(
      // The wrapper carries the grid's z-index scale out to the body; it draws no box of its own.
      <div className="display-grid__overlay">
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the keydown only catches Tab off the group's ends, to hand focus back to the button */}
        <div
          ref={popoverRef}
          id={popoverId}
          className="display-grid__picker"
          role="group"
          aria-labelledby={headingId}
          aria-describedby={hintId}
          onKeyDown={onPopoverKeyDown}
          style={placeAt(anchor, WIDTH, {
            minBelow: MIN_BELOW,
            maxHeight: MAX_HEIGHT,
            minHeight: MIN_HEIGHT,
          })}
        >
          <div className="display-grid__picker-head">
            {/* The button that opened this reads "All" or a value, so nothing on screen says which
                column is being filtered until this line does. It is the panel's name too. */}
            <p className="display-grid__picker-title" id={headingId}>{`Filter by ${label}`}</p>
            {active && (
              <button
                type="button"
                className="display-grid__picker-clear"
                aria-label={`Clear ${label}`}
                onClick={onClear}
              >
                Clear
              </button>
            )}
          </div>
          {hint && (
            <p className="display-grid__picker-hint" id={hintId}>
              {hint}
            </p>
          )}
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`display-grid__control display-grid__pick${active ? ' display-grid__control--on' : ''}`}
        aria-label={`Filter by ${label}`}
        /* The popover is a group of controls, not a listbox: a mismatched role sends a screen
           reader looking for options that are not there. */
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        title={buttonTitle}
        onClick={toggleOpen}
        onKeyDown={onButtonKeyDown}
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
