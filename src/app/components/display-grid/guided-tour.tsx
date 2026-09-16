import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { stepsOnPage, targetOf, type TourStep } from './tour-steps';
import { useScrollLock } from './use-scroll-lock';
import './guided-tour.css';

interface GuidedTourProps {
  open: boolean;
  /** Called when the tour finishes, is skipped, or has nothing on the page to point at. */
  onEnd: () => void;
  /** Where focus goes when the tour ends. Defaults to whatever had focus when it started. */
  restoreFocusTo?: RefObject<HTMLElement | null>;
}

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
  /** The viewport the box was read against. The card is placed off this pair rather than off a
      live `window` read, so a viewport that changes without a resize — the swap Chromium makes
      to take a full-page shot — cannot move the card away from the ring drawn beside it. */
  viewWidth: number;
  viewHeight: number;
}

/** The gap between the spotlighted control and the ring drawn round it. */
const PAD = 6;
/** How close to a viewport edge a control may sit before the step scrolls it into view. */
const MARGIN = 140;
const CARD_WIDTH = 380;
/** Below this much room under the control, the card is hung above it instead. */
const CARD_ROOM = 200;

/** Whether a fresh measurement is the box already lit, in the viewport it was lit against. */
function sameSpot(was: Spot | null, at: DOMRect, viewWidth: number, viewHeight: number): boolean {
  return (
    was !== null &&
    was.top === at.top &&
    was.left === at.left &&
    was.width === at.width &&
    was.height === at.height &&
    was.viewWidth === viewWidth &&
    was.viewHeight === viewHeight
  );
}

/** Whether two step lists point at the same controls, in the same order. */
function sameTargets(a: readonly TourStep[], b: readonly TourStep[]): boolean {
  return a.length === b.length && a.every((one, at) => one.target === b[at].target);
}

/**
 * The guided tour: one control at a time, lit by a gold ring and described by a card.
 *
 * Four dim panels around the target rather than one big ring shadow, because a shadow cannot
 * capture a click: the page behind would stay interactive under a dim that said otherwise. The
 * spotlighted control is the hole, and stays usable.
 */
export function GuidedTour({ open, onEnd, restoreFocusTo }: GuidedTourProps) {
  const card = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const bodyId = useId();
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  /** Bumped to ask for a fresh measurement of the same step, after a resize. */
  const [tick, setTick] = useState(0);
  const scrollLockedTo = useScrollLock(open);
  /** Where this tour pinned the page, so a remeasure can put it back instead of re-pinning. */
  const pinned = useRef<number | null>(null);
  /** The step the page was last scrolled for: only a new step is allowed to move the page. */
  const scrolledFor = useRef<string | null>(null);

  // Held in a ref so ending the tour is a stable callback: a caller that passes an inline arrow
  // would otherwise restart the tour on its own next render.
  const ending = useRef(onEnd);
  useEffect(() => {
    ending.current = onEnd;
  }, [onEnd]);
  const end = useCallback(() => {
    setSpot(null);
    ending.current();
  }, []);

  const step = steps[index];

  // Which steps this page can show is read when the tour starts and again on every move, so a
  // control that arrives with the first search joins the walk and "of M" counts what is there.
  // Layout effects, not passive ones: a passive pass paints one frame of dimmed page with no card
  // on it, and focus sits on the opener until that frame is replaced.
  useLayoutEffect(() => {
    if (!open) return;
    const present = stepsOnPage();
    pinned.current = null;
    scrolledFor.current = null;
    // Which controls exist is a DOM read, and the DOM is only the committed one inside an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the page, not from props
    setSteps(present);
    setIndex(0);
    opener.current = (restoreFocusTo?.current ?? document.activeElement) as HTMLElement | null;
    if (!present.length) end();
    // `restoreFocusTo` is read once, at the moment the tour starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, end]);

  /**
   * Where the control being read about sits in a freshly read list. A control that has gone hands
   * its slot to whatever followed it, so the walk carries on from there rather than starting over.
   */
  const landingOf = useCallback(
    (present: TourStep[]) => {
      const kept = present.findIndex((one) => one.target === steps[index]?.target);
      return kept >= 0 ? kept : Math.min(index, present.length - 1);
    },
    [index, steps],
  );

  /** Reads the page again: a resize moves the controls, and can take one away entirely. */
  const remeasure = useCallback(() => {
    const present = stepsOnPage();
    if (!present.length) {
      end();
      return;
    }
    if (!sameTargets(present, steps)) {
      setSteps(present);
      setIndex(landingOf(present));
    }
    setTick((was) => was + 1);
  }, [end, landingOf, steps]);

  /** Moves the walk, re-reading the page first so a control that has since arrived is counted. */
  const move = useCallback(
    (delta: number) => {
      const present = stepsOnPage();
      if (!present.length) {
        end();
        return;
      }
      const next = landingOf(present) + delta;
      if (next < 0) return;
      if (next >= present.length) {
        end();
        return;
      }
      setSteps(present);
      setIndex(next);
    },
    [end, landingOf],
  );

  // The spotlight is drawn against the viewport, so a new step brings a target below the fold into
  // view first — which the lock permits, because it pins a position rather than freezing one. A
  // remeasure of the step already showing only re-reads the box: it never moves the page.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const element = targetOf(step);
    if (!element) {
      // A control that went away between the count and the measurement: drop its step rather than
      // point at nothing. The list only shrinks here, so this settles instead of spinning.
      const left = steps.filter((one) => one.target !== step.target);
      if (!left.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing left to point at, which only a measurement can see
        end();
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the control is gone from the page, which only a measurement can see
      setSteps(left);
      setIndex(Math.min(index, left.length - 1));
      return;
    }
    if (scrolledFor.current !== step.target) {
      const before = element.getBoundingClientRect();
      pinned.current =
        before.top < MARGIN || before.bottom > window.innerHeight - MARGIN
          ? scrollLockedTo(window.scrollY + before.top - MARGIN)
          : window.scrollY;
      scrolledFor.current = step.target;
    } else if (pinned.current !== null && window.scrollY !== pinned.current) {
      // A resize can carry the locked page off its pin — a 1x1 viewport taken for a full-page
      // screenshot clamps it to the top. Put it back, rather than pin wherever it landed: a
      // re-pin moves the page under a reader who never asked for a new step.
      scrollLockedTo(pinned.current);
    }
    const at = element.getBoundingClientRect();
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    // Same box, same viewport, same state: a read that reports no movement must not re-render, or
    // the focus effect below takes focus off whatever button in the card the reader had reached.
    setSpot((was) =>
      sameSpot(was, at, viewWidth, viewHeight)
        ? was
        : {
            top: at.top,
            left: at.left,
            width: at.width,
            height: at.height,
            viewWidth,
            viewHeight,
          },
    );
  }, [open, step, steps, index, tick, end, scrollLockedTo]);

  // Focus follows the step: the card is the only thing a reader can reach while the tour runs.
  useLayoutEffect(() => {
    if (open && spot) card.current?.focus();
  }, [open, spot, index]);

  // `aria-modal` on the card only claims the page behind is out of play; `inert` makes it so.
  // Everything outside the tour is inert bar the lit control, which the four dim panels leave
  // pressable on purpose, so the reader can try the thing the step is describing.
  useEffect(() => {
    const tour = root.current;
    if (!open || !tour) return;
    // The tour and the lit control are where the walk stops; the ancestors above them have to be
    // stepped through, because it is their other children that go inert.
    const keep = new Set<Element>([tour]);
    const target = step ? targetOf(step) : null;
    if (target) keep.add(target);
    const ancestors = new Set<Element>();
    for (const branch of keep) {
      for (
        let node = branch.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        ancestors.add(node);
      }
    }
    const made: Element[] = [];
    const walk = (parent: Element) => {
      for (const child of parent.children) {
        if (keep.has(child)) continue;
        if (ancestors.has(child)) {
          walk(child);
        } else if (!child.hasAttribute('inert')) {
          child.setAttribute('inert', '');
          made.push(child);
        }
        // Anything already inert for its own reasons — a collapsed filter panel — is left alone,
        // so the end of the tour does not hand it back.
      }
    };
    walk(document.body);
    return () => {
      for (const child of made) child.removeAttribute('inert');
    };
  }, [open, step, spot]);

  // Declared after the inert effect so its cleanup runs second: a browser refuses focus on an
  // element still inside an inert subtree, and the opener sits in one until that cleanup above.
  useEffect(() => {
    if (!open) return;
    return () => {
      const back = opener.current;
      if (back?.isConnected) back.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const element = step ? targetOf(step) : null;
    const observer = new ResizeObserver(remeasure);
    if (element) observer.observe(element);
    // The resize event arrives before React has re-rendered the grid, so the read it triggers
    // still sees the control a breakpoint is about to take away. The tree watch catches that commit.
    let frame = 0;
    const watcher = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!sameTargets(stepsOnPage(), steps)) remeasure();
      });
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', remeasure);
    return () => {
      observer.disconnect();
      watcher.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', remeasure);
    };
  }, [open, step, steps, remeasure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        end();
        return;
      }
      if (event.key !== 'Tab') return;
      // `aria-modal` has to hold in fact as well as in the attribute: Tab stays inside the card.
      const dialog = card.current;
      if (!dialog) return;
      const reachable = [
        ...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ];
      if (!reachable.length) return;
      const first = reachable[0];
      const last = reachable[reachable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, end]);

  if (!open || !step || !spot) return null;

  const onLastStep = index === steps.length - 1;
  const below = spot.top + spot.height + 12;
  // Every number below comes off the measurement, never off `window`: the card and the ring have
  // to be placed against the same viewport or they part company mid-render.
  const room = spot.viewHeight - below;
  const width = Math.min(CARD_WIDTH, spot.viewWidth - 32);
  const left = Math.min(Math.max(12, spot.left), spot.viewWidth - width - 12);

  return (
    <div ref={root} className="display-grid__overlay display-grid__tour">
      <div
        aria-hidden="true"
        className="display-grid__tour-panel"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, Math.round(spot.top - PAD)) }}
      />
      <div
        aria-hidden="true"
        className="display-grid__tour-panel"
        style={{
          top: Math.round(spot.top - PAD),
          left: 0,
          width: Math.max(0, Math.round(spot.left - PAD)),
          height: Math.round(spot.height + PAD * 2),
        }}
      />
      <div
        aria-hidden="true"
        className="display-grid__tour-panel"
        style={{
          top: Math.round(spot.top - PAD),
          left: Math.round(spot.left + spot.width + PAD),
          right: 0,
          height: Math.round(spot.height + PAD * 2),
        }}
      />
      <div
        aria-hidden="true"
        className="display-grid__tour-panel"
        style={{ top: Math.round(spot.top + spot.height + PAD), left: 0, right: 0, bottom: 0 }}
      />

      <div
        aria-hidden="true"
        className="display-grid__tour-ring"
        style={{
          top: Math.round(spot.top - PAD),
          left: Math.round(spot.left - PAD),
          width: Math.round(spot.width + PAD * 2),
          height: Math.round(spot.height + PAD * 2),
          boxShadow: '0 0 0 3px var(--theme-gold-90)',
        }}
      />

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="display-grid__tour-card"
        style={{
          width: Math.round(width),
          left: Math.round(left),
          ...(room > CARD_ROOM
            ? { top: Math.round(below) }
            : { bottom: Math.round(spot.viewHeight - spot.top + 12) }),
        }}
      >
        {/* A move keeps focus on the card, and refocusing the element already focused fires
            nothing a reader would hear. The step is spoken from here instead. */}
        <p aria-live="polite" className="display-grid__visually-hidden">
          {`Step ${index + 1} of ${steps.length}. ${step.title}`}
        </p>
        <p className="display-grid__tour-count">{`Step ${index + 1} of ${steps.length}`}</p>
        <h2 className="display-grid__tour-title">{step.title}</h2>
        <p id={bodyId} className="display-grid__tour-body">
          {step.body}
        </p>
        <div className="display-grid__tour-actions">
          <button type="button" className="display-grid__tour-skip" onClick={end}>
            Skip tour
          </button>
          <span className="display-grid__tour-walk">
            <button
              type="button"
              className="display-grid__tour-back"
              disabled={index === 0}
              onClick={() => move(-1)}
            >
              Back
            </button>
            <button
              type="button"
              className="display-grid__tour-next"
              // Always `move`: it re-reads the page, so a step that has appeared since this card
              // rendered is walked to rather than treated as the end.
              onClick={() => move(1)}
            >
              {onLastStep ? 'Done' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
