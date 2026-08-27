import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver; the project tab bar and the mini map watch their containers with it.
if (!globalThis.ResizeObserver) {
  const noop = () => undefined;
  globalThis.ResizeObserver = class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  };
}

// jsdom has no matchMedia; the responsive hooks call it on every render.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    }) as MediaQueryList;
}
