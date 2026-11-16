/* eslint-disable react-refresh/only-export-components -- the row text helpers live with the rows;
   the details panel reads the same text. */
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useMediaQuery } from 'app/state/responsive';
import { POST_DECISION_ROW, stageSetFor } from './assessment-stages';
import { WORK_STATUS_LABELS, dayMonthYear, days, time, todayOf } from './timeline-axis';
import type {
  CertificateItem,
  PhaseItem,
  ProponentItem,
  SubstantialStartItem,
  TimelineItem,
  TimelineModel,
  WorkStatus,
} from './use-timeline-model';
import './timeline-list.css';

/** Below this width the list drops its date column and opens details inline. */
export const NARROW = '(max-width: 767.98px)';

type ChipTone = 'success' | 'closed' | 'withdrawn' | 'danger' | 'info' | 'warning';

interface Chip {
  label: string;
  tone: ChipTone;
}

/** Chip tone and gutter icon for each work status. */
const WORK_STATUS_MARKS: Record<WorkStatus, { tone: ChipTone; icon: string }> = {
  completed: { tone: 'success', icon: 'check' },
  closed: { tone: 'closed', icon: 'block' },
  withdrawn: { tone: 'withdrawn', icon: 'undo' },
  terminated: { tone: 'danger', icon: 'close' },
  inProgress: { tone: 'info', icon: 'more_horiz' },
  suspended: { tone: 'warning', icon: 'pause' },
};

const CERTIFICATE_CHIPS: Record<CertificateItem['outcome'], Chip> = {
  issued: { label: 'Issued', tone: 'success' },
  refused: { label: 'Refused', tone: 'danger' },
  terminated: { label: 'Terminated', tone: 'danger' },
};

const SUBSTANTIAL_START_TONES: Record<SubstantialStartItem['outcome'], ChipTone> = {
  'Substantially started': 'success',
  'Not substantially started': 'danger',
  'Not yet decided': 'info',
};

/** "15 Mar 2027", or empty for no date. */
export function dayDate(iso: string | null | undefined): string {
  const at = time(iso);
  return at == null ? '' : dayMonthYear(at);
}

/** "49 days", "12 months", "2.2 years". */
export function duration(total: number): string {
  if (total < 75) return `${total} ${total === 1 ? 'day' : 'days'}`;
  if (total < 730) return `${Math.round(total / 30.44)} months`;
  return `${(total / 365.25).toFixed(1).replace('.0', '')} years`;
}

/** The duration between two dates, or empty when either is missing. */
export function span(from: string | null, to: string | number | null): string {
  const start = time(from);
  const end = typeof to === 'number' ? to : time(to);
  return start == null || end == null ? '' : duration(days(start, end));
}

export function TimelineChip({ chip }: { chip: Chip }) {
  return <span className={`timeline-chip timeline-chip--${chip.tone}`}>{chip.label}</span>;
}

/** A dated phase's dates: "a – b", "Since a" while it runs, or "a" with no end recorded. */
export function phaseRange(item: PhaseItem | ProponentItem): string {
  if (item.status === 'current') return `Since ${dayDate(item.start)}`;
  return [dayDate(item.start), dayDate(item.end)].filter(Boolean).join(' – ');
}

/** The chip an item carries; an issued certificate shows its chip in the details only. */
export function chipOf(item: TimelineItem, inDetails = false): Chip | null {
  if (item.kind === 'work') {
    return { label: WORK_STATUS_LABELS[item.status], tone: WORK_STATUS_MARKS[item.status].tone };
  }
  if (item.kind === 'substantialStart') {
    return { label: item.outcome, tone: SUBSTANTIAL_START_TONES[item.outcome] };
  }
  if (item.kind === 'certificate' && (inDetails || item.outcome !== 'issued')) {
    return CERTIFICATE_CHIPS[item.outcome];
  }
  return null;
}

/** The row title; Today carries its date. */
export function titleOf(item: TimelineItem): string {
  return item.kind === 'today' ? `Today, ${dayDate(item.start)}` : item.title;
}

/** The text of the date column. */
export function whenOf(item: TimelineItem): string {
  switch (item.kind) {
    case 'band':
      return item.actName;
    case 'history':
      return 'Not dated';
    case 'phase':
      return item.status === 'undated' ? (item.parentId ? '' : 'Not dated') : dayDate(item.start);
    case 'proponent':
      return '';
    case 'transition':
      return item.transition.date ? dayDate(item.transition.date) : 'Not dated';
    case 'substantialStart':
      return dayDate(item.decided ?? item.deadline);
    case 'today':
      return 'Today';
    default:
      return dayDate(item.start);
  }
}

/** The meta line under a row's title. */
export function metaOf(item: TimelineItem, model: TimelineModel): string {
  const today = todayOf(model);
  switch (item.kind) {
    case 'band': {
      const phases = stageSetFor(item.actYear).filter((row) => row.name !== POST_DECISION_ROW);
      return `${item.phasesUsed} of ${phases.length} assessment phases`;
    }
    case 'history':
      return `${item.childIds.length} phases, not dated · ${item.datedMilestones} dated milestones`;
    case 'phase': {
      if (item.status === 'undated') {
        if (item.parentId) return 'Not dated';
        const number = stageSetFor(item.actYear ?? 0).findIndex((r) => r.name === item.row?.name);
        return number < 0
          ? 'No dates recorded'
          : `Phase ${number + 1} of the ${item.actYear} Act · no dates recorded`;
      }
      const length =
        item.status === 'current'
          ? `${span(item.start, today)} so far`
          : span(item.start, item.end);
      const end = item.status === 'current' && item.end && `planned to end ${dayDate(item.end)}`;
      return [item.status === 'planned' && 'Planned', phaseRange(item), length, end]
        .filter(Boolean)
        .join(' · ');
    }
    case 'proponent': {
      const length =
        item.status === 'current' ? `${span(item.start, today)} so far` : duration(item.days);
      return [
        item.status === 'planned' && 'Planned',
        'Proponent time',
        `${length}${item.beforePhase ? ` before ${item.beforePhase}` : ''}`,
        'EAO’s clock paused',
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'milestone':
      return item.actYear ? `${item.actYear} Act milestone` : 'Milestone';
    case 'transition': {
      const { date, between } = item.transition;
      if (date) return `Date: ${dayDate(date)}`;
      return between?.from && between.to
        ? `Date: Not recorded · between ${dayDate(between.from)} and ${dayDate(between.to)}`
        : 'Date: Not recorded';
    }
    case 'document':
      return 'Document posted · before Track';
    case 'certificate': {
      const act = `under the ${item.actYear} Act`;
      const inForce = span(item.start, today);
      const tail =
        item.outcome === 'issued'
          ? inForce && ` · in force ${inForce}`
          : !item.branch && model.items.some((one) => one.kind === 'branchStart')
            ? ' · a second assessment followed'
            : '';
      return item.branch
        ? `Second assessment · ${act}${tail}`
        : `Under the ${item.actYear} Act${tail}`;
    }
    case 'branchStart':
      return `Under the ${item.actYear} Act`;
    case 'work': {
      const type = item.title.startsWith(item.workType) ? '' : `${item.workType} · `;
      const dates = item.end
        ? `${dayDate(item.start)} → ${dayDate(item.end)} · ${span(item.start, item.end)}`
        : `${span(item.start, today)} so far${item.plannedDecision ? ` · decision planned ${dayDate(item.plannedDecision)}` : ''}`;
      const noDecision =
        item.status === 'closed' && item.endedWithoutDecision ? ' · Ended with no decision' : '';
      return type + dates + noDecision;
    }
    case 'substantialStart':
      if (!item.deadline) return `Decided ${dayDate(item.decided)}`;
      return `Deadline ${dayDate(item.deadline)} · ${item.decided ? `decided ${dayDate(item.decided)}` : 'not yet decided'}`;
    case 'group':
      return item.childIds
        .map((id) => model.items.find((one) => one.id === id)?.title)
        .filter(Boolean)
        .join(' · ');
    case 'today':
      return `Current stage: ${item.currentStage ?? 'Not recorded'}${item.openWorks ? ` · ${item.openWorks} in progress` : ''}`;
  }
}

/** Groups that start open, to seed the expanded set. */
export function defaultExpandedIds(model: TimelineModel): string[] {
  return model.items.flatMap((item) =>
    item.kind === 'group' && item.defaultOpen ? [item.id] : [],
  );
}

type Line = { fill: string; width: 'phase' | 'proponent' | 'thin' } | 'undated' | null;

const POST_CERTIFICATE: Line = { fill: 'var(--eao-amendment-dark, #a6bb2e)', width: 'phase' };
const THIN: Line = { fill: 'var(--theme-gray-50)', width: 'thin' };

function phaseFill(item: TimelineItem | undefined): Line {
  if (item?.kind !== 'phase') return null;
  if (item.status === 'undated') return 'undated';
  return { fill: fillOf(item.row), width: 'phase' };
}

function fillOf(row: PhaseItem['row']): string {
  return row ? `var(${row.token}, ${row.hex})` : 'var(--theme-gray-60)';
}

/** The life line a row leaves below it, or `undefined` when the row does not change it. */
function lineAfter(item: TimelineItem, items: TimelineItem[]): Line | undefined {
  switch (item.kind) {
    case 'phase':
      return phaseFill(item);
    case 'proponent':
      return { fill: 'var(--eao-proponent-dark, #6d7274)', width: 'proponent' };
    case 'history':
      return 'undated';
    case 'certificate':
      return item.outcome === 'issued' ? POST_CERTIFICATE : THIN;
    case 'branchStart':
      return phaseFill(items.find((one) => one.branch && one.kind === 'phase'));
    case 'today':
      return null;
    default:
      return undefined;
  }
}

interface Gutter {
  main: [Line, Line];
  branch: [Line, Line];
}

/** Top and bottom half of each row's main and branch lines, in row order. */
function guttersOf(rows: TimelineItem[]): Gutter[] {
  let main: Line = null;
  let branch: Line = null;
  return rows.map((item) => {
    const after = lineAfter(item, rows);
    const gutter: Gutter = { main: [main, main], branch: [branch, branch] };
    if (item.kind === 'today') {
      gutter.main[1] = null;
      gutter.branch[1] = null;
    } else if (after !== undefined && item.branch) {
      gutter.branch[1] = branch = after;
    } else if (after !== undefined) {
      gutter.main[1] = main = after;
    }
    return gutter;
  });
}

/** The branch start's ring takes the colour of the first phase on its line. */
function nodeFill(item: TimelineItem, gutter: Gutter): CSSProperties | undefined {
  const line = gutter.branch[1];
  return item.kind === 'branchStart' && line && line !== 'undated'
    ? ({ '--node-fill': line.fill } as CSSProperties)
    : undefined;
}

function LineHalf({ line, half, track }: { line: Line; half: 'top' | 'bottom'; track: string }) {
  if (!line) return null;
  const style = line === 'undated' ? undefined : ({ '--line-fill': line.fill } as CSSProperties);
  const width = line === 'undated' ? 'undated' : line.width;
  return (
    <span
      className={`timeline-line timeline-line--${half} timeline-line--${track} timeline-line--${width}`}
      style={style}
    />
  );
}

/** The gutter mark of a row. */
function TimelineNode({ item }: { item: TimelineItem }) {
  const icon = (name: string) => <i className="material-icons">{name}</i>;
  switch (item.kind) {
    case 'phase':
      if (item.status === 'undated') {
        return (
          <span
            className={`timeline-node timeline-node--undated${item.parentId ? ' timeline-node--small' : ''}`}
          />
        );
      }
      return (
        <span
          className="timeline-node timeline-node--phase"
          style={{ '--node-fill': fillOf(item.row) } as CSSProperties}
        />
      );
    case 'proponent':
      return <span className="timeline-node timeline-node--proponent" />;
    case 'certificate':
      return item.outcome === 'issued' ? (
        <span className="timeline-node timeline-node--certificate">{icon('verified_user')}</span>
      ) : (
        <span className="timeline-node timeline-node--refused">{icon('close')}</span>
      );
    case 'work':
      return (
        <span className={`timeline-node timeline-node--work timeline-node--${item.status}`}>
          {icon(WORK_STATUS_MARKS[item.status].icon)}
        </span>
      );
    case 'group':
      return <span className="timeline-node timeline-node--group">{item.childIds.length}</span>;
    case 'history':
      return <span className="timeline-node timeline-node--history">{item.childIds.length}</span>;
    case 'band':
      return <span className="timeline-node timeline-node--square">{icon('gavel')}</span>;
    case 'transition':
      return <span className="timeline-node timeline-node--square">{icon('sync_alt')}</span>;
    case 'substantialStart':
      return (
        <span
          className={`timeline-node timeline-node--diamond${item.decided ? '' : ' timeline-node--open'}${item.outcome === 'Not substantially started' ? ' timeline-node--danger' : ''}`}
        />
      );
    case 'branchStart':
      return <span className="timeline-node timeline-node--branch" />;
    case 'milestone':
      return <span className="timeline-node timeline-node--milestone" />;
    case 'document':
      return <span className="timeline-node timeline-node--document">{icon('description')}</span>;
    case 'today':
      return <span className="timeline-node timeline-node--today" />;
  }
}

const MINOR_KINDS = new Set<TimelineItem['kind']>(['proponent', 'milestone']);

export interface TimelineListProps {
  model: TimelineModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Open history and same-day group rows. */
  expandedIds: ReadonlySet<string>;
  onExpand: (id: string, open: boolean) => void;
  /** Rows that match the search, outlined. */
  matchIds?: ReadonlySet<string>;
  /** The details of the selected row, drawn inline under it on a narrow screen. */
  details: ReactNode;
}

/** The vertical timeline, oldest first, with a life line and a node per row. */
export function TimelineList({
  model,
  selectedId,
  onSelect,
  expandedIds,
  onExpand,
  matchIds,
  details,
}: TimelineListProps) {
  const narrow = useMediaQuery(NARROW);
  const list = useRef<HTMLOListElement>(null);
  // On a narrow screen a second tap on the selected row folds its details away.
  const [folded, setFolded] = useState<string | null>(null);
  const [foldedFor, setFoldedFor] = useState(selectedId);
  if (foldedFor !== selectedId) {
    setFoldedFor(selectedId);
    setFolded(null);
  }
  const rows = model.items.filter((item) => !item.parentId || expandedIds.has(item.parentId));
  const gutters = guttersOf(rows);
  // One row in the Tab order: the selected one, else the first; arrows move between the rest.
  const focusIndex = Math.max(
    rows.findIndex((item) => item.id === selectedId),
    0,
  );
  const branched = rows.some((item) => item.branch);

  // A selected row out of view is centred in the list, or, when the list does not scroll (narrow),
  // brought onto the page. Runs until the row exists, which may be after its parent expands.
  const scrolledTo = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (scrolledTo.current === selectedId) return;
    const box = list.current;
    const row = box?.querySelector<HTMLElement>('.timeline-list__row--selected');
    if (!box || !row) return;
    const first = scrolledTo.current === undefined;
    scrolledTo.current = selectedId;
    if (box.scrollHeight <= box.clientHeight) {
      if (!first) row.scrollIntoView({ block: 'nearest' });
      return;
    }
    const above = row.offsetTop < box.scrollTop;
    const below = row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight;
    if (above || below) {
      box.scrollTop = Math.max(0, row.offsetTop - (box.clientHeight - row.offsetHeight) / 2);
    }
  });

  const focusRow = (index: number) =>
    list.current?.querySelectorAll<HTMLButtonElement>('.timeline-list__button')[index]?.focus();

  const onKeyDown = (event: KeyboardEvent, index: number, item: TimelineItem) => {
    const expandable = item.kind === 'history' || item.kind === 'group';
    const to = {
      ArrowDown: Math.min(index + 1, rows.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: rows.length - 1,
    }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      focusRow(to);
    } else if (expandable && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      onExpand(item.id, event.key === 'ArrowRight');
    }
  };

  const pick = (item: TimelineItem) => {
    const selected = item.id === selectedId;
    if (item.kind === 'history' || item.kind === 'group') {
      onExpand(item.id, selected ? !expandedIds.has(item.id) : true);
    } else {
      setFolded(narrow && selected && folded !== item.id ? item.id : null);
    }
    onSelect(item.id);
  };
  const selectedItem = model.items.find((item) => item.id === selectedId);

  return (
    <>
      <ol
        ref={list}
        className={`timeline-list${branched ? ' timeline-list--branched' : ''}${narrow ? ' timeline-list--narrow' : ''}`}
        aria-label="Timeline, oldest first"
      >
        {rows.map((item, index) => {
          const selected = item.id === selectedId;
          const expandable = item.kind === 'history' || item.kind === 'group';
          const inline = narrow && selected && !expandable && folded !== item.id;
          const when = whenOf(item);
          const meta = metaOf(item, model);
          const chip = chipOf(item);
          const minor =
            MINOR_KINDS.has(item.kind) ||
            (item.kind === 'phase' && item.status === 'undated' && !!item.parentId);
          const shownMeta =
            narrow &&
            when &&
            !['band', 'phase', 'today'].includes(item.kind) &&
            !meta.startsWith(when)
              ? `${when} · ${meta}`
              : narrow && item.kind === 'phase' && item.status === 'undated' && !item.parentId
                ? `Not dated · ${meta}`
                : meta;
          const gutter = gutters[index];
          const rowClass = [
            'timeline-list__row',
            `timeline-list__row--${item.kind}`,
            minor && 'timeline-list__row--minor',
            item.parentId && 'timeline-list__row--child',
            selected && 'timeline-list__row--selected',
            matchIds?.has(item.id) && 'timeline-list__row--match',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={item.id}
              data-id={item.id}
              aria-current={item.kind === 'today' ? 'date' : undefined}
            >
              <div className={rowClass}>
                {!narrow && (
                  <span
                    className={`timeline-list__when${when === 'Not dated' || item.kind === 'band' ? ' timeline-list__when--strong' : ''}`}
                  >
                    {when}
                  </span>
                )}
                <span className="timeline-list__gutter" aria-hidden="true">
                  <LineHalf line={gutter.main[0]} half="top" track="main" />
                  <LineHalf line={gutter.main[1]} half="bottom" track="main" />
                  <LineHalf line={gutter.branch[0]} half="top" track="branch" />
                  <LineHalf line={gutter.branch[1]} half="bottom" track="branch" />
                  {item.kind === 'branchStart' && <span className="timeline-line--connector" />}
                  <span
                    className={`timeline-list__node timeline-list__node--${item.branch ? 'branch' : 'main'}`}
                    style={nodeFill(item, gutter)}
                  >
                    <TimelineNode item={item} />
                  </span>
                </span>
                <button
                  type="button"
                  className="timeline-list__button"
                  aria-pressed={expandable || narrow ? undefined : selected}
                  tabIndex={index === focusIndex ? 0 : -1}
                  aria-expanded={
                    expandable ? expandedIds.has(item.id) : narrow ? inline : undefined
                  }
                  onClick={() => pick(item)}
                  onKeyDown={(event) => onKeyDown(event, index, item)}
                >
                  <span className="timeline-list__text">
                    <span className="timeline-list__title">{titleOf(item)}</span>
                    {!narrow && when && item.kind !== 'today' && (
                      <span className="visually-hidden">, {when}</span>
                    )}
                    {meta && (
                      <span className="timeline-list__meta">
                        <span className="visually-hidden">, </span>
                        {shownMeta}
                      </span>
                    )}
                  </span>
                  {chip && <TimelineChip chip={chip} />}
                  {matchIds?.has(item.id) && (
                    <span className="visually-hidden">, matches search</span>
                  )}
                  {(expandable || narrow) && (
                    <i className="material-icons timeline-list__caret" aria-hidden="true">
                      {(expandable ? expandedIds.has(item.id) : inline)
                        ? 'expand_less'
                        : 'expand_more'}
                    </i>
                  )}
                </button>
              </div>
              {inline && <div className="timeline-list__inline">{details}</div>}
            </li>
          );
        })}
      </ol>
      {/* Mounted with the list, not the details, which remount under each row on a narrow screen. */}
      <span role="status" className="visually-hidden">
        {selectedItem ? titleOf(selectedItem) : ''}
      </span>
    </>
  );
}
