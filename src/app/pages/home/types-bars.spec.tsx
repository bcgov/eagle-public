import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { TypesBars, type TypesBarsProps } from './types-bars';
import { layoutTiles } from './types-layout';
import type { SubNode, TypeNode } from './types-tree';

const sub = (name: string, count: number): SubNode => ({ name, count, projects: [] });
const node = (name: string, subs: SubNode[]): TypeNode => ({
  name,
  count: subs.reduce((sum, s) => sum + s.count, 0),
  subs,
});

const TREE: TypeNode[] = [
  node('Mines', [sub('Coal Mines', 5), sub('Metal Mines', 3), sub('Other', 1)]),
  node('Energy', [sub('Hydro', 4), sub('Wind', 1)]),
  node('Other', [sub('Other', 2)]),
];

const hrefFor = (type: string, subType: string | null) =>
  `?${new URLSearchParams(subType ? { type, subType } : { type })}`;

function setup(props: Partial<TypesBarsProps> = {}) {
  const onHover = vi.fn();
  const utils = render(
    <MemoryRouter>
      <TypesBars
        tree={TREE}
        type={null}
        hover={null}
        onHover={onHover}
        hrefFor={hrefFor}
        {...props}
      />
    </MemoryRouter>,
  );
  return { ...utils, onHover, user: userEvent.setup() };
}

const rows = () => screen.getAllByRole('link');
const labels = (links: HTMLElement[]) => links.map((b) => b.getAttribute('aria-label'));
const hrefs = (links: HTMLElement[]) => links.map((b) => b.getAttribute('href'));
// Segments are aria-hidden decoration with no role or text to query by.
const segments = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('.home-types__bar-seg'));
const litSegments = (el: HTMLElement) =>
  segments(el).filter((s) => s.classList.contains('home-types__bar-seg--hover'));

describe('TypesBars', () => {
  it('links one row per type at the top level; a type with one sub-type opens on its projects', () => {
    setup();

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(labels(rows())).toEqual([
      'Mines, 9 projects. Show sub-types',
      'Energy, 5 projects. Show sub-types',
      'Other, 2 projects. Show projects',
    ]);
    expect(hrefs(rows())).toEqual(['/?type=Mines', '/?type=Energy', '/?type=Other']);
  });

  it('links only the chosen type’s sub-type rows, each to its projects', () => {
    setup({ type: 'Mines' });

    expect(labels(rows())).toEqual([
      'Coal Mines, 5 projects. Show projects',
      'Metal Mines, 3 projects. Show projects',
      'Other, 1 project. Show projects',
    ]);
    expect(hrefs(rows())).toEqual([
      '/?type=Mines&subType=Coal+Mines',
      '/?type=Mines&subType=Metal+Mines',
      '/?type=Mines&subType=Other',
    ]);
  });

  it('reports the treemap frame key while a type row is hovered, and null on leave', async () => {
    const { user, onHover } = setup();
    const row = screen.getByRole('link', { name: /^Energy,/ });

    await user.hover(row);
    expect(onHover).toHaveBeenLastCalledWith('f:Energy');
    expect(layoutTiles(TREE, null, null).frames.map((f) => f.key)).toContain('f:Energy');
    await user.unhover(row);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('reports the hover key on focus and null on blur', () => {
    const { onHover } = setup();
    const row = screen.getByRole('link', { name: /^Mines,/ });

    act(() => row.focus());
    expect(onHover).toHaveBeenLastCalledWith('f:Mines');
    act(() => row.blur());
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('uses the same keys as the treemap for sub-type rows', async () => {
    const { user, onHover } = setup({ type: 'Mines' });

    await user.hover(screen.getByRole('link', { name: /^Metal Mines,/ }));
    expect(onHover).toHaveBeenLastCalledWith('t:Mines:Metal Mines');
    expect(layoutTiles(TREE, 'Mines', null).tiles.map((t) => t.key)).toContain(
      't:Mines:Metal Mines',
    );
  });

  it('highlights the hovered type row and rings all of its segments', () => {
    const { container } = setup({ hover: 'f:Energy' });

    const lit = container.querySelectorAll('.home-types__bar-row--hover');
    expect(lit).toHaveLength(1);
    expect(lit[0]).toContainElement(screen.getByRole('link', { name: /^Energy,/ }));
    expect(litSegments(container)).toHaveLength(2);
  });

  it('highlights only the hovered sub-type row and its one segment at the type level', () => {
    const { container } = setup({ type: 'Mines', hover: 't:Mines:Metal Mines' });

    const lit = container.querySelectorAll('.home-types__bar-row--hover');
    expect(lit).toHaveLength(1);
    expect(lit[0]).toContainElement(screen.getByRole('link', { name: /^Metal Mines,/ }));
    expect(litSegments(container)).toHaveLength(1);
  });

  it('draws each row’s segments inside that row', () => {
    setup();

    const perRow = screen.getAllByRole('listitem').map((li) => segments(li).length);
    expect(perRow).toEqual([3, 2, 1]);
  });

  it('sets each lane’s fill to the right edge of its last stacked segment', () => {
    setup();

    // Lanes are aria-hidden decoration; read the CSS var the stylesheet draws from.
    const fills = screen
      .getAllByRole('listitem')
      .map((li) =>
        parseFloat(
          li.querySelector<HTMLElement>('.home-types__bar-lane')!.style.getPropertyValue('--fill'),
        ),
      );
    // Scaled to Mines (9): Mines 9/9, Energy 5/9, Other 2/9.
    expect(fills[0]).toBeCloseTo(100, 6);
    expect(fills[1]).toBeCloseTo(500 / 9, 6);
    expect(fills[2]).toBeCloseTo(200 / 9, 6);
  });

  it('draws one segment in each sub-type row', () => {
    setup({ type: 'Mines' });

    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => segments(li).length)).toEqual([1, 1, 1]);
    expect(within(items[0]).getByText('Coal Mines')).toBeInTheDocument();
  });
});
