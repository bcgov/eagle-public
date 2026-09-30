import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { LEVEL_SETTLE_MS, useLabelFit } from './use-label-fit';

interface Size {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

const FITS: Size = { scrollWidth: 80, clientWidth: 80, scrollHeight: 20, clientHeight: 20 };

/** jsdom lays nothing out, so each label reports the sizes the spec gives it. */
function sizeLabel(el: HTMLElement, size: Size) {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

function makeMap(labels: Record<string, Size>) {
  const map = document.createElement('div');
  for (const [key, size] of Object.entries(labels)) {
    const label = document.createElement('span');
    label.dataset['fit'] = key;
    sizeLabel(label, size);
    map.append(label);
  }
  return map;
}

const label = (map: HTMLElement, key: string) =>
  map.querySelector<HTMLElement>(`[data-fit="${key}"]`)!;

/** The resize callback the hook registers, so a spec can fire it. */
let fireResize: (width: number) => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        fireResize = (width) =>
          callback(
            [{ contentRect: { width } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderFit(map: HTMLElement, reduced = false) {
  return renderHook(
    ({ levelKey }: { levelKey: string }) => useLabelFit({ current: map }, levelKey, reduced),
    { initialProps: { levelKey: 'top' } },
  );
}

describe('useLabelFit', () => {
  it('takes the map width from the first resize and marks labels that spill past 1px, with no wait', () => {
    const map = makeMap({
      'f:Mines': FITS,
      'f:Wide': { ...FITS, scrollWidth: 82 },
      'f:Tall': { ...FITS, scrollHeight: 22 },
      // Sub-pixel rounding: one pixel over still fits.
      'f:Rounded': { ...FITS, scrollWidth: 81, scrollHeight: 21 },
    });
    const { result } = renderFit(map);

    act(() => fireResize(640));
    expect(result.current.mapWidth).toBe(640);
    expect([...result.current.overflowing]).toEqual(['f:Tall', 'f:Wide']);
  });

  it('waits for the zoom to settle before measuring a new level', () => {
    const map = makeMap({ 'f:Mines': FITS });
    const { result, rerender } = renderFit(map);
    act(() => vi.advanceTimersByTime(LEVEL_SETTLE_MS));

    sizeLabel(label(map, 'f:Mines'), { ...FITS, scrollWidth: 200 });
    rerender({ levelKey: 'Mines' });

    act(() => vi.advanceTimersByTime(LEVEL_SETTLE_MS - 1));
    expect(result.current.overflowing.has('f:Mines')).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.overflowing.has('f:Mines')).toBe(true);
  });

  it('measures a new level at once when motion is reduced', () => {
    const map = makeMap({ 'f:Mines': FITS });
    const { result, rerender } = renderFit(map, true);
    act(() => vi.advanceTimersByTime(0));

    sizeLabel(label(map, 'f:Mines'), { ...FITS, scrollWidth: 200 });
    rerender({ levelKey: 'Mines' });

    act(() => vi.advanceTimersByTime(0));
    expect(result.current.overflowing.has('f:Mines')).toBe(true);
  });

  it('keeps the same set when a measure finds the same labels spilling', () => {
    const map = makeMap({ 'f:Wide': { ...FITS, scrollWidth: 200 } });
    const { result } = renderFit(map);
    act(() => {
      fireResize(640);
      vi.advanceTimersByTime(0);
    });
    const first = result.current.overflowing;
    expect(first.has('f:Wide')).toBe(true);

    act(() => {
      fireResize(700);
      vi.advanceTimersByTime(LEVEL_SETTLE_MS);
    });
    expect(result.current.overflowing).toBe(first);
  });

  it('waits for the tiles to settle after a later resize, since the layout follows the width', () => {
    const map = makeMap({ 'f:Mines': FITS });
    const { result } = renderFit(map);
    // Past the mount's level measure too, so only the resize can measure below.
    act(() => {
      fireResize(640);
      vi.advanceTimersByTime(LEVEL_SETTLE_MS);
    });

    sizeLabel(label(map, 'f:Mines'), { ...FITS, scrollWidth: 200 });
    act(() => fireResize(500));
    expect(result.current.mapWidth).toBe(500);

    act(() => vi.advanceTimersByTime(LEVEL_SETTLE_MS - 1));
    expect(result.current.overflowing.has('f:Mines')).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.overflowing.has('f:Mines')).toBe(true);
  });

  it('measures a later resize at once when motion is reduced', () => {
    const map = makeMap({ 'f:Mines': FITS });
    const { result } = renderFit(map, true);
    act(() => {
      fireResize(640);
      vi.advanceTimersByTime(0);
    });
    expect(result.current.overflowing.has('f:Mines')).toBe(false);

    sizeLabel(label(map, 'f:Mines'), { ...FITS, scrollWidth: 200 });
    act(() => {
      fireResize(500);
      vi.advanceTimersByTime(0);
    });
    expect(result.current.overflowing.has('f:Mines')).toBe(true);
  });

  it('leaves no timer running after unmount', () => {
    const map = makeMap({ 'f:Mines': FITS });
    const { rerender, unmount } = renderFit(map);
    act(() => fireResize(640));
    rerender({ levelKey: 'Mines' });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
