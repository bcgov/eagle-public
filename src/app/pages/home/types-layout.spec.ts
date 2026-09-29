import { describe, it, expect } from 'vitest';
import {
  MAP_H,
  MAP_W,
  MIN_SPLIT_SHARE,
  layoutBars,
  layoutTiles,
  squarify,
  toPct,
  zoomTo,
  type BarRow,
  type Rect,
} from './types-layout';
import type { TypeNode } from './types-tree';

const EPS = 1e-9;
const NONE: Rect = { x: NaN, y: NaN, w: NaN, h: NaN };
const area = (r: Rect) => r.w * r.h;
const totalArea = (rects: readonly Rect[]) => rects.reduce((sum, r) => sum + area(r), 0);
const outOfBounds = (rects: readonly Rect[], W: number, H: number) =>
  rects.filter((r) => r.x < -EPS || r.y < -EPS || r.x + r.w > W + EPS || r.y + r.h > H + EPS);
const overlapping = (rects: readonly Rect[]) =>
  rects.flatMap((a, i) =>
    rects.slice(i + 1).flatMap((b, j) => {
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return dx > EPS && dy > EPS ? [[i, i + 1 + j]] : [];
    }),
  );
const rounded = (r: Rect) => ({
  x: +r.x.toFixed(6),
  y: +r.y.toFixed(6),
  w: +r.w.toFixed(6),
  h: +r.h.toFixed(6),
});

const node = (name: string, subs: [string, number][]): TypeNode => ({
  name,
  count: subs.reduce((sum, [, c]) => sum + c, 0),
  subs: subs.map(([subName, count]) => ({ name: subName, count, projects: [] })),
});

// Already in buildTypeTree order: count desc, Other last.
const TREE: TypeNode[] = [
  node('Mines', [
    ['Mineral Mines', 6],
    ['Coal Mines', 3],
    ['Other', 1],
  ]),
  node('Transportation', [
    ['Public Highways', 4],
    ['Railways', 2],
  ]),
  node('Other', [['Other', 4]]),
];

describe('squarify', () => {
  // Worked example from Bruls, Huizing and van Wijk, "Squarified Treemaps" (2000), fig. 3.
  it('lays out the paper example: first column of two, then a row of two along the top', () => {
    const rects = squarify([6, 6, 4, 3, 2, 2, 1], 6, 4);
    expect(rects.slice(0, 4).map(rounded)).toEqual([
      { x: 0, y: 0, w: 3, h: 2 },
      { x: 0, y: 2, w: 3, h: 2 },
      rounded({ x: 3, y: 0, w: 12 / 7, h: 7 / 3 }),
      rounded({ x: 3 + 12 / 7, y: 0, w: 9 / 7, h: 7 / 3 }),
    ]);
  });

  it.each([
    ['wide', 141, 100],
    ['tall', 60, 200],
  ])('covers a %s box exactly, in bounds, with no overlaps', (_label, W, H) => {
    const rects = squarify([38, 29, 14, 7, 4, 1], W, H);
    expect(Math.abs(totalArea(rects) - W * H)).toBeLessThan(EPS * W * H);
    expect(outOfBounds(rects, W, H)).toEqual([]);
    expect(overlapping(rects)).toEqual([]);
  });

  it('keeps input order and gives each rect area in proportion to its count', () => {
    const rects = squarify([1, 5, 2], 8, 1);
    expect(rects.map((r) => +area(r).toFixed(9))).toEqual([1, 5, 2]);
  });

  it('gives a single item the whole box', () => {
    expect(squarify([7], MAP_W, MAP_H)).toEqual([{ x: 0, y: 0, w: MAP_W, h: MAP_H }]);
  });

  it('places the first row along the top of a tall box', () => {
    const [first] = squarify([1, 1], 1, 4);
    expect(first).toEqual({ x: 0, y: 0, w: 1, h: 2 });
  });
});

describe('zoomTo', () => {
  it('maps the frame itself to the full box', () => {
    const frame = { x: 12, y: 30, w: 40, h: 25 };
    expect(rounded(zoomTo(frame, MAP_W, MAP_H)(frame))).toEqual({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  });

  it('scales and shifts other rects by the same factors', () => {
    const zoom = zoomTo({ x: 10, y: 20, w: 50, h: 25 }, 100, 100);
    expect(zoom({ x: 35, y: 20, w: 25, h: 25 })).toEqual({ x: 50, y: 0, w: 50, h: 100 });
  });
});

describe('toPct', () => {
  it('turns map units into percentage offsets', () => {
    expect(toPct({ x: 70.5, y: 25, w: 14.1, h: 50 })).toEqual({
      left: '50%',
      top: '25%',
      width: '10%',
      height: '50%',
    });
  });
});

describe('layoutTiles', () => {
  const byKey = <T extends { key: string }>(items: readonly T[], key: string) =>
    items.find((i) => i.key === key);

  it('at the top level, frames tile the box and are live; sub-tiles take their type colour', () => {
    const { frames, tiles } = layoutTiles(TREE, null, null);
    expect(frames.map((f) => f.active)).toEqual([true, true, true]);
    expect(Math.abs(totalArea(frames.map((f) => f.rect)) - MAP_W * MAP_H)).toBeLessThan(1e-6);
    expect(tiles.map((t) => t.active)).toEqual([false, false, false, false, false, false]);
    expect(byKey(tiles, 't:Transportation:Railways')?.fill).toBe('var(--theme-blue-90)');
    expect(byKey(tiles, 't:Other:Other')?.fill).toBe('var(--theme-gray-40)');
  });

  it('nests each type’s sub-tiles inside its frame', () => {
    const { frames, tiles } = layoutTiles(TREE, null, null);
    const mines = byKey(frames, 'f:Mines')?.rect ?? NONE;
    const minesTiles = tiles.filter((t) => t.type === 'Mines').map((t) => t.rect);
    expect(Math.abs(totalArea(minesTiles) - area(mines))).toBeLessThan(1e-6);
    expect(
      minesTiles.map((r) => rounded({ x: r.x - mines.x, y: r.y - mines.y, w: r.w, h: r.h })),
    ).toEqual(squarify([6, 3, 1], mines.w, mines.h).map(rounded));
  });

  it('with a type chosen, its frame fills the box and its sub-types are laid out afresh with ranked shades', () => {
    const { frames, tiles } = layoutTiles(TREE, 'Mines', null);
    expect(rounded(byKey(frames, 'f:Mines')?.rect ?? NONE)).toEqual({
      x: 0,
      y: 0,
      w: MAP_W,
      h: MAP_H,
    });
    expect(frames.map((f) => f.active)).toEqual([false, false, false]);
    const mines = tiles.filter((t) => t.type === 'Mines');
    expect(mines.map((t) => t.rect)).toEqual(squarify([6, 3, 1], MAP_W, MAP_H));
    expect(mines.map((t) => [t.active, t.fill, t.ink])).toEqual([
      [true, 'var(--theme-blue-100)', 'var(--theme-gray-white)'],
      [true, 'var(--theme-blue-90)', 'var(--theme-gray-white)'],
      [true, 'var(--theme-blue-80)', 'var(--theme-gray-white)'],
    ]);
    expect(byKey(tiles, 't:Transportation:Railways')?.active).toBe(false);
  });

  it('with a sub-type chosen, that tile fills the box', () => {
    const { tiles } = layoutTiles(TREE, 'Mines', 'Coal Mines');
    expect(rounded(byKey(tiles, 't:Mines:Coal Mines')?.rect ?? NONE)).toEqual({
      x: 0,
      y: 0,
      w: MAP_W,
      h: MAP_H,
    });
  });

  it('treats an unknown type as the top level and an unknown sub-type as the type level', () => {
    expect(layoutTiles(TREE, 'Bogus', null)).toEqual(layoutTiles(TREE, null, null));
    expect(layoutTiles(TREE, 'Mines', 'Bogus')).toEqual(layoutTiles(TREE, 'Mines', null));
  });

  describe('in the real map box', () => {
    // A desktop map, px.
    const PX_W = 1232;
    const PX_H = 380;
    // The shape of the live project list: nine types, sub-type counts in order.
    const LIVE: TypeNode[] = [
      [53, 33, 18, 4],
      [89, 8],
      [22, 19, 16, 1],
      [18, 14, 6, 5],
      [7, 6, 3, 3, 2],
      [6, 5, 3],
      [9, 3, 1],
      [7, 3, 1],
      [5],
    ].map((counts, ti) =>
      node(
        `Type ${ti}`,
        counts.map((c, si): [string, number] => [`Sub ${si}`, c]),
      ),
    );
    /** Worst long-side to short-side ratio of the rects as drawn on the PX_W×PX_H map. */
    const worstOnScreen = (rects: readonly Rect[], W: number, H: number) =>
      Math.max(
        ...rects.map((r) => {
          const w = (r.w / W) * PX_W;
          const h = (r.h / H) * PX_H;
          return Math.max(w / h, h / w);
        }),
      );

    it('draws squarer frames and sub-tiles than the placeholder box stretched to the same map', () => {
      const unit = layoutTiles(LIVE, null, null);
      const real = layoutTiles(LIVE, null, null, PX_W, PX_H);
      const framesAt = (l: typeof unit, W: number, H: number) =>
        worstOnScreen(
          l.frames.map((f) => f.rect),
          W,
          H,
        );
      const tilesAt = (l: typeof unit, W: number, H: number) =>
        worstOnScreen(
          l.tiles.map((t) => t.rect),
          W,
          H,
        );

      expect(framesAt(unit, MAP_W, MAP_H)).toBeGreaterThan(6);
      expect(framesAt(real, PX_W, PX_H)).toBeLessThan(3);
      expect(tilesAt(real, PX_W, PX_H)).toBeLessThan(tilesAt(unit, MAP_W, MAP_H) / 1.5);
    });

    it.each([
      ['desktop', PX_W],
      ['phone', 358],
    ])('tiles the real %s box exactly, every sub-tile inside it', (_label, W) => {
      const { frames, tiles } = layoutTiles(LIVE, null, null, W, PX_H);
      const rects = frames.map((f) => f.rect);
      expect(Math.abs(totalArea(rects) - W * PX_H)).toBeLessThan(1e-6 * W * PX_H);
      expect(outOfBounds(rects, W, PX_H)).toEqual([]);
      expect(
        outOfBounds(
          tiles.map((t) => t.rect),
          W,
          PX_H,
        ),
      ).toEqual([]);
    });
  });

  describe('a type under the split threshold', () => {
    // Small is 3 of 100 projects, under MIN_SPLIT_SHARE of the box.
    const SPLIT_TREE: TypeNode[] = [
      node('Big', [
        ['Big A', 60],
        ['Big B', 37],
      ]),
      node('Small', [
        ['Small A', 1],
        ['Small B', 1],
        ['Small C', 1],
      ]),
    ];

    it('stacks its sub-tiles on its whole frame in its own colour; larger types still split', () => {
      expect(3 / 100).toBeLessThan(MIN_SPLIT_SHARE);
      const { frames, tiles } = layoutTiles(SPLIT_TREE, null, null);
      const small = byKey(frames, 'f:Small')?.rect;
      const smallTiles = tiles.filter((t) => t.type === 'Small');

      expect(smallTiles.map((t) => t.rect)).toEqual([small, small, small]);
      expect(smallTiles.map((t) => t.fill)).toEqual(Array(3).fill('var(--theme-blue-90)'));
      const bigTiles = tiles.filter((t) => t.type === 'Big').map((t) => t.rect);
      expect(bigTiles[0]).not.toEqual(bigTiles[1]);
    });

    it('lays its sub-types out afresh once it is chosen', () => {
      const { tiles } = layoutTiles(SPLIT_TREE, 'Small', null);
      expect(tiles.filter((t) => t.type === 'Small').map((t) => t.rect)).toEqual(
        squarify([1, 1, 1], MAP_W, MAP_H),
      );
    });
  });
});

describe('layoutBars', () => {
  const bar = (row: BarRow | undefined) =>
    row?.segments.map((s) => [s.key, +s.left.toFixed(4), +s.width.toFixed(4)]);

  it('at the top level, one staggered row per type, its bar split by sub-type and scaled to the largest type', () => {
    const rows = layoutBars(TREE, null);
    expect(rows.map((r) => [r.kind, r.name, r.count, r.delay])).toEqual([
      ['type', 'Mines', 10, 0],
      ['type', 'Transportation', 6, 60],
      ['type', 'Other', 4, 120],
    ]);
    expect(bar(rows[0])).toEqual([
      ['s:Mines:Mineral Mines', 0, 60],
      ['s:Mines:Coal Mines', 60, 30],
      ['s:Mines:Other', 90, 10],
    ]);
    expect(bar(rows[1])).toEqual([
      ['s:Transportation:Public Highways', 0, 40],
      ['s:Transportation:Railways', 40, 20],
    ]);
  });

  it('opens a type with one sub-type on its projects', () => {
    expect(layoutBars(TREE, null).map((r) => [r.name, r.opens])).toEqual([
      ['Mines', 'sub-types'],
      ['Transportation', 'sub-types'],
      ['Other', 'projects'],
    ]);
  });

  it('with a type chosen, one row per sub-type, each bar scaled to its largest sub-type', () => {
    const rows = layoutBars(TREE, 'Mines');
    expect(rows.map((r) => [r.kind, r.name, r.subType, r.opens, r.delay])).toEqual([
      ['sub', 'Mineral Mines', 'Mineral Mines', 'projects', 0],
      ['sub', 'Coal Mines', 'Coal Mines', 'projects', 60],
      ['sub', 'Other', 'Other', 'projects', 120],
    ]);
    expect(rows.map(bar)).toEqual([
      [['s:Mines:Mineral Mines', 0, 100]],
      [['s:Mines:Coal Mines', 0, 50]],
      [['s:Mines:Other', 0, 16.6667]],
    ]);
  });

  it('treats an unknown type as the top level', () => {
    expect(layoutBars(TREE, 'Bogus')).toEqual(layoutBars(TREE, null));
  });

  it('scales to the largest count even when Other is largest', () => {
    const tree = [node('Mines', [['Coal Mines', 2]]), node('Other', [['Other', 8]])];
    expect(layoutBars(tree, null).map((r) => r.segments[0].width)).toEqual([25, 100]);
  });
});
