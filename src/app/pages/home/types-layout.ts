import { rankOf, shade, ink, subRank, type SubNode, type TypeNode } from './types-tree';

/** Placeholder map box until the map is measured; tiles are drawn as percentages of the box. */
export const MAP_W = 141;
export const MAP_H = 100;
/** Drawn height of the map, px; once measured, the box is the map's width by this. */
export const MAP_PX_H = 380;
/** Below this share of the box a type is drawn whole, since its sub-tiles would be slivers. */
export const MIN_SPLIT_SHARE = 0.04;
/** Each bar row fades in this much after the one above it, ms. */
const ROW_STAGGER_MS = 60;

/** Hover and label-fit key for a type's frame; the bar list uses it too, so hover syncs both views. */
export const typeKey = (type: string): string => `f:${type}`;
/** Hover and label-fit key for a sub-type's tile. */
export const subKey = (type: string, subType: string): string => `t:${type}:${subType}`;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PctBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk): one rect per count, in input order, tiling the
 * W×H box with area proportional to count. Counts must be positive.
 */
export function squarify(counts: readonly number[], W: number, H: number): Rect[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  const scale = (W * H) / total;
  const out: Rect[] = [];
  let x = 0;
  let y = 0;
  let w = W;
  let h = H;

  interface Item {
    i: number;
    a: number;
  }
  const sumOf = (r: readonly Item[]) => r.reduce((sum, o) => sum + o.a, 0);
  // Worst aspect ratio in the row if laid along a side of length s.
  const worst = (r: readonly Item[], s: number) => {
    const sum = sumOf(r);
    const areas = r.map((o) => o.a);
    const mx = Math.max(...areas);
    const mn = Math.min(...areas);
    return Math.max((s * s * mx) / (sum * sum), (sum * sum) / (s * s * mn));
  };
  const place = (r: readonly Item[]) => {
    const sum = sumOf(r);
    if (w >= h) {
      const cw = sum / h;
      let cy = y;
      for (const o of r) {
        const oh = o.a / cw;
        out[o.i] = { x, y: cy, w: cw, h: oh };
        cy += oh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const o of r) {
        const ow = o.a / rh;
        out[o.i] = { x: cx, y, w: ow, h: rh };
        cx += ow;
      }
      y += rh;
      h -= rh;
    }
  };

  const rest: Item[] = counts.map((c, i) => ({ i, a: c * scale }));
  let row: Item[] = [];
  let k = 0;
  while (k < rest.length) {
    const s = Math.min(w, h);
    const next = rest[k];
    if (row.length === 0 || worst([...row, next], s) <= worst(row, s)) {
      row.push(next);
      k++;
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
}

/** Maps a rect so `frame` fills the whole W×H box. */
export function zoomTo(frame: Rect, W: number, H: number): (g: Rect) => Rect {
  const sx = W / frame.w;
  const sy = H / frame.h;
  return (g) => ({ x: (g.x - frame.x) * sx, y: (g.y - frame.y) * sy, w: g.w * sx, h: g.h * sy });
}

export function toPct(g: Rect, W = MAP_W, H = MAP_H): PctBox {
  return {
    left: `${(g.x / W) * 100}%`,
    top: `${(g.y / H) * 100}%`,
    width: `${(g.w / W) * 100}%`,
    height: `${(g.h / H) * 100}%`,
  };
}

/** A clickable type outline over its sub-tiles. */
export interface TypeFrame {
  key: string;
  type: string;
  count: number;
  rect: Rect;
  ink: string;
  /** Top level is showing, so the frame and its label are live. */
  active: boolean;
}

/** One sub-type's filled tile. */
export interface SubTile {
  key: string;
  type: string;
  subType: string;
  count: number;
  rect: Rect;
  fill: string;
  ink: string;
  /** Its type is the zoomed one, so the tile and its label are live. */
  active: boolean;
}

/** Resolves URL values against the tree; anything unknown falls back one level. */
function findLevel(tree: readonly TypeNode[], type: string | null, subType: string | null) {
  const sel = type === null ? undefined : tree.find((t) => t.name === type);
  const sub = sel && subType !== null ? sel.subs.find((s) => s.name === subType) : undefined;
  return { sel, sub };
}

/**
 * Treemap geometry at a level. Top: types squarified over the box, sub-tiles nested inside each;
 * a type under `MIN_SPLIT_SHARE` of the box stacks all its sub-tiles on its whole frame.
 * Type chosen: everything zooms through that type's rect, and its sub-types are laid out afresh
 * over the full box. Sub-type chosen: that layout zooms again through the sub-type's rect.
 * Pass the real W×H so tiles that are square in units are square on screen.
 */
export function layoutTiles(
  tree: readonly TypeNode[],
  type: string | null,
  subType: string | null,
  W = MAP_W,
  H = MAP_H,
): { frames: TypeFrame[]; tiles: SubTile[] } {
  const { sel, sub } = findLevel(tree, type, subType);
  const typeRects = squarify(
    tree.map((t) => t.count),
    W,
    H,
  );
  const zi = sel ? tree.indexOf(sel) : -1;
  const zoom = zoomTo(zi >= 0 ? typeRects[zi] : { x: 0, y: 0, w: W, h: H }, W, H);

  const frames: TypeFrame[] = [];
  const tiles: SubTile[] = [];
  tree.forEach((t, ti) => {
    const tg = typeRects[ti];
    const on = t === sel;
    const rank = rankOf(tree, t.name);
    const counts = t.subs.map((s) => s.count);
    let rects: Rect[];
    if (on) {
      rects = squarify(counts, W, H);
      if (sub) rects = rects.map(zoomTo(rects[t.subs.indexOf(sub)], W, H));
    } else if (tg.w * tg.h < MIN_SPLIT_SHARE * W * H) {
      rects = t.subs.map(() => zoom(tg));
    } else {
      rects = squarify(counts, tg.w, tg.h).map((g) =>
        zoom({ x: g.x + tg.x, y: g.y + tg.y, w: g.w, h: g.h }),
      );
    }
    t.subs.forEach((s, si) => {
      const tone = on ? subRank(s.name, si) : rank;
      tiles.push({
        key: subKey(t.name, s.name),
        type: t.name,
        subType: s.name,
        count: s.count,
        rect: rects[si],
        fill: shade(tone),
        ink: ink(tone),
        active: on,
      });
    });
    frames.push({
      key: typeKey(t.name),
      type: t.name,
      count: t.count,
      rect: zoom(tg),
      ink: ink(rank),
      active: !sel,
    });
  });
  return { frames, tiles };
}

/** One sub-type's slice of a row's bar. */
export interface BarSegment {
  key: string;
  type: string;
  subType: string;
  /** Percent of the bar track. */
  left: number;
  /** Percent of the bar track. */
  width: number;
  fill: string;
}

/** A name + count row in the bar list, with its bar. */
export interface BarRow {
  key: string;
  kind: 'type' | 'sub';
  type: string;
  subType: string | null;
  name: string;
  count: number;
  /** Swatch colour. */
  fill: string;
  /** What opening the row shows: a type with one sub-type skips straight to its projects. */
  opens: 'sub-types' | 'projects';
  /** Fade-in delay, ms. */
  delay: number;
  segments: BarSegment[];
}

/**
 * Bar list rows for the level showing. Top: one row per type, its bar split into sub-type
 * segments, all scaled to the largest type. Type chosen: one row per sub-type, scaled to its
 * largest sub-type. An unknown type falls back to the top level.
 */
export function layoutBars(tree: readonly TypeNode[], type: string | null): BarRow[] {
  const { sel } = findLevel(tree, type, null);
  const segment = (
    t: TypeNode,
    s: SubNode,
    left: number,
    width: number,
    fill: string,
  ): BarSegment => ({
    key: `s:${t.name}:${s.name}`,
    type: t.name,
    subType: s.name,
    left,
    width,
    fill,
  });

  if (sel) {
    const subMax = Math.max(0, ...sel.subs.map((s) => s.count));
    return sel.subs.map((s, si): BarRow => {
      const fill = shade(subRank(s.name, si));
      return {
        key: `r:${sel.name}:${s.name}`,
        kind: 'sub',
        type: sel.name,
        subType: s.name,
        name: s.name,
        count: s.count,
        fill,
        opens: 'projects',
        delay: ROW_STAGGER_MS * si,
        segments: [segment(sel, s, 0, (s.count / subMax) * 100, fill)],
      };
    });
  }

  const max = Math.max(0, ...tree.map((t) => t.count));
  return tree.map((t, ti): BarRow => {
    const fill = shade(rankOf(tree, t.name));
    let cum = 0;
    const segments = t.subs.map((s) => {
      const left = (cum / max) * 100;
      cum += s.count;
      return segment(t, s, left, (s.count / max) * 100, fill);
    });
    return {
      key: `r:${t.name}`,
      kind: 'type',
      type: t.name,
      subType: null,
      name: t.name,
      count: t.count,
      fill,
      opens: t.subs.length === 1 ? 'projects' : 'sub-types',
      delay: ROW_STAGGER_MS * ti,
      segments,
    };
  });
}
