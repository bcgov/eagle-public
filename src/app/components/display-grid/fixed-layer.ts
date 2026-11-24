import type { CSSProperties } from 'react';

/** Space kept between a layer and the viewport's side edges. */
const EDGE = 16;

/** Marks a layer a popover opens from inside itself, such as a calendar, as still inside it. */
export const POPOVER_CHILD_ATTR = 'data-filter-popover-child';

/** Where a layer sits, measured off the control it opens from. */
export interface Anchor {
  left: number;
  below: number;
  above: number;
  /** The viewport the control was read against. Held with the rest of the measurement so a render
      that happens after the viewport changed cannot flip the layer away from its control. */
  viewHeight: number;
}

/** Measures a control for a layer `width` wide, pulled in from the viewport's side edges. */
export function anchorOf(control: Element, width: number): Anchor {
  const rect = control.getBoundingClientRect();
  return {
    left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE)),
    below: rect.bottom + 2,
    above: rect.top - 2,
    viewHeight: window.innerHeight,
  };
}

/**
 * The fixed position for a layer: below the control, or above it when the room below is under
 * `minBelow` and there is more above. Opening past the bottom of the viewport is the same clipping.
 */
export function placeAt(
  anchor: Anchor,
  width: number,
  { minBelow, maxHeight, minHeight }: { minBelow: number; maxHeight: number; minHeight: number },
): CSSProperties {
  const roomBelow = anchor.viewHeight - anchor.below - EDGE;
  const roomAbove = anchor.above - EDGE;
  const flip = roomBelow < minBelow && roomAbove > roomBelow;
  const height = Math.min(maxHeight, Math.max(minHeight, flip ? roomAbove : roomBelow));
  return {
    left: Math.round(anchor.left),
    ...(flip
      ? { bottom: Math.round(anchor.viewHeight - anchor.above) }
      : { top: Math.round(anchor.below) }),
    width,
    maxHeight: Math.round(height),
  };
}

/**
 * Closes a fixed layer on a pointer down outside it, and on any scroll or resize outside it: the
 * control it opened from moves with the page and the layer does not. Returns the cleanup.
 */
export function closeOnOutside(isInside: (target: Node) => boolean, close: () => void): () => void {
  function onOutside(event: Event): void {
    if (event.target instanceof Node && isInside(event.target)) return;
    close();
  }
  document.addEventListener('pointerdown', onOutside);
  window.addEventListener('scroll', onOutside, true);
  window.addEventListener('resize', close);
  return () => {
    document.removeEventListener('pointerdown', onOutside);
    window.removeEventListener('scroll', onOutside, true);
    window.removeEventListener('resize', close);
  };
}
