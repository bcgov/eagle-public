import { describe, it, expect } from 'vitest';
import { tableObject } from './table-object';
import {
  getFiltersFromParams,
  getFiltersFromSearchPackage,
  normalizeSortBy,
  toggleSortDirection,
  toSearchParams,
  updateTableObjectWithUrlParams,
} from './table-params';

describe('updateTableObjectWithUrlParams', () => {
  it('applies defaults when the URL names nothing', () => {
    const table = updateTableObjectWithUrlParams({}, tableObject());
    expect(table.currentPage).toBe(1);
    expect(table.pageSize).toBe(10);
    expect(table.sortBy).toBe('-datePosted');
  });

  it('reads currentPage and pageSize as numbers', () => {
    const table = updateTableObjectWithUrlParams(
      { currentPage: '3', pageSize: '50' },
      tableObject(),
    );
    expect(table.currentPage).toBe(3);
    expect(table.pageSize).toBe(50);
  });

  it('ignores empty and null params', () => {
    const table = updateTableObjectWithUrlParams(
      { sortBy: '', currentPage: null },
      tableObject({ sortBy: '+name' }),
    );
    expect(table.sortBy).toBe('+name');
    expect(table.currentPage).toBe(1);
  });

  it('scopes params by suffix so two tables can share a route', () => {
    const table = updateTableObjectWithUrlParams(
      { currentPagePins: '4', sortByPins: '-name', currentPage: '9' },
      tableObject(),
      'Pins',
    );
    expect(table.currentPage).toBe(4);
    expect(table.sortBy).toBe('-name');
  });

  it('restores a + sort that URLSearchParams form-decoded to a space', () => {
    expect(updateTableObjectWithUrlParams({ sortBy: ' name' }, tableObject()).sortBy).toBe('+name');
    expect(normalizeSortBy('-name')).toBe('-name');
  });
});

describe('getFiltersFromParams', () => {
  it('keeps only the named filters and comma-joins arrays', () => {
    const filters = getFiltersFromParams(
      { type: 'mines', region: ['a', 'b'], keywords: 'ignored' },
      ['type', 'region', 'absent'],
    );
    expect(filters).toEqual({ type: 'mines', region: 'a,b' });
  });
});

describe('getFiltersFromSearchPackage', () => {
  it('nulls filters the package omits so the URL drops them', () => {
    const params = getFiltersFromSearchPackage(
      { filters: { type: ['mines'] } },
      ['type', 'region'],
      ['decisionDateStart'],
    );
    expect(params).toEqual({ type: 'mines', region: null, decisionDateStart: null });
  });
});

describe('toSearchParams', () => {
  it('drops null, undefined and empty values', () => {
    const params = toSearchParams({ a: '1', b: null, c: undefined, d: '', e: 2 });
    expect(params.toString()).toBe('a=1&e=2');
  });
});

describe('toggleSortDirection', () => {
  it('flips direction when the same column is clicked again', () => {
    expect(toggleSortDirection('+name', 'name')).toBe('-name');
    expect(toggleSortDirection('-name', 'name')).toBe('+name');
  });

  it('starts a new column at the given fallback direction', () => {
    expect(toggleSortDirection('+name', 'region')).toBe('+region');
    expect(toggleSortDirection('+name', 'region', '-')).toBe('-region');
  });

  it('matches the whole field name, not a substring', () => {
    expect(toggleSortDirection('+displayName', 'name')).toBe('+name');
  });
});
