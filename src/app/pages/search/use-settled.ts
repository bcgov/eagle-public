import { useEffect, useState } from 'react';

/** Holds `value` back until it has stopped changing for `delay`. The first value passes straight. */
export function useSettled(value: string, delay: number): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, settled, delay]);

  return settled;
}
