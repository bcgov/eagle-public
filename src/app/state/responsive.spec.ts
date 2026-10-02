import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSettledMediaQuery } from './responsive';

const QUERY = '(max-width: 719.98px)';

/** One media query list whose answer the test flips, plus the frames waiting to run. */
function stubMedia() {
  let matches = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      get matches() {
        return matches;
      },
      media,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  return {
    set(value: boolean) {
      matches = value;
      act(() => listeners.forEach((listener) => listener()));
    },
    runFrame() {
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(0)));
    },
  };
}

describe('useSettledMediaQuery', () => {
  let media: ReturnType<typeof stubMedia>;

  beforeEach(() => {
    media = stubMedia();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('answers the query on first render', () => {
    media.set(true);

    expect(renderHook(() => useSettledMediaQuery(QUERY)).result.current).toBe(true);
  });

  it('takes a change once it has held for a frame', () => {
    const { result } = renderHook(() => useSettledMediaQuery(QUERY));

    media.set(true);
    expect(result.current).toBe(false);

    media.runFrame();
    expect(result.current).toBe(true);
  });

  it('ignores a one-frame flip, as a full-page capture makes', () => {
    const answers: boolean[] = [];
    renderHook(() => {
      const answer = useSettledMediaQuery(QUERY);
      answers.push(answer);
      return answer;
    });

    media.set(true);
    media.set(false);
    media.runFrame();

    expect(answers).not.toContain(true);
  });
});
