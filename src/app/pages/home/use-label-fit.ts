import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** How long a level change takes to settle; labels are measured once the tiles stop moving. */
export const LEVEL_SETTLE_MS = 760;

export interface LabelFit {
  /** Width of the map in px; 0 until the first resize callback. */
  mapWidth: number;
  /** `data-fit` keys of the labels that spill out of their box. */
  overflowing: Set<string>;
}

const spills = (el: HTMLElement): boolean =>
  el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;

/**
 * Measures every `[data-fit]` label under the map. The first width measures before paint; a later
 * resize or a level change moves the tiles, so it waits for them to settle (no wait when motion is
 * reduced).
 */
export function useLabelFit(
  mapRef: RefObject<HTMLElement | null>,
  levelKey: string,
  reduced: boolean,
): LabelFit {
  const [mapWidth, setMapWidth] = useState(0);
  const [overflowing, setOverflowing] = useState<Set<string>>(() => new Set());
  const signature = useRef('[]');
  // Width at the last resize; 0 means the next one is the first real box.
  const lastWidth = useRef(0);
  // Separate timers so a resize does not cancel the measure a level change is waiting on.
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const levelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const measure = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const keys = [...map.querySelectorAll<HTMLElement>('[data-fit]')]
      .filter(spills)
      .map((el) => el.dataset['fit'] ?? '')
      .sort();
    const next = JSON.stringify(keys);
    if (next === signature.current) return;
    signature.current = next;
    setOverflowing(new Set(keys));
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? map.clientWidth;
      const first = lastWidth.current === 0;
      lastWidth.current = width;
      setMapWidth(width);
      if (first) return;
      clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(measure, reduced ? 0 : LEVEL_SETTLE_MS);
    });
    observer.observe(map);
    return () => observer.disconnect();
  }, [mapRef, measure, reduced]);

  // The first real box: the tiles are laid out at this width in the same commit, so measure
  // before paint.
  const measuredWidth = useRef(0);
  useLayoutEffect(() => {
    if (mapWidth > 0 && measuredWidth.current === 0) measure();
    measuredWidth.current = mapWidth;
  }, [mapWidth, measure]);

  useEffect(() => {
    clearTimeout(levelTimer.current);
    levelTimer.current = setTimeout(measure, reduced ? 0 : LEVEL_SETTLE_MS);
  }, [levelKey, reduced, measure]);

  useEffect(
    () => () => {
      clearTimeout(resizeTimer.current);
      clearTimeout(levelTimer.current);
    },
    [],
  );

  return { mapWidth, overflowing };
}
