import { useEffect, useRef, useState } from 'react';
import { TYPEAHEAD_DEBOUNCE_MS } from 'app/components/filters/typeahead';

/**
 * A typed filter box beats with the keyword box above it: same pause, so a reader who types in
 * both does not get two searches at two different moments.
 */
export const FILTER_DEBOUNCE_MS = TYPEAHEAD_DEBOUNCE_MS;

/** Longest text a filter box sends. Past a couple of hundred characters it is not a name. */
export const FILTER_TEXT_MAX = 200;

/**
 * A text box that holds what is being typed and applies it once typing stops.
 *
 * Returns the draft and its setter. The applied value is what the parent last agreed on: the
 * draft is pushed only when it has moved away from that, and a value the parent changes from
 * outside — a chip dropped, Clear all, the back button — wins over whatever is in the box.
 */
export function useDebouncedDraft(
  value: string,
  onChange: (next: string) => void,
): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const applied = useRef(value);
  const emit = useRef(onChange);

  useEffect(() => {
    emit.current = onChange;
  });

  useEffect(() => {
    if (value === applied.current) return;
    applied.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = draft;
      emit.current(draft);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  return [draft, setDraft];
}
