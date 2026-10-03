import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import type { TypeNode } from './types-tree';
import { useTypeLevel } from './use-type-level';

const TREE: TypeNode[] = [
  {
    name: 'Mines',
    count: 3,
    subs: [
      { name: 'Coal Mines', count: 2, projects: [] },
      { name: 'Mineral Mines', count: 1, projects: [] },
    ],
  },
  {
    name: 'Energy-Petroleum & Natural Gas',
    count: 1,
    subs: [{ name: 'Oil & Gas Pipelines', count: 1, projects: [] }],
  },
];

/** The hook plus the address and how the router got there, so push and replace tell apart. */
function renderLevel(initial: string, tree: TypeNode[] | null = TREE) {
  function wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [initial] }, children);
  }
  return renderHook(
    () => ({
      level: useTypeLevel(tree),
      search: useLocation().search,
      navigation: useNavigationType(),
    }),
    { wrapper },
  );
}

describe('useTypeLevel', () => {
  it('reads a type and sub-type the tree holds', () => {
    const { result } = renderLevel('/?type=Mines&subType=Coal%20Mines');

    expect(result.current.level).toMatchObject({ type: 'Mines', subType: 'Coal Mines' });
  });

  it("reads a sub-type in any case as the tree's spelling", () => {
    const { result } = renderLevel('/?type=Mines&subType=coal%20MINES');

    expect(result.current.level).toMatchObject({ type: 'Mines', subType: 'Coal Mines' });
  });

  it('reads as no level for a type the tree does not hold', () => {
    const { result } = renderLevel('/?type=Bogus&subType=Coal%20Mines');

    expect(result.current.level).toMatchObject({ type: null, subType: null });
  });

  it('reads as the type alone for a sub-type that type does not hold', () => {
    // "Oil & Gas Pipelines" exists, but under another type.
    const { result } = renderLevel('/?type=Mines&subType=Oil%20%26%20Gas%20Pipelines');

    expect(result.current.level).toMatchObject({ type: 'Mines', subType: null });
  });

  it('passes the raw values through while the tree loads', () => {
    const { result } = renderLevel('/?type=Bogus&subType=Nope', null);

    expect(result.current.level).toMatchObject({ type: 'Bogus', subType: 'Nope' });
  });

  it('reads no level from an address without the keys', () => {
    const { result } = renderLevel('/');

    expect(result.current.level).toMatchObject({ type: null, subType: null });
  });

  it('pushes a new history entry and keeps the other params', () => {
    const { result } = renderLevel('/?keywords=lng');

    act(() => result.current.level.setLevel('Mines'));

    expect(result.current.navigation).toBe('PUSH');
    const params = new URLSearchParams(result.current.search);
    expect(params.get('type')).toBe('Mines');
    expect(params.get('keywords')).toBe('lng');
    expect(params.has('subType')).toBe(false);
  });

  it('drops the empty keys on the way back up', () => {
    const { result } = renderLevel('/?type=Mines&subType=Coal%20Mines&keywords=lng');

    act(() => result.current.level.setLevel('Mines', null));
    expect(new URLSearchParams(result.current.search).has('subType')).toBe(false);

    act(() => result.current.level.setLevel(null, null));
    expect(result.current.search).toBe('?keywords=lng');
    expect(result.current.level).toMatchObject({ type: null, subType: null });
  });

  it('round-trips a type name with a hyphen, spaces and an ampersand', () => {
    const { result } = renderLevel('/');

    act(() =>
      result.current.level.setLevel('Energy-Petroleum & Natural Gas', 'Oil & Gas Pipelines'),
    );

    expect(result.current.level).toMatchObject({
      type: 'Energy-Petroleum & Natural Gas',
      subType: 'Oil & Gas Pipelines',
    });
    expect(new URLSearchParams(result.current.search).get('type')).toBe(
      'Energy-Petroleum & Natural Gas',
    );
  });

  it('builds link targets that keep the other params and swap the level keys', () => {
    const { result } = renderLevel('/?type=Mines&subType=Coal%20Mines&keywords=lng');
    const { hrefFor } = result.current.level;

    expect(hrefFor('Energy-Petroleum & Natural Gas', 'Oil & Gas Pipelines')).toBe(
      '?type=Energy-Petroleum+%26+Natural+Gas&subType=Oil+%26+Gas+Pipelines&keywords=lng',
    );
    expect(hrefFor('Mines')).toBe('?type=Mines&keywords=lng');
    expect(hrefFor(null, 'Coal Mines')).toBe('?keywords=lng');
  });
});
