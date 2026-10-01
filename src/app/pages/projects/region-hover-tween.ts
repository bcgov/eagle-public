/** Time for a region's hover look to come in, and to go back out. */
export const HOVER_IN_MS = 180;
export const HOVER_OUT_MS = 220;

export interface FrameScheduler {
  request: (step: () => void) => number;
  cancel: (handle: number) => void;
  now: () => number;
}

const browserFrames: FrameScheduler = {
  request: (step) => requestAnimationFrame(step),
  cancel: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};

function reducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Eases each region's hover amount between 0 and 1 over animation frames, handing every step to
 * `apply`. MapLibre does not transition feature state, so the paint reads this number instead.
 * One run per region: a new target cancels the running one and starts from where it had got to.
 */
export function createHoverTween(
  apply: (id: string | number, t: number) => void,
  frames: FrameScheduler = browserFrames,
): { to: (id: string | number, target: 0 | 1) => void; dispose: () => void } {
  const runs = new Map<string | number, { t: number; frame: number | null }>();
  let disposed = false;

  function to(id: string | number, target: 0 | 1): void {
    if (disposed) return;
    const run = runs.get(id) ?? { t: 0, frame: null };
    runs.set(id, run);
    if (run.frame !== null) {
      frames.cancel(run.frame);
      run.frame = null;
    }
    if (run.t === target) return;
    if (reducedMotion()) {
      run.t = target;
      apply(id, target);
      return;
    }
    const from = run.t;
    // A reversal part-way covers only the distance it has left, at the same pace.
    const duration = (target === 1 ? HOVER_IN_MS : HOVER_OUT_MS) * Math.abs(target - from);
    // Timed from now, not from the first frame, so that frame already moves. Both ends read the
    // one clock: a frame's own timestamp can sit on another origin (jsdom's does).
    const start = frames.now();
    const step = (): void => {
      const progress = Math.min(1, (frames.now() - start) / duration);
      run.t = from + (target - from) * (1 - (1 - progress) ** 3);
      apply(id, run.t);
      run.frame = progress < 1 ? frames.request(step) : null;
    };
    run.frame = frames.request(step);
  }

  function dispose(): void {
    disposed = true;
    for (const run of runs.values()) {
      if (run.frame !== null) frames.cancel(run.frame);
    }
    runs.clear();
  }

  return { to, dispose };
}
