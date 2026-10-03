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
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom ships the `<dialog>` element without its behaviour: no `showModal`, no Escape, no close
// event. The focus trap and the top layer are the browser's own and cannot be stood in for here,
// so the e2e keyboard walk is what proves those; this covers the wiring around them.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, value?: string) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    if (value !== undefined) this.returnValue = value;
    this.dispatchEvent(new Event('close'));
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
    const top = dialogs[dialogs.length - 1];
    if (top && top.dispatchEvent(new Event('cancel', { cancelable: true }))) top.close();
  });
}
