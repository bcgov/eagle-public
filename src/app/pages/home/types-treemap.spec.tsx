import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypesTreemap, type TypesTreemapProps } from './types-treemap';
import type { TypeNode } from './types-tree';

const sub = (name: string, count: number) => ({ name, count, projects: [] });

const TREE: TypeNode[] = [
  { name: 'Mines', count: 5, subs: [sub('Mineral Mines', 3), sub('Coal Mines', 2)] },
  { name: 'Energy - Electricity', count: 3, subs: [sub('Hydro', 3)] },
  { name: 'Other', count: 1, subs: [sub('Other', 1)] },
];

const LABELLED = 'home-types__tile--labelled';
const HOVER = 'home-types__tile--hover';
const TIP_SHOWN = 'home-types__tip--shown';

function renderMap(props: Partial<TypesTreemapProps> = {}) {
  const onSelect = vi.fn();
  const onHover = vi.fn();
  const mapRef = createRef<HTMLDivElement>();
  const view = render(
    <TypesTreemap
      tree={TREE}
      type={null}
      subType={null}
      hover={null}
      overflowing={new Set()}
      mapWidth={800}
      onHover={onHover}
      onSelect={onSelect}
      mapRef={mapRef}
      {...props}
    />,
  );
  return { onSelect, onHover, mapRef, rerender: view.rerender };
}

// The map is aria-hidden and pointer only, so its tiles have no role or name; find them by key.
const frame = (type: string) => document.querySelector<HTMLElement>(`[data-fit="f:${type}"]`)!;
const tile = (type: string, subType: string) =>
  document.querySelector<HTMLElement>(`[data-fit="t:${type}:${subType}"]`)!;
const tip = () => document.querySelector<HTMLElement>('.home-types__tip')!;

describe('TypesTreemap', () => {
  it('draws one tile per sub-type and one frame per type, with its name and count', () => {
    const { mapRef } = renderMap();

    const texts = (selector: string) =>
      Array.from(mapRef.current?.querySelectorAll(selector) ?? []).map((el) => el.textContent);
    expect(texts('.home-types__tile')).toEqual([
      'Mineral Mines3',
      'Coal Mines2',
      'Hydro3',
      'Other1',
    ]);
    expect(texts('.home-types__frame')).toEqual(['Mines5', 'Energy - Electricity3', 'Other1']);
  });

  it('leaves the native tooltip off, so it never doubles the custom one', () => {
    const { mapRef } = renderMap();

    expect(mapRef.current?.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('offers nothing to assistive tech or the keyboard', () => {
    const { mapRef } = renderMap({ type: 'Mines' });

    expect(mapRef.current).toHaveAttribute('aria-hidden', 'true');
    expect(mapRef.current?.querySelectorAll('button, [tabindex], [aria-label]')).toHaveLength(0);
  });

  it('shows type labels at the top level, but not sub-type labels', () => {
    renderMap();

    expect(frame('Mines')).toHaveClass(LABELLED);
    expect(tile('Mines', 'Mineral Mines')).not.toHaveClass(LABELLED);
  });

  it('hides the label of a tile whose text overflows', () => {
    renderMap({ overflowing: new Set(['f:Energy - Electricity']) });

    expect(frame('Energy - Electricity')).not.toHaveClass(LABELLED);
    expect(frame('Mines')).toHaveClass(LABELLED);
  });

  it('hides every label before the map has been measured', () => {
    renderMap({ mapWidth: 0 });

    expect(frame('Mines')).not.toHaveClass(LABELLED);
  });

  it('shows the chosen type’s sub-type labels and drops the type labels', () => {
    renderMap({ type: 'Mines' });

    expect(tile('Mines', 'Mineral Mines')).toHaveClass(LABELLED);
    expect(tile('Energy - Electricity', 'Hydro')).not.toHaveClass(LABELLED);
    expect(frame('Mines')).not.toHaveClass(LABELLED);
  });

  it('rings only the hovered key', () => {
    renderMap({ type: 'Mines', hover: 't:Mines:Coal Mines' });

    expect(tile('Mines', 'Coal Mines')).toHaveClass(HOVER);
    expect(tile('Mines', 'Mineral Mines')).not.toHaveClass(HOVER);
  });

  it('reports the key under the pointer, and null when it leaves', async () => {
    const user = userEvent.setup();
    const { onHover } = renderMap();

    await user.hover(frame('Mines'));
    expect(onHover).toHaveBeenLastCalledWith('f:Mines');
    await user.unhover(frame('Mines'));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('names a hovered frame whose label is hidden in the tip, and hides the tip on leave', async () => {
    const user = userEvent.setup();
    renderMap({ overflowing: new Set(['f:Energy - Electricity']) });
    expect(tip()).not.toHaveClass(TIP_SHOWN);

    await user.hover(frame('Energy - Electricity'));
    expect(tip()).toHaveClass(TIP_SHOWN);
    expect(tip()).toHaveTextContent('Energy - Electricity · 3 projects');

    await user.unhover(frame('Energy - Electricity'));
    expect(tip()).not.toHaveClass(TIP_SHOWN);
  });

  it('names a hovered sub-type tile whose label is hidden, with a singular count', async () => {
    const user = userEvent.setup();
    const tree: TypeNode[] = [
      { name: 'Mines', count: 4, subs: [sub('Mineral Mines', 3), sub('Gravel', 1)] },
    ];
    renderMap({ tree, type: 'Mines', overflowing: new Set(['t:Mines:Gravel']) });

    await user.hover(tile('Mines', 'Gravel'));

    expect(tip()).toHaveClass(TIP_SHOWN);
    expect(tip()).toHaveTextContent('Gravel · 1 project');
  });

  it('flips the tip left of the pointer by its new text’s width near the right edge', () => {
    const { mapRef } = renderMap({ overflowing: new Set(['f:Energy - Electricity']) });
    // jsdom lays nothing out: a 400×380 map, and a tip 8px wide per character.
    vi.spyOn(mapRef.current!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 380));
    Object.defineProperty(tip(), 'offsetWidth', {
      configurable: true,
      get: () => (tip().textContent?.length ?? 0) * 8,
    });

    // Enter alone, no move after it: the tip must still flip by the text it is about to show.
    fireEvent.mouseEnter(frame('Energy - Electricity'), { clientX: 380, clientY: 20 });

    const width = 'Energy - Electricity · 3 projects'.length * 8;
    expect(tip().style.transform).toBe(`translate(${380 + 12 - width - 24}px, 32px)`);
  });

  it('shows no tip over a tile that carries its own label', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.hover(frame('Mines'));

    expect(frame('Mines')).toHaveClass(LABELLED);
    expect(tip()).not.toHaveClass(TIP_SHOWN);
  });

  it('drops the tip when the level changes under the pointer', async () => {
    const user = userEvent.setup();
    const { rerender, onHover, onSelect, mapRef } = renderMap({
      overflowing: new Set(['f:Energy - Electricity']),
    });
    await user.hover(frame('Energy - Electricity'));
    expect(tip()).toHaveClass(TIP_SHOWN);

    rerender(
      <TypesTreemap
        tree={TREE}
        type="Energy - Electricity"
        subType={null}
        hover={null}
        overflowing={new Set(['t:Energy - Electricity:Hydro'])}
        mapWidth={800}
        onHover={onHover}
        onSelect={onSelect}
        mapRef={mapRef}
      />,
    );

    expect(tip()).not.toHaveClass(TIP_SHOWN);
  });

  it('selects a type from its frame at the top level', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap();

    await user.click(frame('Energy - Electricity'));

    expect(onSelect).toHaveBeenCalledWith('Energy - Electricity', null);
  });

  it('selects a sub-type from its tile at the type level', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap({ type: 'Mines' });

    await user.click(tile('Mines', 'Coal Mines'));

    expect(onSelect).toHaveBeenCalledWith('Mines', 'Coal Mines');
  });

  it('ignores clicks on frames once a type is chosen', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMap({ type: 'Mines' });

    await user.click(frame('Energy - Electricity'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('leaves the tab order to the bar list', async () => {
    const user = userEvent.setup();
    renderMap({ type: 'Mines' });

    await user.tab();

    expect(document.body).toHaveFocus();
  });

  it('takes pointer input at the type level', () => {
    const { mapRef } = renderMap({ type: 'Mines' });

    expect(mapRef.current).not.toHaveAttribute('inert');
  });

  it('takes no input and folds away at the project level', () => {
    const { mapRef } = renderMap({ type: 'Mines', subType: 'Coal Mines' });

    expect(mapRef.current).toHaveAttribute('aria-hidden', 'true');
    expect(mapRef.current).toHaveAttribute('inert');
    expect(mapRef.current).toHaveClass('home-types__map--hidden');
  });
});
