import { useEffect, useRef, useState } from 'react';
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
 * reader users land on the new tab: its `<h2 tabIndex={-1}>`, or its container when it has no
 * title. With `enabled` false the caller is not the tab's focus target and nothing happens.
 *
 * After focusing, the flag is cleared from the history entry, so a reload or back/forward to it
 * does not move focus again.
 */
export function useFocusTabTitle<T extends HTMLElement = HTMLHeadingElement>(enabled = true) {
  const ref = useRef<T>(null);
  const opened = useOpenedByLink();
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled || !opened) return;
    ref.current?.focus();
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
