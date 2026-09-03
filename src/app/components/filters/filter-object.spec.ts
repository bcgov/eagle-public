import { describe, it, expect } from 'vitest';
import {
  buildSearchPackage,
  DateFilterDefinition,
  FilterObject,
  FilterType,
  hasActiveFilters,
  initialFilterValues,
  MultiSelectDefinition,
} from './filter-object';

const MINES = { _id: 'id-mines', name: 'Mines' };
const OTHER = { _id: 'id-other', name: 'Other' };

const typeFilter = new FilterObject(
  'type',
  FilterType.MultiSelect,
  'Project Type',
  new MultiSelectDefinition([MINES, OTHER], [], null, null, true),
  4,
);

const dateFilter = new FilterObject(
  'issuedDate',
  FilterType.DateRange,
  '',
  new DateFilterDefinition(
    'decisionDateStart',
    'Decision Start',
    'decisionDateEnd',
    'Decision End',
  ),
  8,
);

describe('initialFilterValues', () => {
  it('is empty when the URL carries no filters', () => {
    expect(initialFilterValues([typeFilter, dateFilter], {})).toEqual({});
  });

  it('resolves comma-joined ids back to their option objects', () => {
    expect(initialFilterValues([typeFilter], { type: 'id-mines,id-other' })).toEqual({
      type: [MINES, OTHER],
    });
  });

  it('matches options by code as well as _id', () => {
    const filter = new FilterObject(
      'region',
      FilterType.MultiSelect,
      'Region',
      new MultiSelectDefinition([{ code: 'skeena', name: 'Skeena' }], [], null, null, true),
    );
    expect(initialFilterValues([filter], { region: 'skeena' })).toEqual({
      region: [{ code: 'skeena', name: 'Skeena' }],
    });
  });

  it('trims an ISO date param back to the yyyy-mm-dd the picker takes', () => {
    expect(
      initialFilterValues([dateFilter], { decisionDateStart: '2020-01-15T00:00:00.000Z' }),
    ).toEqual({
      decisionDateStart: '2020-01-15',
    });
  });
});

describe('buildSearchPackage', () => {
  it('emits selected multi-select ids', () => {
    const result = buildSearchPackage([typeFilter], { type: [MINES] }, '', false);
    expect(result.filters).toEqual({ type: ['id-mines'] });
  });

  it('omits a multi-select with nothing selected', () => {
    expect(buildSearchPackage([typeFilter], { type: [] }, '', false).filters).toEqual({});
  });

  it('emits dates as ISO strings', () => {
    const result = buildSearchPackage([dateFilter], { decisionDateStart: '2020-01-15' }, '', false);
    expect(result.filters).toEqual({ decisionDateStart: '2020-01-15T00:00:00.000Z' });
  });

  it('drops an unparseable date rather than sending NaN', () => {
    expect(
      buildSearchPackage([dateFilter], { decisionDateStart: 'not-a-date' }, '', false).filters,
    ).toEqual({});
  });

  it('carries the keywords and whether they changed', () => {
    const result = buildSearchPackage([], {}, 'mine', true);
    expect(result).toEqual({ keywords: 'mine', keywordsChanged: true, subset: null, filters: {} });
  });
});

describe('hasActiveFilters', () => {
  it('is false with nothing set', () => {
    expect(hasActiveFilters({ type: [] }, '')).toBe(false);
  });

  it('is true for keywords, a selection or a date', () => {
    expect(hasActiveFilters({}, 'mine')).toBe(true);
    expect(hasActiveFilters({ type: [MINES] }, '')).toBe(true);
    expect(hasActiveFilters({ decisionDateStart: '2020-01-15' }, '')).toBe(true);
  });
});
