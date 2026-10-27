import type { CSSProperties, ReactNode } from 'react';
import { fullRange, packRows, phaseFill, time, todayOf, workEnd } from './timeline-axis';
import type { BandItem, TimelineItem, TimelineModel, WorkItem } from './use-timeline-model';
import './timeline-strip.css';

const TRACK_TOP = 28;
const BRANCH_TOP = 42;
const ROW_STEP = 8;

export interface TimelineStripProps {
  model: TimelineModel;
  selectedId: string | null;
  /** Items the filters or search leave out; drawn faded, not removed. */
  dimmedIds?: ReadonlySet<string>;
}

interface Mark {
  item: TimelineItem;
  from: number;
  /** Null for a point mark, centred on `from`. */
  to: number | null;
  top: number;
  className: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Ids the mark stands for besides its own item. */
  covers?: string[];
}

function spanOf(from: string | null | undefined, to: string | null | undefined) {
  const start = time(from);
  const end = time(to);
  return start != null && end != null && end > start ? { start, end } : null;
}

const percent = (ratio: number) => `${(ratio * 100).toFixed(3)}%`;

/** Where `value` falls inside `from`..`to`, for a part drawn inside its mark; `whenEmpty` for a 0-long mark. */
const share = (value: number, from: number, to: number, whenEmpty = 1) =>
  percent(to > from ? (value - from) / (to - from) : whenEmpty);

/** The whole life at a glance for narrow screens. Decorative: the list below is the accessible path. */
export function TimelineStrip({ model, selectedId, dimmedIds }: TimelineStripProps) {
  const { items } = model;
  const today = todayOf(model);
  const { from: first, to: last } = fullRange(model);
  const range = last - first;
  const pct = (value: number) => percent((value - first) / range);
  // A 2px floor keeps one-day phases and same-day works visible on a 30-year strip.
  const widthOf = (from: number, to: number) => `max(2px, ${percent((to - from) / range)})`;

  const hasBranch = items.some((item) => item.branch);
  const worksTop = hasBranch ? BRANCH_TOP + 14 : BRANCH_TOP;
  const works = items
    .filter((item): item is WorkItem => item.kind === 'work')
    .sort((a, b) => (time(a.start) ?? today) - (time(b.start) ?? today));
  const rows = new Map(packRows(works, today).map(({ work, row }) => [work.id, row]));
  const rowCount = Math.max(0, ...rows.values()) + 1;
  const height = worksTop + (works.length ? rowCount * ROW_STEP : 4) + 6;

  const marks: Mark[] = [];
  // One hatch stands for every undated row of its Act, so selecting any of them rings it.
  const undatedByAct = new Map<number | null, string[]>();
  for (const item of items) {
    if (item.kind === 'history' || (item.kind === 'phase' && item.start == null)) {
      undatedByAct.set(item.actYear, [...(undatedByAct.get(item.actYear) ?? []), item.id]);
    }
  }
  const hatchedActs = new Set<number | null>();
  const hatch = (
    item: TimelineItem,
    from: string | null | undefined,
    to: string | null | undefined,
  ) => {
    const span = spanOf(from, to);
    if (!span) return;
    hatchedActs.add(item.actYear);
    marks.push({
      item,
      from: span.start,
      to: span.end,
      top: item.branch ? BRANCH_TOP : TRACK_TOP,
      className: 'timeline-strip__undated',
      covers: undatedByAct.get(item.actYear),
    });
  };

  for (const item of items) {
    const trackTop = item.branch ? BRANCH_TOP : TRACK_TOP;
    const start = time(item.start);
    switch (item.kind) {
      case 'phase': {
        if (start != null) {
          marks.push({
            item,
            from: start,
            to: Math.max(start, time(item.end) ?? today),
            top: trackTop,
            className: 'timeline-strip__phase',
            style: { background: phaseFill(item) },
          });
        } else if (!item.parentId && !hatchedActs.has(item.actYear)) {
          hatch(item, item.knownRange?.from, item.knownRange?.to);
        }
        break;
      }
      case 'history':
        hatch(item, item.knownRange?.from, item.knownRange?.to);
        break;
      case 'transition': {
        const span = spanOf(item.transition.between?.from, item.transition.between?.to);
        if (start == null && span) {
          marks.push({
            item,
            from: span.start,
            to: span.end,
            top: trackTop - 3,
            className: 'timeline-strip__transition',
          });
        }
        break;
      }
      case 'branchStart':
        if (start != null) {
          marks.push({
            item,
            from: start,
            to: null,
            top: TRACK_TOP + 3,
            className: 'timeline-strip__hook',
          });
        }
        break;
      case 'certificate':
        if (start != null) {
          const issued = item.outcome === 'issued';
          // A first assessment that ended keeps the main line running thin while the second one goes on.
          const line = issued || (hasBranch && !item.branch);
          marks.push({
            item,
            from: start,
            to: line ? Math.max(start, today) : start,
            top: trackTop - 2,
            className: 'timeline-strip__certificate',
            children: (
              <>
                {line && (
                  <span
                    className={`timeline-strip__certificate-line${issued ? '' : ' timeline-strip__certificate-line--thin'}`}
                  />
                )}
                <span
                  className={`timeline-strip__certificate-dot${issued ? '' : ' timeline-strip__certificate-dot--stopped'}`}
                />
              </>
            ),
          });
        }
        break;
      case 'work': {
        const from = start ?? today;
        const end = Math.max(workEnd(item, today), from);
        const solidEnd = item.open ? Math.min(Math.max(today, from), end) : end;
        const notStarted = item.open && from > today;
        marks.push({
          item,
          from,
          to: end,
          top: worksTop + (rows.get(item.id) ?? 0) * ROW_STEP,
          className: 'timeline-strip__work',
          children: (
            <>
              <span
                className={`timeline-strip__work-fill timeline-strip__work-fill--${item.status}`}
                style={{ width: share(solidEnd, from, end, notStarted ? 0 : 1) }}
              />
              {end > solidEnd && (
                <span
                  className="timeline-strip__planned"
                  style={{ left: share(solidEnd, from, end) }}
                />
              )}
            </>
          ),
        });
        break;
      }
      case 'document':
        if (start != null) {
          marks.push({
            item,
            from: start,
            to: null,
            top: worksTop - 1,
            className: 'timeline-strip__document',
          });
        }
        break;
      case 'substantialStart': {
        const deadline = time(item.deadline);
        const decided = time(item.decided);
        const at = [deadline, decided].filter((value): value is number => value != null);
        if (!at.length) break;
        const from = Math.min(...at);
        const to = Math.max(...at);
        marks.push({
          item,
          from,
          to,
          top: worksTop - 1,
          className: 'timeline-strip__substantial-start',
          children: (
            <>
              {deadline != null && (
                <span
                  className="timeline-strip__diamond timeline-strip__diamond--deadline"
                  style={{ left: share(deadline, from, to, 0) }}
                />
              )}
              {decided != null && (
                <span
                  className={`timeline-strip__diamond${item.outcome === 'Not substantially started' ? ' timeline-strip__diamond--refused' : ''}`}
                  style={{ left: share(decided, from, to, 0) }}
                />
              )}
            </>
          ),
        });
        break;
      }
    }
  }

  const bands = items
    .filter((item): item is BandItem => item.kind === 'band')
    .map((item) => ({ item, start: Math.max(time(item.start) ?? first, first) }))
    .sort((a, b) => a.start - b.start)
    .map((band, i, all) => ({ ...band, end: all[i + 1]?.start ?? last }))
    .filter((band) => band.end > band.start);

  const todayRatio = (today - first) / range;
  const todayLabel: CSSProperties =
    todayRatio > 0.85
      ? { right: 0 }
      : todayRatio < 0.15
        ? { left: 0 }
        : { left: pct(today), transform: 'translateX(-50%)' };

  return (
    <div className="timeline-strip" aria-hidden="true">
      <div className="timeline-strip__box" style={{ height }}>
        {bands.map(({ item, start, end }, i) => (
          <span
            key={item.id}
            data-item={item.id}
            className={`timeline-strip__act${i % 2 ? ' timeline-strip__act--alt' : ''}`}
            style={{ left: pct(start), width: percent((end - start) / range) }}
          >
            {item.actName.replace(' Act', '')}
          </span>
        ))}
        {marks.map(({ item, from, to, top, className, style, children, covers = [] }) => {
          const ids = [item.id, ...covers];
          const classes = [className];
          if (to == null) classes.push('timeline-strip__point');
          if (selectedId != null && ids.includes(selectedId)) classes.push('is-selected');
          if (dimmedIds && ids.every((id) => dimmedIds.has(id))) classes.push('is-dimmed');
          return (
            <span
              key={item.id}
              data-item={item.id}
              className={classes.join(' ')}
              style={{
                ...style,
                left: pct(from),
                top,
                ...(to != null && { width: widthOf(from, to) }),
              }}
            >
              {children}
            </span>
          );
        })}
        <span className="timeline-strip__today" style={{ left: pct(today) }} />
      </div>
      <div className="timeline-strip__labels">
        {todayRatio >= 0.15 && <span>{new Date(first).getUTCFullYear()}</span>}
        <span className="timeline-strip__today-label" style={todayLabel}>
          Today
        </span>
      </div>
    </div>
  );
}
