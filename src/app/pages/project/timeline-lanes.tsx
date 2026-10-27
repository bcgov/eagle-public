import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ACTS } from 'app/utils/legislation';
import { trackPhaseStyle } from './assessment-stages';
import {
  DAY,
  MIN_SPAN,
  TEN_YEARS,
  WORK_STATUS_LABELS,
  axisTicks,
  clampView,
  dayMonthYear,
  fullRange,
  monthYear,
  packRows,
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
  WorkStatus,
} from './use-timeline-model';
import './timeline-lanes.css';

/** Pixels a pointer moves before a press on the lanes counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;
/** The lane label column and its gap; the stylesheet reads it as `--lanes-label`. */
const LABEL_WIDTH = 152;

export interface TimelineLanesProps {
  model: TimelineModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Items the filter leaves out, drawn faint. */
  dimmedIds?: ReadonlySet<string>;
  /** The dates of the list rows in view, boxed on the lanes. */
  listWindow?: DateRange | null;
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

function phaseFill(item: Extract<TimelineItem, { kind: 'phase' }>): string {
  const fill = item.row ?? trackPhaseStyle(item.title);
  return fill ? `var(${fill.token}, ${fill.hex})` : 'var(--theme-gray-60)';
}

function when(value: string | null): string {
  const at = time(value);
  return at == null ? 'Not dated' : dayMonthYear(at);
}

/** The span an undated phase or a collapsed history row is hatched across, if its range is known. */
function hatchRange(item: TimelineItem): [number, number] | null {
  const undated = item.kind === 'history' || (item.kind === 'phase' && item.status === 'undated');
  if (!undated || item.parentId) return null;
  const lo = time(item.knownRange?.from);
  const hi = time(item.knownRange?.to);
  return lo != null && hi != null && hi > lo ? [lo, hi] : null;
}

export function TimelineLanes({
  model,
  selectedId,
  onSelect,
  dimmedIds,
  listWindow,
}: TimelineLanesProps) {
  const [view, setView] = useState<View | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; center: number; span: number } | null>(null);
  const dragged = useRef(false);

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
  const width = (a: number, b: number) =>
    `max(3px, ${(((Math.min(b, T1) - Math.max(a, T0)) / span) * 100).toFixed(2)}%)`;

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
      const track = Math.max(1, element.clientWidth - LABEL_WIDTH);
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
    };
    const onMove = (event: globalThis.PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      if (event.buttons === 0) return end();
      const dx = event.clientX - start.x;
      if (Math.abs(dx) >= DRAG_THRESHOLD) dragged.current = true;
      if (!dragged.current) return;
      const shift = (dx / Math.max(1, element.clientWidth - LABEL_WIDTH)) * start.span;
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
  if (followed !== windowKey) {
    setFollowed(windowKey);
    const outside = windowFrom != null && windowTo != null && (windowFrom < T0 || windowTo > T1);
    if (!newLife && zoomed && outside) {
      setView(clampView(full, { span, center: (windowFrom + windowTo) / 2 }));
    }
  }

  const zoomTo = (next: View | null) => setView(next && clampView(full, next));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    dragged.current = false;
    if (event.button !== 0 || !zoomed || (event.target as Element).closest('[data-minimap]')) {
      return;
    }
    drag.current = { x: event.clientX, center, span };
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (dragged.current) return;
    const target = event.target as Element;
    const minimap = target.closest('[data-minimap]');
    if (minimap) {
      const box = minimap.getBoundingClientRect();
      const share = box.width ? (event.clientX - box.left) / box.width : 0.5;
      zoomTo({ span, center: full.from + share * whole });
      return;
    }
    const id = target.closest('[data-id]')?.getAttribute('data-id');
    if (id) onSelect(id);
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
          if (inView(start)) {
            out.push(toMark(item, 'milestone', start, null, { top: 12, height: 8 }, dated));
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
        documents.length ? `${documents.length} documents before Track` : '',
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

  const actSegments = ACTS.flatMap((act, index) => {
    const start = time(act.inForce);
    if (start == null) return [];
    const end = time(ACTS[index + 1]?.inForce) ?? T1;
    if (!overlaps(start, end)) return [];
    return [{ act, index, start, end, onProject: model.acts.some((one) => one.year === act.year) }];
  });
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
  const windowStyle =
    hasWindow && overlaps(windowFrom, windowTo)
      ? vars({
          '--window-from': ((Math.max(windowFrom, T0) - T0) / span).toFixed(4),
          '--window-share': ((Math.min(windowTo, T1) - Math.max(windowFrom, T0)) / span).toFixed(4),
        })
      : null;

  const minimapPct = (at: number) =>
    `${(((Math.min(Math.max(at, full.from), full.to) - full.from) / whole) * 100).toFixed(2)}%`;
  const plannedDecisions = model.items.flatMap((item) => {
    const at = item.kind === 'work' ? time(item.plannedDecision) : null;
    return at == null ? [] : [at];
  });

  const statuses = new Set(
    model.items.flatMap((item) => (item.kind === 'work' ? [item.status] : [])),
  );
  const has = (kind: TimelineItem['kind']) => model.items.some((item) => item.kind === kind);
  const legend = [
    model.items.some((item) => hatchRange(item)) && ['undated', 'Not dated'],
    plannedDecisions.length > 0 && ['planned', 'Planned, to the planned decision'],
    plannedDecisions.length > 0 && ['planned-decision', 'Planned decision'],
    has('milestone') && ['milestone', 'Milestone'],
    model.transitions.some((one) => one.between?.from && one.between.to) && [
      'transition',
      'Transition happened in here',
    ],
    has('document') && ['document', 'Amendment document'],
    ...(Object.keys(WORK_STATUS_LABELS) as WorkStatus[]).map(
      (status) => statuses.has(status) && [`work--${status}`, WORK_STATUS_LABELS[status]],
    ),
    has('substantialStart') && ['decided', 'Substantial start (deadline hollow)'],
    has('proponent') && ['proponent', 'Proponent time'],
    model.items.some((item) => item.kind === 'certificate' && item.outcome === 'issued') && [
      'after-certificate',
      'After the certificate',
    ],
    ACTS.slice(1).some((act) => {
      const at = time(act.inForce);
      return at != null && at > full.from && at < full.to;
    }) && ['boundary', 'Act came into force'],
    ['today', 'Today'],
  ].filter((entry): entry is [string, string] => !!entry);

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
          {range}
        </span>
        <div className="timeline-lanes__controls">
          <p className="timeline-lanes__hint">
            {zoomed && 'Drag to pan · '}Ctrl or <span aria-hidden="true">⌘</span>
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
        className={`timeline-lanes__grid${zoomed ? ' timeline-lanes__grid--zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        {windowStyle && (
          <span
            className={`timeline-lanes__window${zoomed ? ' timeline-lanes__window--zoomed' : ''}`}
            style={windowStyle}
          />
        )}
        <p className="timeline-lanes__label">
          Legislation<span className="timeline-lanes__note">Act in force</span>
        </p>
        <div className="timeline-lanes__track timeline-lanes__track--acts">
          {actSegments.map(({ act, index, start, end, onProject }) => (
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
              {act.year} Act
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
        {zoomed && (
          <>
            <p className="timeline-lanes__note timeline-lanes__minimap-label">Whole life</p>
            <div className="timeline-lanes__minimap" data-minimap="" title="Click to move the view">
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
              />
            </div>
          </>
        )}
      </div>
      {/* Explains the hidden chart only, so it is hidden with it. */}
      <ul className="timeline-lanes__legend" aria-hidden="true">
        {legend.map(([swatch, label]) => (
          <li key={label} className="timeline-lanes__legend-item">
            <span className={`timeline-lanes__swatch timeline-lanes__swatch--${swatch}`} />
            {label}
          </li>
        ))}
      </ul>
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
