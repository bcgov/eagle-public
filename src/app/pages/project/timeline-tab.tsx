import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { useMediaQuery } from 'app/state/responsive';
import { time, timelineHits } from './timeline-axis';
import { TimelineDetails } from './timeline-details';
import { TimelineLanes } from './timeline-lanes';
import { TimelineList, defaultExpandedIds } from './timeline-list';
import { TimelineSearch } from './timeline-search';
import { TimelineStrip } from './timeline-strip';
import type { PhaseListItem } from './assessment-stages';
import { useProjectContext } from './project-context';
import {
  useTimelineModel,
  type DateRange,
  type LaneId,
  type TimelineItem,
  type TimelineModel,
} from './use-timeline-model';
import './timeline-tab.css';

/** Same breakpoint the list switches to inline details at. */
const NARROW = '(max-width: 767.98px)';

type Filter = 'all' | LaneId;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'amendments', label: 'Amendments' },
  { id: 'other', label: 'Other work' },
];

/** Rows every filter keeps: they frame the rest. */
const ALWAYS_SHOWN = new Set<TimelineItem['kind']>(['band', 'transition', 'today']);

/** Ids of the items a work-type filter leaves out. A group stays while any child is in. */
function filteredOutIds(model: TimelineModel, filter: Filter): Set<string> {
  if (filter === 'all') return new Set();
  const laneOf = new Map(model.items.map((item) => [item.id, item.lane]));
  const kept = (item: TimelineItem) =>
    item.lane === null ||
    ALWAYS_SHOWN.has(item.kind) ||
    item.lane === filter ||
    (item.kind === 'group' && item.childIds.some((id) => laneOf.get(id) === filter));
  return new Set(model.items.filter((item) => !kept(item)).map((item) => item.id));
}

/**
 * Where an item's details link goes, or undefined where there is no in-app page for it. Documents
 * have none: their file URL is not a route, and the details panel links through the router.
 */
function timelineHref(
  item: TimelineItem,
  basePath: string,
  lists: readonly PhaseListItem[],
): string | undefined {
  switch (item.kind) {
    case 'work':
      return `${basePath}/documents/amendments`;
    case 'certificate':
      return `${basePath}/decisions`;
    case 'phase': {
      const name = item.title.toLowerCase();
      const phase = lists.find(
        (row) =>
          row.type === 'projectPhase' &&
          Number(row.legislation) === item.actYear &&
          row.name.toLowerCase() === name,
      );
      return phase
        ? `${basePath}/documents?${new URLSearchParams({ projectPhase: phase.id })}`
        : undefined;
    }
    default:
      return undefined;
  }
}

/** The dates the given rows cover, or null when none carries a date. */
function windowOf(items: TimelineItem[]): DateRange | null {
  const times = items.flatMap((item) =>
    [time(item.start), time(item.end)].filter((at): at is number => at != null),
  );
  if (!times.length) return null;
  return {
    from: new Date(Math.min(...times)).toISOString(),
    to: new Date(Math.max(...times)).toISOString(),
  };
}

/**
 * The dates of the list rows in view, so the lanes can box them. The list draws one `li` per row,
 * in `rows` order.
 */
function useListWindow(
  host: RefObject<HTMLDivElement | null>,
  rows: TimelineItem[],
  enabled: boolean,
): DateRange | null {
  const [range, setRange] = useState<DateRange | null>(null);
  useEffect(() => {
    const list = host.current?.querySelector('.timeline-list');
    if (!enabled || !list || typeof IntersectionObserver === 'undefined') return;
    const elements = [...list.children];
    const seen = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = elements.indexOf(entry.target);
          if (entry.isIntersecting) seen.add(index);
          else seen.delete(index);
        }
        const next = windowOf([...seen].flatMap((index) => rows[index] ?? []));
        setRange((previous) =>
          previous?.from === next?.from && previous?.to === next?.to ? previous : next,
        );
      },
      { root: list },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [host, rows, enabled]);
  return range;
}

export function TimelineTab() {
  const { projId } = useProjectContext();
  const model = useTimelineModel(projId);
  // Keyed by project: another project's open groups and filter mean nothing.
  return (
    <section className="timeline-tab">
      <h2 className="timeline-tab__title">Timeline</h2>
      {model ? (
        <TimelineCard key={projId} model={model} />
      ) : (
        <div className="timeline-tab__card" aria-busy="true">
          <span className="visually-hidden">Loading the timeline</span>
          <Skeleton width="60%" />
          <Skeleton height="12rem" />
        </div>
      )}
    </section>
  );
}

function TimelineCard({ model }: { model: TimelineModel }) {
  const { basePath, lists } = useProjectContext();
  const narrow = useMediaQuery(NARROW);
  const [searchParams, setSearchParams] = useSearchParams();
  // The search changes the query and selects its first hit in one event; each write builds on
  // the last, since the router's own updater reads the params of the last render.
  const pending = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    pending.current = null;
  });
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(pending.current ?? searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    pending.current = next;
    setSearchParams(next, { replace: true });
  };

  const byId = useMemo(() => new Map(model.items.map((item) => [item.id, item])), [model]);
  const asked = searchParams.get('item');
  const selectedId = asked && byId.has(asked) ? asked : model.defaultSelectedId;
  const query = searchParams.get('q') ?? '';

  const [expanded, setExpanded] = useState(() => new Set(defaultExpandedIds(model)));
  // Whatever selects a folded row (a click, the search, a link to ?item=), its parent opens.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (openedFor !== selectedId) {
    setOpenedFor(selectedId);
    const parent = selectedId ? byId.get(selectedId)?.parentId : undefined;
    if (parent && !expanded.has(parent)) setExpanded(new Set(expanded).add(parent));
  }
  const onExpand = (id: string, open: boolean) =>
    setExpanded((previous) => {
      if (previous.has(id) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const [filter, setFilter] = useState<Filter>('all');
  const hidden = useMemo(() => filteredOutIds(model, filter), [model, filter]);
  const listModel = useMemo(
    () =>
      hidden.size
        ? {
            ...model,
            items: model.items.flatMap((item): TimelineItem[] => {
              if (hidden.has(item.id)) return [];
              if (item.kind !== 'group') return [item];
              return [{ ...item, childIds: item.childIds.filter((id) => !hidden.has(id)) }];
            }),
          }
        : model,
    [model, hidden],
  );

  // A dimmed lane bar, a related link or a search hit can name a row the filter hides.
  const select = (id: string) => {
    if (hidden.has(id)) setFilter('all');
    setParam('item', id);
  };

  const matchIds = useMemo(() => new Set(timelineHits(model, query)), [model, query]);

  const listHost = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => listModel.items.filter((item) => !item.parentId || expanded.has(item.parentId)),
    [listModel, expanded],
  );
  const listWindow = useListWindow(listHost, rows, !narrow);

  const hrefFor = (item: TimelineItem) => timelineHref(item, basePath, lists);
  const details = (
    <TimelineDetails model={model} selectedId={selectedId} onSelect={select} hrefFor={hrefFor} />
  );

  return (
    <div className="timeline-tab__card">
      <div className="timeline-tab__header">
        <p className="timeline-tab__summary">{model.summary}</p>
        <div className="timeline-tab__filters" role="group" aria-label="Filter by work type">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="timeline-tab__filter"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <TimelineSearch
        model={model}
        query={query}
        onQueryChange={(value) => setParam('q', value)}
        onSelect={select}
      />
      {narrow ? (
        <TimelineStrip model={model} selectedId={selectedId} dimmedIds={hidden} />
      ) : (
        <TimelineLanes
          model={model}
          selectedId={selectedId}
          onSelect={select}
          dimmedIds={hidden}
          listWindow={listWindow}
        />
      )}
      <div className="timeline-tab__body" ref={listHost}>
        <TimelineList
          model={listModel}
          selectedId={selectedId}
          onSelect={select}
          expandedIds={expanded}
          onExpand={onExpand}
          matchIds={matchIds}
          details={details}
        />
        {!narrow && details}
      </div>
    </div>
  );
}
