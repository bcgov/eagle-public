import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ACTS } from 'app/utils/legislation';
import {
  DAY,
  MIN_SPAN,
  TEN_YEARS,
  WORK_STATUS_LABELS,
  actSegments,
  axisTicks,
  clampView,
  dayMonthYear,
  fullRange,
  hatchRange,
  legendOf,
  listElement,
  listRows,
  monthYear,
  packRows,
  phaseFill,
  time,
  todayOf,
  visibleRange,
  type View,
} from './timeline-axis';
import type {
  DateRange,
  TimelineItem,
  TimelineLane,
  TimelineModel,
  WorkItem,
} from './use-timeline-model';
import './timeline-lanes.css';

/** Pixels a pointer moves before a press on the lanes counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;
/** The lane label column and its gap; the stylesheet reads it as `--lanes-label`. */
const LABEL_WIDTH = 152;
/** A point milestone's box on its lane; a short comment period draws no smaller. */
const DOT = { top: 12, height: 8 };

const trackWidth = (lanes: HTMLElement) => Math.max(1, lanes.clientWidth - LABEL_WIDTH);

export interface TimelineLanesProps {
  model: TimelineModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Items the filter leaves out, drawn faint. */
  dimmedIds?: ReadonlySet<string>;
  /** The dates of the list rows in view, boxed on the lanes. */
  listWindow?: DateRange | null;
  /** Holds the list the window boxes; dragging the window scrolls it. */
  listHost?: RefObject<HTMLElement | null>;
}

interface Mark {
  key: string;
  id: string;
  className: string;
  title: string;
  style: CSSProperties;
}

interface Box {
  top: number;
  height: number;
}

function vars(properties: Record<string, string | number>): CSSProperties {
  return properties as CSSProperties;
}

function when(value: string | null): string {
  const at = time(value);
  return at == null ? 'Not dated' : dayMonthYear(at);
}

/** Explains a hidden chart only, so it is hidden with it; every mark is named in text. */
export function TimelineLegend({ entries }: { entries: [string, string][] }) {
  return (
    <ul className="timeline-lanes__legend" aria-hidden="true">
      {entries.map(([swatch, label]) => (
        <li key={label} className="timeline-lanes__legend-item">
          <span className={`timeline-lanes__swatch timeline-lanes__swatch--${swatch}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function TimelineLanes({
  model,
  selectedId,
  onSelect,
  dimmedIds,
  listWindow,
  listHost,
}: TimelineLanesProps) {
  const [view, setView] = useState<View | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; center: number; span: number } | null>(null);
  const dragged = useRef(false);
  const viewDrag = useRef<{ x: number; offset: number; span: number } | null>(null);
  const viewDragged = useRef(false);
  const listDrag = useRef<{
    x: number;
    from: number;
    span: number;
    min: number;
    max: number;
  } | null>(null);
  const windowRef = useRef<HTMLSpanElement>(null);
  const [listDragging, setListDragging] = useState(false);
  // The slider's own value text speaks its moves; the status would say them twice.
  const [sliderView, setSliderView] = useState<View | null>(null);

  const today = todayOf(model);
  const full = useMemo(() => fullRange(model), [model]);
  // Another project's zoom means nothing here.
  const [shownFull, setShownFull] = useState(full);
  const newLife = shownFull.from !== full.from || shownFull.to !== full.to;
  if (newLife) {
    setShownFull(full);
    setView(null);
  }
  const visible = visibleRange(full, view);
  const { from: T0, to: T1, span, center, zoomed } = visible;
  const whole = full.to - full.from;
  const inView = (at: number | null): at is number => at != null && at >= T0 && at <= T1;
  const overlaps = (a: number, b: number) => b > T0 && a < T1;
  const pct = (at: number) =>
    `${(((Math.min(Math.max(at, T0), T1) - T0) / span) * 100).toFixed(2)}%`;
  const spanPct = (a: number, b: number) =>
    `${(((Math.min(b, T1) - Math.max(a, T0)) / span) * 100).toFixed(2)}%`;
  const width = (a: number, b: number) => `max(3px, ${spanPct(a, b)})`;

  const zoomedRef = useRef(zoomed);
  useEffect(() => {
    zoomedRef.current = zoomed;
  }, [zoomed]);

  // Ctrl or Cmd + wheel zooms around the cursor; React's wheel listener is passive and cannot stop the page scroll.
  useEffect(() => {
    const element = lanesRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const zoom = event.ctrlKey || event.metaKey;
      const pan = zoomedRef.current && Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (!zoom && !pan) return;
      event.preventDefault();
      const track = trackWidth(element);
      const box = element.getBoundingClientRect();
      const share = Math.min(1, Math.max(0, (event.clientX - box.left - LABEL_WIDTH) / track));
      setView((previous) => {
        const current = visibleRange(full, previous);
        if (!zoom) {
          // Firefox can report the wheel in lines or pages, not pixels.
          const unit =
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? 16
              : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? track
                : 1;
          const pixels = event.deltaX * unit;
          const shift = (pixels / track) * current.span;
          return clampView(full, { span: current.span, center: current.center + shift });
        }
        const at = current.from + share * current.span;
        const next = current.span * (event.deltaY > 0 ? 1.25 : 0.8);
        return clampView(full, { span: next, center: at - (share - 0.5) * next });
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [full]);

  useEffect(() => {
    const element = lanesRef.current;
    if (!element) return;
    const end = () => {
      drag.current = null;
      // A release outside the grid before the capture at the threshold never reaches the grid.
      listDrag.current = null;
      setListDragging(false);
    };
    const onMove = (event: globalThis.PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      if (event.buttons === 0) return end();
      const dx = event.clientX - start.x;
      if (Math.abs(dx) >= DRAG_THRESHOLD) dragged.current = true;
      if (!dragged.current) return;
      const shift = (dx / trackWidth(element)) * start.span;
      setView(clampView(full, { span: start.span, center: start.center - shift }));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [full]);

  // When zoomed, the lanes follow the list so its window stays in view.
  const windowFrom = time(listWindow?.from);
  const windowTo = time(listWindow?.to);
  const windowKey = `${windowFrom}-${windowTo}`;
  const [followed, setFollowed] = useState(windowKey);
  // Not mid list-drag: the drag maps the pointer against the view it started on.
  if (followed !== windowKey && !listDragging) {
    setFollowed(windowKey);
    const outside = windowFrom != null && windowTo != null && (windowFrom < T0 || windowTo > T1);
    if (!newLife && zoomed && outside) {
      setView(clampView(full, { span, center: (windowFrom + windowTo) / 2 }));
    }
  }

  const zoomTo = (next: View | null) => setView(next && clampView(full, next));

  /** Whether a press lands on the list box, marks drawn above it included. */
  const onWindow = (event: PointerEvent<HTMLDivElement>) => {
    const box = windowRef.current;
    if (!box) return false;
    if (box.contains(event.target as Node)) return true;
    const { left, right, top, bottom } = box.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    return x >= left && x < right && y >= top && y < bottom;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    listDrag.current = null;
    dragged.current = false;
    if (event.button !== 0) return;
    if (onWindow(event)) {
      if (windowFrom == null) return;
      const from = Math.max(windowFrom, T0);
      listDrag.current = { x: event.clientX, from, span, min: T0, max: T1 };
      setListDragging(true);
    } else if (zoomed) drag.current = { x: event.clientX, center, span };
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (dragged.current) return;
    const id = (event.target as Element).closest('[data-id]')?.getAttribute('data-id');
    if (id) onSelect(id);
  };

  const rowTimes = useMemo(
    // A band's date is its Act's, before the life starts, so its row counts as undated.
    () =>
      new Map(model.items.map((item) => [item.id, item.kind === 'band' ? null : time(item.start)])),
    [model],
  );

  /** Puts the list row dated nearest `at` at the top; the window follows the list. */
  const scrollListTo = (at: number) => {
    const dated = listRows(listElement(listHost?.current ?? null)).flatMap((element) => {
      const date = rowTimes.get(element.dataset['id'] ?? '');
      return date == null ? [] : [{ element, date }];
    });
    const list = dated[0]?.element.parentElement;
    if (!list) return;
    // Rows are not in strict date order, so the ends and the nearest row come from the dates, not the DOM order.
    const dates = dated.map(({ date }) => date);
    if (at <= Math.min(...dates)) list.scrollTop = 0;
    else if (at >= Math.max(...dates)) list.scrollTop = list.scrollHeight;
    else {
      const nearest = dated.reduce((best, one) =>
        Math.abs(one.date - at) < Math.abs(best.date - at) ? one : best,
      );
      list.scrollTop = nearest.element.offsetTop;
    }
  };

  const onWindowPointerEnd = () => {
    listDrag.current = null;
    setListDragging(false);
  };

  const onWindowPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = listDrag.current;
    if (!start) return;
    if (event.buttons === 0) return onWindowPointerEnd();
    const dx = event.clientX - start.x;
    if (!dragged.current && Math.abs(dx) >= DRAG_THRESHOLD) {
      dragged.current = true;
      // Not on the press: a capture there would take a mark's click away from the mark.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!dragged.current) return;
    const at = start.from + (dx / trackWidth(event.currentTarget)) * start.span;
    scrollListTo(Math.min(start.max, Math.max(start.min, at)));
  };

  /** The whole-life date under an x-position on the mini-map. */
  const minimapTime = (minimap: Element, clientX: number) => {
    const box = minimap.getBoundingClientRect();
    const share = box.width ? (clientX - box.left) / box.width : 0.5;
    return full.from + share * whole;
  };

  const onMinimapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (viewDragged.current) return;
    if ((event.target as Element).closest('.timeline-lanes__minimap-view')) return;
    zoomTo({ span, center: minimapTime(event.currentTarget, event.clientX) });
  };

  const onViewPointerEnd = () => {
    viewDrag.current = null;
  };

  const slideTo = (next: View) => {
    const clamped = clampView(full, next);
    setView(clamped);
    setSliderView(clamped);
  };

  const onViewPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    viewDrag.current = null;
    const minimap = event.currentTarget.parentElement;
    if (event.button !== 0 || !minimap) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const offset = center - minimapTime(minimap, event.clientX);
    viewDrag.current = { x: event.clientX, offset, span };
  };

  const onViewPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const start = viewDrag.current;
    const minimap = event.currentTarget.parentElement;
    if (!start || !minimap) return;
    if (event.buttons === 0) return onViewPointerEnd();
    if (Math.abs(event.clientX - start.x) >= DRAG_THRESHOLD) viewDragged.current = true;
    if (!viewDragged.current) return;
    slideTo({ span: start.span, center: minimapTime(minimap, event.clientX) + start.offset });
  };

  const onViewKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const step = span * (event.shiftKey ? 0.5 : 0.1);
    const page = span * 0.5;
    const centers: Partial<Record<string, number>> = {
      ArrowLeft: center - step,
      ArrowDown: center - step,
      ArrowRight: center + step,
      ArrowUp: center + step,
      PageDown: center - page,
      PageUp: center + page,
      Home: full.from,
      End: full.to,
    };
    const next = centers[event.key];
    if (next == null) return;
    event.preventDefault();
    slideTo({ span, center: next });
  };

  const toMark = (
    item: TimelineItem,
    className: string,
    from: number,
    to: number | null,
    { top, height }: Box,
    title: string,
  ): Mark => ({
    key: `${item.id}-${className}`,
    id: item.id,
    className,
    title,
    style:
      to == null
        ? vars({ left: pct(from), top, width: height, height })
        : vars({ left: pct(from), width: width(from, to), top, height }),
  });

  const projectMarks = (branch: boolean): Mark[] => {
    const out: Mark[] = [];
    const hatched = new Set<number | null>();
    const continues = !branch && model.lanes.some((lane) => lane.id === 'second-assessment');
    for (const item of model.items) {
      if (item.lane !== 'assessment' || item.branch !== branch) continue;
      const start = time(item.start);
      const end = time(item.end);
      const dated = `${item.title} · ${when(item.start)}`;
      switch (item.kind) {
        case 'phase':
        case 'history': {
          if (item.kind === 'phase' && item.status !== 'undated') {
            if (start == null || end == null || !overlaps(start, end)) break;
            const title = `${item.title} · ${when(item.start)} to ${when(item.end)}`;
            const bar = toMark(item, 'phase', start, end, { top: 10, height: 12 }, title);
            out.push({
              ...bar,
              style: { ...bar.style, ...vars({ '--timeline-fill': phaseFill(item) }) },
            });
            break;
          }
          // Undated phases of one Act share one known range, so one hatch covers them.
          const range = hatchRange(item);
          if (!range || hatched.has(item.actYear) || !overlaps(...range)) break;
          hatched.add(item.actYear);
          const title = `${item.title} · Not dated`;
          out.push(toMark(item, 'undated', ...range, { top: 10, height: 12 }, title));
          break;
        }
        case 'proponent':
          if (start != null && end != null && overlaps(start, end)) {
            const title = `${item.title} · ${item.days} days`;
            out.push(toMark(item, 'proponent thin', start, end, { top: 13, height: 3 }, title));
          }
          break;
        case 'transition': {
          // Only an undated transition is drawn: a box over the dates it falls between.
          const lo = time(item.transition.between?.from);
          const hi = time(item.transition.between?.to);
          if (lo != null && hi != null && overlaps(lo, hi)) {
            const title = `${item.title} · Date: Not recorded`;
            out.push(toMark(item, 'transition', lo, hi, { top: 8, height: 16 }, title));
          }
          break;
        }
        case 'milestone':
          // A comment period has an end: drawn as a span at the milestone's height.
          if (end != null && start != null && end > start) {
            if (!overlaps(start, end)) break;
            const title = `${item.title} · ${when(item.start)} to ${when(item.end)}`;
            const mark = toMark(item, 'milestone-span', start, end, DOT, title);
            const across = spanPct(start, end);
            // Narrower than a point: drawn point-sized, centred on the span like a point on its date.
            const left = `calc(${pct(start)} + min(0px, (${across} - ${DOT.height}px) / 2))`;
            const style = { ...mark.style, left, width: `max(${DOT.height}px, ${across})` };
            out.push({ ...mark, style });
          } else if (inView(start)) {
            out.push(toMark(item, 'milestone', start, null, DOT, dated));
          }
          break;
        case 'branchStart':
          if (inView(start)) {
            const hook = toMark(
              item,
              'hook thin',
              start,
              null,
              { top: -26, height: 42 },
              item.title,
            );
            out.push({ ...hook, style: { ...hook.style, width: 2 } });
          }
          break;
        case 'certificate': {
          if (start == null) break;
          const issued = item.outcome === 'issued';
          // An issued certificate runs on to Today; the main line also runs on, thin, past a first assessment.
          if ((issued || continues) && overlaps(start, today)) {
            const line = issued
              ? toMark(item, 'after-certificate thin', start, today, { top: 28, height: 5 }, dated)
              : toMark(item, 'line-on thin', start, today, { top: 15, height: 2 }, dated);
            out.push(line);
          }
          if (inView(start)) {
            const className = issued ? 'certificate' : 'certificate-stop';
            out.push(toMark(item, className, start, null, { top: 9, height: 14 }, dated));
          }
          break;
        }
      }
    }
    return out;
  };

  const workMarks = (laneId: 'amendments' | 'other') => {
    const items = model.items.filter((item) => item.lane === laneId);
    const documents = items.filter((item) => item.kind === 'document');
    const substantial = items.filter((item) => item.kind === 'substantialStart');
    const works = items.filter((item): item is WorkItem => item.kind === 'work');
    // Packed over the whole life so bars keep their row while the view pans.
    const packed = packRows(works, today);
    const rows = Math.max(1, ...packed.map(({ row }) => row + 1));
    // Past 3 rows the bars thin out so the lane stays short; every bar stays clickable.
    const [height, pitch] = rows > 3 ? [6, 8] : [12, 16];
    const offset = documents.length || substantial.length ? 20 : 0;
    const out: Mark[] = [];
    for (const item of documents) {
      const at = time(item.start);
      const title = `${item.title} · ${when(item.start)}`;
      if (inView(at)) out.push(toMark(item, 'document', at, null, { top: 7, height: 12 }, title));
    }
    for (const item of substantial) {
      const deadline = time(item.deadline);
      const decided = time(item.decided);
      const box = { top: 7, height: 10 };
      if (inView(deadline)) {
        const title = `Substantial start deadline · ${when(item.deadline)}`;
        out.push(toMark(item, 'deadline', deadline, null, box, title));
      }
      if (inView(decided)) {
        const className = item.outcome === 'Substantially started' ? 'decided' : 'decided-not';
        const title = `${item.outcome} · ${when(item.decided)}`;
        out.push(toMark(item, className, decided, null, box, title));
      }
    }
    for (const { work, row } of packed) {
      const top = 9 + offset + row * pitch;
      const start = time(work.start) ?? today;
      const end = time(work.end) ?? today;
      if (overlaps(start, end)) {
        const title = `${work.title} · ${when(work.start)} · ${WORK_STATUS_LABELS[work.status]}`;
        out.push(toMark(work, `work work--${work.status}`, start, end, { top, height }, title));
      }
      const planned = time(work.plannedDecision);
      if (planned == null) continue;
      const due = dayMonthYear(planned);
      if (planned > today && overlaps(today, planned)) {
        const box = { top: top + 1, height: height - 2 };
        out.push(toMark(work, 'planned', today, planned, box, `${work.title} · planned to ${due}`));
      }
      if (inView(planned)) {
        const title = `${work.title} · Planned decision ${due}`;
        out.push(toMark(work, 'planned-decision', planned, null, { top, height }, title));
      }
    }
    const note =
      [
        documents.length
          ? `${documents.length} ${documents.length === 1 ? 'document' : 'documents'} before Track`
          : '',
        works.length ? `${works.length} in Track` : '',
        substantial.length ? 'substantial start' : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'None';
    return { marks: out, note, height: 18 + offset + (works.length ? rows * pitch : 0) };
  };

  const actNames = model.acts.map((act) => act.name);
  const laneRows: (TimelineLane & { note: string; marks: Mark[]; height: number })[] =
    model.lanes.flatMap((lane) => {
      switch (lane.id) {
        case 'legislation':
          return [];
        case 'assessment': {
          const note = actNames.join(' → ') + (actNames.length > 1 ? ' · transitioned' : '');
          return [{ ...lane, note, marks: projectMarks(false), height: 42 }];
        }
        case 'second-assessment': {
          const note = `${actNames[actNames.length - 1] ?? ''} · branch`;
          return [{ ...lane, note, marks: projectMarks(true), height: 42 }];
        }
        default:
          return [{ ...lane, ...workMarks(lane.id) }];
      }
    });

  const actBands = actSegments(T0, T1).map((segment) => ({
    ...segment,
    onProject: model.acts.some((one) => one.year === segment.act.year),
  }));
  const boundaries = ACTS.slice(1)
    .map((act) => time(act.inForce))
    .filter(inView);
  const lines: ReactNode = (
    <>
      {boundaries.map((at) => (
        <span key={at} className="timeline-lanes__boundary" style={{ left: pct(at) }} />
      ))}
      {inView(today) && (
        <span className="timeline-lanes__today-line" style={{ left: pct(today) }} />
      )}
    </>
  );

  const mark = ({ key, id, className, title, style }: Mark) => (
    <span
      key={key}
      data-id={id}
      title={title}
      className={[
        'timeline-lanes__mark',
        ...className.split(' ').map((name) => `timeline-lanes__mark--${name}`),
        dimmedIds?.has(id) ? 'timeline-lanes__mark--dimmed' : '',
        selectedId === id ? 'timeline-lanes__mark--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    />
  );

  const hasWindow = windowFrom != null && windowTo != null;
  const windowYears = hasWindow
    ? [new Date(windowFrom).getUTCFullYear(), new Date(windowTo).getUTCFullYear()]
    : null;
  const range = zoomed ? `Showing ${monthYear(T0)} – ${monthYear(T1)}` : 'Whole life, to scale';
  const heading =
    range +
    (windowYears
      ? ` · list showing ${windowYears[0]}${windowYears[1] !== windowYears[0] ? ` – ${windowYears[1]}` : ''}`
      : '');
  const windowLeft = hasWindow ? Math.min(Math.max(windowFrom, T0), T1) : T0;
  // Kept while dragging: a drag clamped at an edge can scroll the list past the lanes, and the
  // box going away ends the drag (below). Off the lanes it shrinks to the edge.
  const windowStyle =
    hasWindow && (listDragging || overlaps(windowFrom, windowTo))
      ? vars({
          '--window-from': ((windowLeft - T0) / span).toFixed(4),
          '--window-share': (Math.max(0, Math.min(windowTo, T1) - windowLeft) / span).toFixed(4),
        })
      : null;
  const windowShown = windowStyle != null;
  // The box goes away mid-drag only when the list loses its window; nothing is left to drag.
  useEffect(() => {
    if (!windowShown) return;
    return () => {
      listDrag.current = null;
      setListDragging(false);
    };
  }, [windowShown]);

  const minimapPct = (at: number) =>
    `${(((Math.min(Math.max(at, full.from), full.to) - full.from) / whole) * 100).toFixed(2)}%`;
  const plannedDecisions = model.items.flatMap((item) => {
    const at = item.kind === 'work' ? time(item.plannedDecision) : null;
    return at == null ? [] : [at];
  });

  const legend = legendOf(model, 'lanes', full);

  const zoomButton = (
    label: string,
    aria: string,
    action: () => void,
    options: { pressed?: boolean; disabled?: boolean },
  ) => (
    <button
      type="button"
      className="timeline-lanes__zoom"
      aria-label={aria}
      aria-pressed={options.pressed}
      disabled={options.disabled}
      onClick={action}
    >
      {label}
    </button>
  );

  return (
    <section
      className="timeline-lanes"
      aria-label="Lanes overview"
      style={vars({ '--lanes-label': `${LABEL_WIDTH}px` })}
    >
      <div className="timeline-lanes__head">
        <p className="timeline-lanes__heading">{heading}</p>
        {/* The zoom buttons act on a hidden chart, so the range is announced; the list part is
            not, or every list scroll would interrupt reading. */}
        <span className="timeline-lanes__hidden" role="status">
          {view != null && view === sliderView ? '' : range}
        </span>
        <div className="timeline-lanes__controls">
          <p className="timeline-lanes__hint">
            {windowStyle
              ? zoomed
                ? 'Drag the box to scroll, outside it to pan · '
                : 'Drag the box to scroll the list · '
              : zoomed && 'Drag to pan · '}
            Ctrl or <span aria-hidden="true">⌘</span>
            <span className="timeline-lanes__hidden">Command</span> + scroll to zoom
          </p>
          <div role="group" aria-label="Zoom" className="timeline-lanes__zoom-group">
            {zoomButton('Whole life', 'Show the whole life', () => zoomTo(null), {
              pressed: !zoomed,
            })}
            {zoomButton(
              'Last 10 years',
              'Show the last 10 years',
              () => zoomTo({ span: TEN_YEARS, center: full.to - TEN_YEARS / 2 }),
              {
                pressed: zoomed && Math.abs(span - TEN_YEARS) < DAY && T1 >= full.to - DAY,
                disabled: whole <= TEN_YEARS,
              },
            )}
            {zoomButton('−', 'Zoom out', () => zoomTo({ span: span * 2, center }), {
              disabled: !zoomed,
            })}
            {zoomButton('+', 'Zoom in', () => zoomTo({ span: span / 2, center }), {
              disabled: span <= MIN_SPAN + DAY,
            })}
          </div>
        </div>
      </div>
      {/* The list is the accessible version of this chart; marks here are pointer shortcuts to it. */}
      <div
        ref={lanesRef}
        aria-hidden="true"
        className={`timeline-lanes__grid${zoomed ? ' timeline-lanes__grid--zoomed' : ''}${listDragging ? ' timeline-lanes__grid--dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onWindowPointerMove}
        onPointerUp={onWindowPointerEnd}
        onPointerCancel={onWindowPointerEnd}
        onLostPointerCapture={(event) => {
          // A pressed mark's implicit touch capture is lost to the grid's and bubbles up here.
          if (event.target === event.currentTarget) onWindowPointerEnd();
        }}
        onClick={onClick}
      >
        {windowStyle && (
          <span
            className={`timeline-lanes__window${listDragging ? ' timeline-lanes__window--dragging' : ''}`}
            ref={windowRef}
            style={windowStyle}
            title="Drag to scroll the list"
          >
            <span className="timeline-lanes__window-handle" />
          </span>
        )}
        <p className="timeline-lanes__label">
          Legislation<span className="timeline-lanes__note">Act in force</span>
        </p>
        <div className="timeline-lanes__track timeline-lanes__track--acts">
          {actBands.map(({ act, index, start, end, onProject }) => (
            <span
              key={act.year}
              title={`${act.label} · in force from ${when(act.inForce)}`}
              className={[
                'timeline-lanes__act',
                index % 2 ? 'timeline-lanes__act--alt' : '',
                onProject ? 'timeline-lanes__act--on-project' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: pct(start), width: width(start, end) }}
            >
              <span className="timeline-lanes__act-label">{act.year} Act</span>
            </span>
          ))}
          {lines}
        </div>
        {laneRows.map((row) => (
          <LaneRow
            key={row.id}
            label={row.label}
            note={row.note}
            height={row.height}
            indent={row.id === 'second-assessment'}
          >
            {lines}
            {row.marks.map(mark)}
          </LaneRow>
        ))}
        <span />
        <div className="timeline-lanes__axis">
          {axisTicks(visible, today).map((tick) => (
            <span
              key={tick.time}
              className={`timeline-lanes__tick${tick.year ? ' timeline-lanes__tick--year' : ''}`}
              style={{ left: pct(tick.time) }}
            >
              {tick.label}
            </span>
          ))}
          {inView(today) && (
            <span
              className="timeline-lanes__tick timeline-lanes__tick--today"
              style={{ left: pct(today) }}
            >
              Today
            </span>
          )}
        </div>
      </div>
      {/* Outside the hidden grid: the view box is a keyboard control. */}
      {zoomed && (
        <div className="timeline-lanes__minimap-row">
          <p className="timeline-lanes__note timeline-lanes__minimap-label">Whole life</p>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut; the view slider inside is its keyboard equivalent */}
          <div
            className="timeline-lanes__minimap"
            title="Click to move the view"
            onPointerDown={() => {
              viewDragged.current = false;
            }}
            onClick={onMinimapClick}
          >
            {model.items.flatMap((item) => {
              // The band dates its Act and a group repeats its works' day: neither is an event.
              const at = item.kind === 'band' || item.kind === 'group' ? null : time(item.start);
              return at == null
                ? []
                : [
                    <span
                      key={item.id}
                      className="timeline-lanes__minimap-tick"
                      style={{ left: minimapPct(at) }}
                    />,
                  ];
            })}
            {plannedDecisions.map((at, index) => (
              <span
                key={`planned-${index}`}
                className="timeline-lanes__minimap-planned"
                style={{ left: minimapPct(at) }}
              />
            ))}
            <span
              className="timeline-lanes__minimap-view"
              style={{ left: minimapPct(T0), width: `${((span / whole) * 100).toFixed(2)}%` }}
              role="slider"
              tabIndex={0}
              aria-label="View on the whole life"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(((T0 - full.from) / (whole - span)) * 100)}
              aria-valuetext={range}
              onPointerDown={onViewPointerDown}
              onPointerMove={onViewPointerMove}
              onPointerUp={onViewPointerEnd}
              onPointerCancel={onViewPointerEnd}
              onLostPointerCapture={onViewPointerEnd}
              onKeyDown={onViewKeyDown}
            />
          </div>
        </div>
      )}
      <TimelineLegend entries={legend} />
    </section>
  );
}

function LaneRow({
  label,
  note,
  height,
  indent,
  children,
}: {
  label: string;
  note: string;
  height: number;
  indent: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <p className="timeline-lanes__label timeline-lanes__label--lane">
        {indent && '↳ '}
        <span>{label}</span>
        <span className="timeline-lanes__note">{note}</span>
      </p>
      <div className="timeline-lanes__track" style={{ height }}>
        {children}
      </div>
    </>
  );
}
