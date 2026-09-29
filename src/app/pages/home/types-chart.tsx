import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMediaQuery } from 'app/state/responsive';
import { projectsLabel, shade, type TypeNode, type SubNode } from './types-tree';
import { TypesBreadcrumb, type TypesCrumb } from './types-breadcrumb';
import { TypesTreemap } from './types-treemap';
import { TypesBars } from './types-bars';
import { TypesProjectTable } from './types-project-table';
import { useTypeLevel } from './use-type-level';
import { useLabelFit } from './use-label-fit';

export interface TypesChartProps {
  tree: readonly TypeNode[];
  total: number;
}

const HINT =
  'Select a type in the map or the list to see its sub-types, then a sub-type to see its projects.';

/** What the status region reads out after a level change; the focused crumb already says the name. */
function announce(sel: TypeNode | undefined, trailSub: SubNode | undefined, total: number): string {
  if (trailSub) return projectsLabel(trailSub.count);
  if (!sel) return projectsLabel(total);
  if (sel.subs.length === 1) return projectsLabel(sel.count);
  return `${sel.subs.length} sub-types, ${projectsLabel(sel.count)}`;
}

/** Treemap, bar list or project table for the level the address names, with its trail and totals. */
export function TypesChart({ tree, total }: TypesChartProps) {
  const { type, subType, setLevel, hrefFor } = useTypeLevel(tree);
  const sel = tree.find((t) => t.name === type);
  // A type with one sub-type has no middle level to show, so it opens on its projects.
  const single = sel?.subs.length === 1;
  const sub = sel && (single ? sel.subs[0] : sel.subs.find((s) => s.name === subType));
  // The sub-type the trail shows as its own level; a lone sub-type is its type.
  const trailSub = single ? undefined : sub;
  const levelKey = JSON.stringify([sel?.name ?? null, sub?.name ?? null]);

  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const mapRef = useRef<HTMLDivElement>(null);
  const { mapWidth, overflowing } = useLabelFit(mapRef, levelKey, reduced);

  // Tied to the level it was set at, so any level change (a click, Back, a crumb) clears it.
  const [hoverAt, setHoverAt] = useState<{ level: string; key: string | null }>({
    level: levelKey,
    key: null,
  });
  const hover = hoverAt.level === levelKey ? hoverAt.key : null;
  const onHover = (key: string | null) => setHoverAt({ level: levelKey, key });

  const currentRef = useRef<HTMLSpanElement>(null);
  // Compared, not flagged: StrictMode re-runs the effect on mount, and that must not steal focus.
  const prevLevel = useRef(levelKey);
  useEffect(() => {
    if (prevLevel.current === levelKey) return;
    prevLevel.current = levelKey;
    const frame = requestAnimationFrame(() => currentRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [levelKey]);

  const crumbs: TypesCrumb[] = [{ name: 'All types', href: hrefFor(null) }];
  if (sel) crumbs.push({ name: sel.name, href: hrefFor(sel.name) });
  if (trailSub) crumbs.push({ name: trailSub.name });

  // The deepest level the trail names: what the count and the Search link describe.
  const focus = trailSub ?? sel;
  let searchHref = '';
  if (sel) {
    const query = new URLSearchParams({ record: 'projects', type: sel.name });
    if (trailSub) query.set('sector', trailSub.name);
    searchHref = `/search?${query}`;
  }

  return (
    <div className="home-types__chart">
      <div className="home-types__head">
        <TypesBreadcrumb crumbs={crumbs} currentRef={currentRef} />
        <span className="home-types__count">{projectsLabel(focus?.count ?? total)}</span>
      </div>
      <p className="visually-hidden" role="status">
        {announce(sel, trailSub, total)}
      </p>

      <TypesTreemap
        tree={tree}
        type={sel?.name ?? null}
        subType={sub?.name ?? null}
        hover={hover}
        overflowing={overflowing}
        mapWidth={mapWidth}
        onHover={onHover}
        onSelect={setLevel}
        mapRef={mapRef}
      />

      {sel && sub ? (
        // Keyed on the level so a new sub-type starts with an empty filter.
        <TypesProjectTable key={levelKey} sub={sub} fill={shade(sel.subs.indexOf(sub))} />
      ) : (
        <TypesBars
          tree={tree}
          type={sel?.name ?? null}
          hover={hover}
          onHover={onHover}
          hrefFor={hrefFor}
        />
      )}

      <p className="home-types__foot">
        {focus ? (
          <Link to={searchHref}>
            See all {focus.count} {focus.name} projects in Search
          </Link>
        ) : (
          HINT
        )}
      </p>
    </div>
  );
}
