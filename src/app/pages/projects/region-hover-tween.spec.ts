import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHoverTween, HOVER_IN_MS, HOVER_OUT_MS } from './region-hover-tween';

/** Animation frames a spec runs by hand, on a clock it sets. */
function manualFrames() {
  const queue = new Map<number, () => void>();
  let next = 1;
  let time = 0;
  return {
    request: (step: () => void) => {
      queue.set(next, step);
      return next++;
    },
    cancel: (handle: number) => {
      queue.delete(handle);
    },
    now: () => time,
    /** Moves the clock to `at` and runs the frames waiting for it. */
    tick(at: number): void {
      time = at;
      const steps = [...queue.values()];
      queue.clear();
      for (const step of steps) step();
    },
    get pending(): number {
      return queue.size;
    },
  };
}

/** Every value handed to `apply`, per region. */
function setup() {
  const frames = manualFrames();
  const seen = new Map<string | number, number[]>();
  const tween = createHoverTween((id, t) => seen.set(id, [...(seen.get(id) ?? []), t]), frames);
  const last = (id: string) => seen.get(id)?.at(-1);
  return { frames, seen, tween, last };
}

function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion: reduce'),
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('createHoverTween', () => {
  it('eases up to 1 over the enter time, rising every frame', () => {
    const { frames, seen, tween, last } = setup();

    tween.to('Peace', 1);
    frames.tick(HOVER_IN_MS / 4);
    frames.tick(HOVER_IN_MS / 2);
    frames.tick(HOVER_IN_MS);

    const values = seen.get('Peace')!;
    // Timed from the call, so the first frame has already moved; ease-out runs ahead of linear.
    expect(values[0]).toBeGreaterThan(0.25);
    expect(values[1]).toBeGreaterThan(0.5);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(last('Peace')).toBe(1);
    expect(frames.pending).toBe(0);
  });

  it('eases back to 0 over the leave time', () => {
    const { frames, tween, last } = setup();
    tween.to('Peace', 1);
    frames.tick(HOVER_IN_MS);

    frames.tick(500);
    tween.to('Peace', 0);
    frames.tick(500 + HOVER_OUT_MS - 1);
    expect(last('Peace')).toBeGreaterThan(0);
    frames.tick(500 + HOVER_OUT_MS);

    expect(last('Peace')).toBe(0);
    expect(frames.pending).toBe(0);
  });

  it('turns back from where it got to, over only the distance left', () => {
    const { frames, tween, last } = setup();
    const turn = HOVER_IN_MS / 4;
    tween.to('Peace', 1);
    frames.tick(turn);
    const reached = last('Peace')!;

    tween.to('Peace', 0);

    expect(frames.pending).toBe(1);
    frames.tick(turn + HOVER_OUT_MS * reached - 1);
    expect(last('Peace')).toBeGreaterThan(0);
    expect(last('Peace')).toBeLessThan(reached);
    frames.tick(turn + HOVER_OUT_MS * reached);
    expect(last('Peace')).toBe(0);
  });

  it('runs each region on its own when the pointer crosses from one to the next', () => {
    const { frames, tween, last } = setup();
    tween.to('Peace', 1);
    frames.tick(HOVER_IN_MS);

    tween.to('Peace', 0);
    tween.to('Omineca', 1);
    expect(frames.pending).toBe(2);
    frames.tick(HOVER_IN_MS + HOVER_OUT_MS);

    expect(last('Peace')).toBe(0);
    expect(last('Omineca')).toBe(1);
    expect(frames.pending).toBe(0);
  });

  it('jumps straight to the end when reduced motion is asked for', () => {
    stubReducedMotion();
    const { frames, seen, tween } = setup();

    tween.to('Peace', 1);

    expect(seen.get('Peace')).toEqual([1]);
    expect(frames.pending).toBe(0);
  });

  it('reads reduced motion at each change, so turning it on mid-run jumps', () => {
    const { frames, tween, last } = setup();
    tween.to('Peace', 1);
    frames.tick(HOVER_IN_MS / 4);

    stubReducedMotion();
    tween.to('Peace', 0);

    expect(last('Peace')).toBe(0);
    expect(frames.pending).toBe(0);
  });

  it('stops every running frame when disposed, and ignores later changes', () => {
    const { frames, seen, tween } = setup();
    tween.to('Peace', 1);
    tween.to('Skeena', 1);

    tween.dispose();
    tween.to('Omineca', 1);

    expect(frames.pending).toBe(0);
    expect(seen.has('Omineca')).toBe(false);
  });
});
