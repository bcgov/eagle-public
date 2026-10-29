import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

// Verbatim `Breakpoints.Tablet` and `Breakpoints.Web` from the Angular CDK, orientation clauses
// included: without them a 1024px-wide landscape window reads as web here and as tablet there.
const TABLET =
  '(min-width: 600px) and (max-width: 839.98px) and (orientation: portrait), ' +
  '(min-width: 960px) and (max-width: 1279.98px) and (orientation: landscape)';
const WEB =
  '(min-width: 840px) and (orientation: portrait), (min-width: 1280px) and (orientation: landscape)';
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Live answer to one media query. SSR reads false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** One-off read of the reduced-motion setting, for code that starts an animation. */
export function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.(REDUCED_MOTION).matches;
}

/**
 * The media query's answer once it has held for a frame. A full-page capture resizes the viewport
 * to 1px for one frame; a layout gated on the live answer would unmount and remount in it.
 */
export function useSettledMediaQuery(query: string): boolean {
  const live = useMediaQuery(query);
  const [settled, setSettled] = useState(live);
  useEffect(() => {
    if (live === settled) return;
    const frame = requestAnimationFrame(() => setSettled(live));
    return () => cancelAnimationFrame(frame);
  }, [live, settled]);
  return settled;
}

export function useResponsive(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const isTablet = useMediaQuery(TABLET);
  const isDesktop = useMediaQuery(WEB);
  return { isMobile: !isTablet && !isDesktop, isTablet, isDesktop };
}
