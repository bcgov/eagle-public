import { vi } from 'vitest';
import { act } from '@testing-library/react';

/** Stubs IntersectionObserver; `enter` reports the observed element near the viewport. */
export function stubIntersection() {
  let callback: IntersectionObserverCallback = () => undefined;
  const observed: { options?: IntersectionObserverInit } = {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        callback = cb;
        observed.options = options;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const enter = () =>
    act(() =>
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
    );
  return { enter, observed, disconnect };
}
