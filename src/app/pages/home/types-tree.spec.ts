import { describe, it, expect, vi } from 'vitest';
import { logger } from 'app/config/logging';
import {
  OTHER_RANK,
  PROJECT_TYPES,
  buildTypeTree,
  ink,
  normalizeType,
  rankOf,
  shade,
  subRank,
  type TypeTreeSource,
} from './types-tree';

const row = (
  _id: string,
  type: string | null,
  sector: string | null,
  extra: Partial<TypeTreeSource> = {},
): TypeTreeSource => ({ _id, name: `Project ${_id}`, type, sector, region: 'Skeena', ...extra });

describe('PROJECT_TYPES', () => {
  it('lists the ten type names from Constants', () => {
    expect(PROJECT_TYPES).toHaveLength(10);
    expect(PROJECT_TYPES).toContain('Energy-Petroleum & Natural Gas');
    expect(PROJECT_TYPES).toContain('Tourist Destination Resorts');
  });
});

describe('normalizeType', () => {
  it.each([
    ['Energy - Electricity', 'Energy-Electricity'],
    ['Energy-Electricity', 'Energy-Electricity'],
    ['Energy - Petroleum & Natural Gas', 'Energy-Petroleum & Natural Gas'],
    ['Tourist Destination Resort', 'Tourist Destination Resorts'],
    ['  mines ', 'Mines'],
    ['Water Management', 'Water Management'],
  ])('maps %j to %j', (input, expected) => {
    expect(normalizeType(input)).toBe(expected);
  });

  it.each([['Space Elevators'], [''], [null], [undefined]])('maps %j to Other', (input) => {
    expect(normalizeType(input)).toBe('Other');
  });
});

describe('buildTypeTree', () => {
  const tree = buildTypeTree([
    row('m1', 'Mines', 'Coal Mines', { name: 'Zeta Coal' }),
    row('m2', 'Mines', 'Coal Mines', { name: 'Alpha Coal' }),
    row('m3', 'Mines', 'Mineral Mines'),
    row('m4', 'Mines', ''),
    row('m5', 'Mines', 'Other'),
    row('m6', 'Mines', '  '),
    row('e1', 'Energy - Electricity', 'Wind'),
    row('e2', 'Energy-Electricity', 'Wind'),
    row('x1', 'Bogus', 'Anything'),
    row('x2', null, null),
    row('x3', '', 'Anything'),
    row('x4', 'Other', 'Anything'),
  ]);

  it('orders types by count with Other last, even when Other is not smallest', () => {
    expect(tree.map((t) => [t.name, t.count])).toEqual([
      ['Mines', 6],
      ['Energy-Electricity', 2],
      ['Other', 4],
    ]);
  });

  it('leaves out types with no projects', () => {
    expect(tree.map((t) => t.name)).not.toContain('Food Processing');
  });

  it('merges both corpus spellings of a type into one node', () => {
    expect(tree[1].subs).toEqual([expect.objectContaining({ name: 'Wind', count: 2 })]);
  });

  it('puts empty, blank and "Other" sectors in one trailing Other sub-type', () => {
    expect(tree[0].subs.map((s) => [s.name, s.count])).toEqual([
      ['Coal Mines', 2],
      ['Mineral Mines', 1],
      ['Other', 3],
    ]);
  });

  it('sorts projects in a sub-type by name', () => {
    expect(tree[0].subs[0].projects.map((p) => p.name)).toEqual(['Alpha Coal', 'Zeta Coal']);
  });

  it('builds each project row from _id, name, region and current phase name', () => {
    const [project] = buildTypeTree([
      row('abc123', 'Mines', 'Coal Mines', {
        name: 'Coal Ridge',
        region: 'Peace',
        currentPhaseName: { _id: 'p1', name: 'Early Engagement' },
      }),
    ])[0].subs[0].projects;
    expect(project).toEqual({
      id: 'abc123',
      name: 'Coal Ridge',
      region: 'Peace',
      phase: 'Early Engagement',
    });
  });

  it('leaves phase and region empty when the row has none', () => {
    const [project] = buildTypeTree([
      row('abc123', 'Mines', 'Coal Mines', { region: null, currentPhaseName: 'p1' }),
    ])[0].subs[0].projects;
    expect(project).toMatchObject({ region: '', phase: '' });
  });

  it('returns an empty tree for no projects', () => {
    expect(buildTypeTree([])).toEqual([]);
  });

  it('merges sub-types that differ only in case, under the first spelling seen', () => {
    const [mines] = buildTypeTree([
      row('1', 'Mines', 'Coal mines'),
      row('2', 'Mines', 'Coal Mines'),
      row('3', 'Mines', 'COAL MINES '),
    ]);
    expect(mines.subs.map((s) => [s.name, s.count])).toEqual([['Coal mines', 3]]);
  });

  it('leaves out rows with no id, uncounted, and logs how many', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const tree = buildTypeTree([
      row('1', 'Mines', 'Coal Mines'),
      row('', 'Mines', 'Coal Mines'),
      row(undefined as unknown as string, 'Mines', 'Coal Mines'),
    ]);
    expect(tree.map((t) => [t.name, t.count])).toEqual([['Mines', 1]]);
    expect(tree[0].subs[0].projects.map((p) => p.id)).toEqual(['1']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('2 projects'), 'ProjectsByType');
    warn.mockRestore();
  });
});

describe('subRank', () => {
  it('gives Other the gray whatever its place', () => {
    expect([subRank('Other', 0), subRank('Other', 4)]).toEqual([OTHER_RANK, OTHER_RANK]);
  });

  it('cycles the rest through the nine blues instead of clamping', () => {
    expect([0, 8, 9, 10, 18].map((i) => subRank(`Sub ${i}`, i))).toEqual([0, 8, 0, 1, 0]);
  });
});

describe('rankOf', () => {
  const tree = buildTypeTree([
    row('1', 'Other', 'x'),
    row('2', 'Other', 'x'),
    row('3', 'Other', 'x'),
    row('4', 'Mines', 'x'),
    row('5', 'Mines', 'x'),
    row('6', 'Industrial', 'x'),
  ]);

  it('ranks types by position among the non-Other types', () => {
    expect([rankOf(tree, 'Mines'), rankOf(tree, 'Industrial')]).toEqual([0, 1]);
  });

  it('gives Other and unknown types the last shade', () => {
    expect([rankOf(tree, 'Other'), rankOf(tree, 'Transportation')]).toEqual([9, 9]);
  });
});

describe('shade and ink', () => {
  it('runs from darkest blue to gray and clamps past the end', () => {
    expect([shade(0), shade(8), shade(9), shade(15)]).toEqual([
      'var(--theme-blue-100)',
      'var(--theme-blue-20)',
      'var(--theme-gray-40)',
      'var(--theme-gray-40)',
    ]);
  });

  it('uses white ink on the three darkest shades, gray-110 on the fourth, blue-100 after', () => {
    expect([ink(0), ink(2), ink(3), ink(4), ink(9)]).toEqual([
      'var(--theme-gray-white)',
      'var(--theme-gray-white)',
      'var(--theme-gray-110)',
      'var(--theme-blue-100)',
      'var(--theme-blue-100)',
    ]);
  });
});
