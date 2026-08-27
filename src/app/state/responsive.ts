import { useCallback, useSyncExternalStore } from 'react';

// The breakpoints the Angular CDK used, so the layout switches at the same widths.
const TABLET = '(min-width: 600px) and (max-width: 839.98px), (min-width: 960px) and (max-width: 1279.98px)';
const WEB = '(min-width: 840px)';

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export function useResponsive(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const isTablet = useMediaQuery(TABLET);
  const isDesktop = useMediaQuery(WEB);
  return { isMobile: !isTablet && !isDesktop, isTablet, isDesktop };
}
