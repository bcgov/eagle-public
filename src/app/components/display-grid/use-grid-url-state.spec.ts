import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import {
  parseGridParams,
  serializeGridParams,
  toApiFilters,
  useGridUrlState,
  type GridUrlApi,
} from './use-grid-url-state';

/** The hook plus the address it has written, so a spec can assert on the URL the reader can copy. */
function renderGrid(initial = '/search') {
  function wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [initial] }, children);
  }
  return renderHook(
    (): { grid: GridUrlApi; search: string } => ({
      grid: useGridUrlState(),
      search: useLocation().search,
    }),
    { wrapper },
  );
}

function params(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe('parseGridParams', () => {
  it('falls back to the defaults the plan names', () => {
    const state = parseGridParams(params(''));

    expect(state).toMatchObject({
      keywords: '',
      record: 'documents',
      scope: 'names',
      sortBy: '-datePosted',
      currentPage: 1,
      pageSize: 25,
      hiddenColumns: [],
      filters: {},
    });
  });

  it('refuses a record type and a page size it does not know', () => {
    const state = parseGridParams(params('?record=recipes&pageSize=37'));

    expect(state.record).toBe('documents');
    expect(state.pageSize).toBe(25);
  });

  it('restores a sort sign the form decoder ate', () => {
    expect(parseGridParams(params('?sortBy= name')).sortBy).toBe('+name');
  });

  it('sorts by match count when the scope is inside documents', () => {
    expect(parseGridParams(params('?scope=inside')).sortBy).toBe('-matches');
  });

  it('treats every other param as a filter, comma lists as several values', () => {
    const state = parseGridParams(params('?type=Amendment,Order&milestone=Construction'));

    expect(state.filters).toEqual({ type: ['Amendment', 'Order'], milestone: 'Construction' });
  });

  it('reads the hidden columns off cols', () => {
    expect(parseGridParams(params('?cols=status,phase')).hiddenColumns).toEqual([
      'status',
      'phase',
    ]);
  });
});

describe('serializeGridParams', () => {
  it('leaves defaults and empty values out of the address', () => {
    const state = parseGridParams(params(''));

    expect(serializeGridParams({ ...state, sortBy: '' }).toString()).toBe('');
  });

  it('round-trips a narrowed view', () => {
    const search = '?keywords=sediment&record=documents&type=Amendment,Order&currentPage=3';
    const state = parseGridParams(params(search));

    const round = parseGridParams(serializeGridParams(state));
    expect(round).toEqual(state);
  });
});

describe('toApiFilters', () => {
  it('names filters the way the API takes them', () => {
    expect(toApiFilters({ type: ['Amendment', 'Order'], milestone: 'Construction' })).toEqual({
      'and[type]': 'Amendment,Order',
      'and[milestone]': 'Construction',
    });
  });
});

describe('useGridUrlState', () => {
  it('writes the keyword and returns to the first page', () => {
    const { result } = renderGrid('/search?currentPage=4');

    act(() => result.current.grid.setKeyword('  sediment  '));

    expect(params(result.current.search).get('keywords')).toBe('sediment');
    expect(result.current.grid.state.currentPage).toBe(1);
  });

  it('keeps only the keyword when the record type changes', () => {
    const { result } = renderGrid(
      '/search?keywords=sediment&record=documents&scope=inside&type=Order&sortBy=-matches&cols=phase&currentPage=5',
    );

    act(() => result.current.grid.setRecord('activities'));

    const next = params(result.current.search);
    expect(next.get('keywords')).toBe('sediment');
    expect(next.get('record')).toBe('activities');
    expect(next.get('scope')).toBeNull();
    expect(next.get('type')).toBeNull();
    expect(next.get('sortBy')).toBeNull();
    expect(next.get('cols')).toBeNull();
    expect(next.get('currentPage')).toBeNull();
  });

  it('drops the record param when the type returns to the default', () => {
    const { result } = renderGrid('/search?record=projects');

    act(() => result.current.grid.setRecord('documents'));

    expect(params(result.current.search).get('record')).toBeNull();
    expect(result.current.grid.state.record).toBe('documents');
  });

  it('sorts by match count inside documents and by date back in names and details', () => {
    const { result } = renderGrid('/search?record=documents');

    act(() => result.current.grid.setScope('inside'));
    expect(params(result.current.search).get('sortBy')).toBe('-matches');
    expect(result.current.grid.state.scope).toBe('inside');

    act(() => result.current.grid.setScope('names'));
    expect(params(result.current.search).get('sortBy')).toBe('-datePosted');
    expect(params(result.current.search).get('scope')).toBeNull();
  });

  it('applies a filter, joins several values and returns to the first page', () => {
    const { result } = renderGrid('/search?currentPage=6');

    act(() => result.current.grid.setFilter('type', ['Amendment', 'Order']));

    expect(params(result.current.search).get('type')).toBe('Amendment,Order');
    expect(params(result.current.search).get('currentPage')).toBeNull();
    expect(result.current.grid.state.filters['type']).toEqual(['Amendment', 'Order']);
  });

  it('removes a filter set to null', () => {
    const { result } = renderGrid('/search?type=Order');

    act(() => result.current.grid.setFilter('type', null));

    expect(params(result.current.search).get('type')).toBeNull();
  });

  it('flips the direction on a second click of the same column and returns to the first page', () => {
    const { result } = renderGrid('/search?currentPage=3');

    act(() => result.current.grid.setSort('name'));
    expect(params(result.current.search).get('sortBy')).toBe('+name');
    expect(params(result.current.search).get('currentPage')).toBeNull();

    act(() => result.current.grid.setSort('name'));
    expect(params(result.current.search).get('sortBy')).toBe('-name');
  });

  it('starts a date column newest first when it is not the column already sorted', () => {
    const { result } = renderGrid('/search?sortBy=%2Bname');

    act(() => result.current.grid.setSort('datePosted', '-'));

    expect(params(result.current.search).get('sortBy')).toBe('-datePosted');
  });

  it('flips the default sort column rather than restarting it', () => {
    const { result } = renderGrid();

    act(() => result.current.grid.setSort('datePosted', '-'));

    expect(params(result.current.search).get('sortBy')).toBe('+datePosted');
  });

  it('keeps the page out of the address on page one', () => {
    const { result } = renderGrid('/search?currentPage=4');

    act(() => result.current.grid.setPage(1));

    expect(params(result.current.search).get('currentPage')).toBeNull();
    expect(result.current.grid.state.currentPage).toBe(1);
  });

  it('returns to the first page when the page size changes', () => {
    const { result } = renderGrid('/search?currentPage=4');

    act(() => result.current.grid.setPageSize(100));

    expect(params(result.current.search).get('pageSize')).toBe('100');
    expect(params(result.current.search).get('currentPage')).toBeNull();
  });

  it('records the hidden columns and drops the param once every column is back', () => {
    const { result } = renderGrid();

    act(() => result.current.grid.setHiddenColumns(['status', 'phase']));
    expect(params(result.current.search).get('cols')).toBe('status,phase');

    act(() => result.current.grid.setHiddenColumns([]));
    expect(params(result.current.search).get('cols')).toBeNull();
  });

  it('clears the filters but keeps the keyword and the arrangement', () => {
    const { result } = renderGrid(
      '/search?keywords=sediment&record=documents&type=Order&pageSize=50&currentPage=3',
    );

    act(() => result.current.grid.clearFilters());

    const next = params(result.current.search);
    expect(next.get('type')).toBeNull();
    expect(next.get('keywords')).toBe('sediment');
    expect(next.get('pageSize')).toBe('50');
    expect(next.get('currentPage')).toBeNull();
  });

  it('clears the keyword and the filters together, leaving the arrangement', () => {
    const { result } = renderGrid(
      '/search?keywords=sediment&record=documents&type=Order&sortBy=-datePosted&pageSize=50',
    );

    act(() => result.current.grid.clearAll());

    const next = params(result.current.search);
    expect(next.get('keywords')).toBeNull();
    expect(next.get('type')).toBeNull();
    expect(next.get('record')).toBe('documents');
    expect(next.get('sortBy')).toBe('-datePosted');
    expect(next.get('pageSize')).toBe('50');
  });

  it('keeps the rest of the view when only the keyword changes', () => {
    const { result } = renderGrid('/search?record=documents&type=Order&cols=phase&pageSize=50');

    act(() => result.current.grid.setKeyword('sediment'));

    const next = params(result.current.search);
    expect(next.get('record')).toBe('documents');
    expect(next.get('type')).toBe('Order');
    expect(next.get('cols')).toBe('phase');
    expect(next.get('pageSize')).toBe('50');
  });
});
