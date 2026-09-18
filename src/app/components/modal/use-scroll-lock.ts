import { useCallback, useEffect, useRef } from 'react';

/**
 * Holds the page still behind a modal, and hands back the one way to move it anyway.
 *
 * Modality has to be enforced, not only declared: a page that keeps scrolling under an
 * `aria-modal` overlay is telling assistive tech something untrue. `overflow: hidden` stops a
 * wheel or a page-down but not a programmatic scroll, so the position is pinned as well as the
 * box. Both elements are locked, because which one is the scrolling box depends on the host page.
 *
 * The returned function moves the pin, which is how a guided-tour step brings its control into
 * view while the rest of the page stays where it was put. It hands back the position it settled
 * on, so a caller can put the page back there later without keeping its own copy of the clamp.
 */
export function useScrollLock(active: boolean): (top: number) => number {
  const pinned = useRef(0);

  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const prior = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    pinned.current = window.scrollY;

    const hold = () => {
      if (window.scrollY !== pinned.current) window.scrollTo(0, pinned.current);
    };
    // Capture: a scroll inside any container bubbles nowhere, so the listener has to see it going down.
    document.addEventListener('scroll', hold, true);

    return () => {
      document.removeEventListener('scroll', hold, true);
      html.style.overflow = prior.html;
      document.body.style.overflow = prior.body;
    };
  }, [active]);

  return useCallback((top: number) => {
    pinned.current = Math.max(0, Math.round(top));
    window.scrollTo(0, pinned.current);
    return pinned.current;
  }, []);
}
