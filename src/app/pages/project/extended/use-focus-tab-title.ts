import { createContext, useCallback, useEffect, useRef, useState, type RefCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * True when an in-page link that passed `state={{ focusTab: true }}` opened this tab. Read once on
 * mount, so it holds after the flag is cleared from history.
 */
export function useOpenedByLink(): boolean {
  const { state } = useLocation();
  const [opened] = useState(() => (state as { focusTab?: boolean } | null)?.focusTab === true);
  return opened;
}

/**
 * Returns a ref for what takes focus when an in-page link opened the tab, so keyboard and screen
 * reader users land on the new tab. Call it once per tab: the tab decides which element gets the
 * ref.
 *
 * After focusing, the flag is cleared from the history entry, so a reload or back/forward to it
 * does not move focus again.
 */
export function useFocusTabTitle(): RefCallback<HTMLElement> {
  const target = useRef<HTMLElement | null>(null);
  const ref = useCallback((element: HTMLElement | null) => {
    target.current = element;
  }, []);
  const opened = useOpenedByLink();
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!opened) return;
    target.current?.focus();
    const rest = Object.entries((state as Record<string, unknown> | null) ?? {}).filter(
      ([key]) => key !== 'focusTab',
    );
    navigate(
      { pathname, search, hash },
      {
        replace: true,
        preventScrollReset: true,
        state: rest.length ? Object.fromEntries(rest) : null,
      },
    );
    // Mount only: a later re-render must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}

/**
 * The block in a content tab's main column whose heading takes the tab's focus, with the ref to put
 * on it. Unset everywhere else, so a block in an aside, a banner or an Overview append never does.
 */
export const TabFocusTarget = createContext<{
  blockId: string;
  ref: RefCallback<HTMLElement>;
} | null>(null);
