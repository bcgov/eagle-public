import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type Ref,
} from 'react';
import { layoutTiles, toPct, MAP_H, MAP_PX_H, MAP_W } from './types-layout';
import { projectsLabel, type TypeNode } from './types-tree';
import './types-treemap.css';

export interface TypesTreemapProps {
  tree: readonly TypeNode[];
  type: string | null;
  subType: string | null;
  /** Key of the tile or frame to ring (`f:<type>` or `t:<type>:<sub>`). */
  hover: string | null;
  /** Keys whose label does not fit its tile. */
  overflowing: ReadonlySet<string>;
  /** Measured map width, px; 0 until the first measure. */
  mapWidth: number;
  onHover: (key: string | null) => void;
  onSelect: (type: string, subType: string | null) => void;
  mapRef: Ref<HTMLDivElement>;
}

/** Gap between the pointer and the tip, px. */
const TIP_OFFSET = 12;

const cls = (...names: (string | false)[]) => names.filter(Boolean).join(' ');

interface Point {
  clientX: number;
  clientY: number;
}

/** Puts the tip beside the pointer, flipped to the other side where it would leave the map. */
function placeTip(tip: HTMLDivElement | null, at: Point | null) {
  const map = tip?.parentElement;
  if (!tip || !map || !at) return;
  const box = map.getBoundingClientRect();
  let x = at.clientX - box.left + TIP_OFFSET;
  let y = at.clientY - box.top + TIP_OFFSET;
  if (x + tip.offsetWidth > box.width) x -= tip.offsetWidth + 2 * TIP_OFFSET;
  if (y + tip.offsetHeight > box.height) y -= tip.offsetHeight + 2 * TIP_OFFSET;
  tip.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
}

/** The zoomable treemap: sub-type fills with type frames on top. Pointer only and hidden from assistive tech; the bar list is the accessible path. */
export function TypesTreemap({
  tree,
  type,
  subType,
  hover,
  overflowing,
  mapWidth,
  onHover,
  onSelect,
  mapRef,
}: TypesTreemapProps) {
  const measured = mapWidth > 0;
  const W = measured ? mapWidth : MAP_W;
  const H = measured ? MAP_PX_H : MAP_H;
  const { frames, tiles } = useMemo(
    () => layoutTiles(tree, type, subType, W, H),
    [tree, type, subType, W, H],
  );
  const hidden = subType !== null;
  // Labels stay in the DOM and only fade, so hiding one never changes what the fit check measures.
  const labelled = (active: boolean, key: string) => active && measured && !overflowing.has(key);

  // The key under the pointer, tied to the level it was entered at so a zoom clears it.
  const level = `${type}\n${subType}`;
  const [pointer, setPointer] = useState<{ key: string; level: string } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hints = new Map<string, string>();
  for (const t of tiles) {
    if (t.active && !labelled(t.active, t.key)) {
      hints.set(t.key, `${t.subType} · ${projectsLabel(t.count)}`);
    }
  }
  for (const f of frames) {
    if (f.active && !labelled(f.active, f.key)) {
      hints.set(f.key, `${f.type} · ${projectsLabel(f.count)}`);
    }
  }
  const hint = pointer?.level === level ? hints.get(pointer.key) : undefined;
  // Kept after the pointer leaves, so the tip fades out with its text.
  const [lastHint, setLastHint] = useState('');
  if (hint !== undefined && hint !== lastHint) setLastHint(hint);

  const lastPoint = useRef<Point | null>(null);
  const track = (e: MouseEvent) => {
    lastPoint.current = { clientX: e.clientX, clientY: e.clientY };
    placeTip(tipRef.current, lastPoint.current);
  };
  // Placed again once the new text is in, since the flip needs the tip's own width.
  useLayoutEffect(() => {
    if (hint !== undefined) placeTip(tipRef.current, lastPoint.current);
  }, [hint]);

  const pointerProps = (key: string) => ({
    onMouseEnter: (e: MouseEvent) => {
      onHover(key);
      setPointer({ key, level });
      track(e);
    },
    onMouseMove: track,
    onMouseLeave: () => {
      onHover(null);
      setPointer(null);
    },
  });

  return (
    <div
      ref={mapRef}
      className={cls('home-types__map', hidden && 'home-types__map--hidden')}
      style={{ '--home-types-map-h': `${MAP_PX_H}px` } as CSSProperties}
      aria-hidden="true"
      inert={hidden}
    >
      {/* Remounted on the first measure, so tiles appear in the real box instead of sliding out of the placeholder. */}
      <Fragment key={measured ? 'measured' : 'placeholder'}>
        {tiles.map((t) => (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut in an aria-hidden map; the bar list links are the keyboard path
          <div
            key={t.key}
            data-fit={t.key}
            className={cls(
              'home-types__tile',
              t.active && 'home-types__tile--active',
              labelled(t.active, t.key) && 'home-types__tile--labelled',
              hover === t.key && 'home-types__tile--hover',
            )}
            style={{ ...toPct(t.rect, W, H), backgroundColor: t.fill, color: t.ink }}
            onClick={() => {
              if (t.active) onSelect(t.type, t.subType);
            }}
            {...pointerProps(t.key)}
          >
            <span className="home-types__tile-name">{t.subType}</span>
            <span className="home-types__tile-count">{t.count}</span>
          </div>
        ))}
        {frames.map((f) => (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut in an aria-hidden map; the bar list links are the keyboard path
          <div
            key={f.key}
            data-fit={f.key}
            className={cls(
              'home-types__frame',
              f.active && 'home-types__frame--active',
              labelled(f.active, f.key) && 'home-types__tile--labelled',
              hover === f.key && 'home-types__tile--hover',
            )}
            style={{ ...toPct(f.rect, W, H), color: f.ink }}
            onClick={() => {
              if (f.active) onSelect(f.type, null);
            }}
            {...pointerProps(f.key)}
          >
            <span className="home-types__frame-name">{f.type}</span>
            <span className="home-types__tile-count">{f.count}</span>
          </div>
        ))}
      </Fragment>
      <div
        ref={tipRef}
        className={cls('home-types__tip', hint !== undefined && 'home-types__tip--shown')}
        aria-hidden="true"
      >
        {hint ?? lastHint}
      </div>
    </div>
  );
}
