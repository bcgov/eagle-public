import { describe, it, expect } from 'vitest';
import {
  rowValueOptions,
  takesFilter,
  toNativeFilters,
  withChosen,
  withRowOptions,
} from './search-filters';

const WIRE = {
  type: 'typeId',
  milestone: 'milestoneId',
  datePostedStart: 'datePostedStart',
  datePostedEnd: 'datePostedEnd',
};

describe('toNativeFilters', () => {
  it('sends each pick under the native name, a list as a list', () => {
    expect(toNativeFilters({ type: 'letter', milestone: ['m1', 'm2'] }, WIRE)).toEqual({
      typeId: 'letter',
      milestoneId: ['m1', 'm2'],
    });
  });

  it('leaves out a filter the list does not take, which DEMI would answer 400', () => {
    expect(toNativeFilters({ type: 'l1', nameContains: 'fish' }, WIRE)).toEqual({
      typeId: 'l1',
    });
  });

  it('sends nothing for an empty pick', () => {
    expect(toNativeFilters({ type: '', milestone: [] }, WIRE)).toEqual({});
  });

  describe('a typed filter', () => {
    const TEXT_WIRE = { nameContains: 'displayNameContains' };

    it('sends a name the URL split on its comma as one trimmed value', () => {
      const native = toNativeFilters({ nameContains: ['Rio Tinto', ' Kitimat '] }, TEXT_WIRE, {}, [
        'nameContains',
      ]);

      expect(native).toEqual({ displayNameContains: 'Rio Tinto, Kitimat' });
    });

    it('sends nothing for blank text', () => {
      expect(toNativeFilters({ nameContains: '  ' }, TEXT_WIRE, {}, ['nameContains'])).toEqual({});
    });
  });
});

describe('takesFilter', () => {
  it('takes an id the list names, and a date column whose range it names', () => {
    expect(takesFilter(WIRE, 'type')).toBe(true);
    expect(takesFilter(WIRE, 'datePosted')).toBe(true);
  });

  it('refuses an id the list does not name', () => {
    expect(takesFilter(WIRE, 'legislation')).toBe(false);
  });
});

describe('rowValueOptions', () => {
  it('offers each value the rows hold once, trimmed, A to Z', () => {
    expect(
      rowValueOptions(
        [{ sector: 'Dams' }, { sector: 'Airports ' }, { sector: 'Dams' }, { sector: '  ' }, {}],
        'sector',
      ),
    ).toEqual([
      { value: 'Airports', label: 'Airports' },
      { value: 'Dams', label: 'Dams' },
    ]);
  });

  it('puts numbered values in natural order', () => {
    const options = rowValueOptions([{ phase: 'Phase 10' }, { phase: 'Phase 2' }], 'phase');

    expect(options.map((option) => option.value)).toEqual(['Phase 2', 'Phase 10']);
  });

  it('skips a value that is not text', () => {
    expect(rowValueOptions([{ sector: 7 }, { sector: null }], 'sector')).toEqual([]);
  });
});

describe('withRowOptions', () => {
  const LISTED = { type: [{ value: 'l1', label: 'Letter' }] };
  const ROWS = [{ sector: 'Dams' }];
  const fromRows = (rows: Record<string, unknown>[]) => ({
    sector: rowValueOptions(rows, 'sector'),
  });

  it('hands back the lookup options themselves when the type reads nothing off the rows', () => {
    expect(withRowOptions(LISTED, undefined, ROWS, { sector: 'Dams' })).toBe(LISTED);
  });

  it('lays the row options over the lookup ones, keeping a pick the rows no longer show', () => {
    expect(withRowOptions(LISTED, fromRows, ROWS, { sector: ['Airports'] })).toEqual({
      type: LISTED.type,
      sector: [
        { value: 'Airports', label: 'Airports' },
        { value: 'Dams', label: 'Dams' },
      ],
    });
  });
});

describe('withChosen', () => {
  const DAMS = { value: 'Dams', label: 'Dams' };

  it('adds a pick the rows no longer show, in label order', () => {
    expect(withChosen([DAMS], ['Airports'])).toEqual([
      { value: 'Airports', label: 'Airports' },
      DAMS,
    ]);
  });

  it('puts an added pick in natural order', () => {
    const PHASE_2 = { value: 'Phase 2', label: 'Phase 2' };

    expect(withChosen([PHASE_2], ['Phase 10']).map((option) => option.value)).toEqual([
      'Phase 2',
      'Phase 10',
    ]);
  });

  it('adds nothing for an empty pick', () => {
    expect(withChosen([DAMS], [''])).toEqual([DAMS]);
  });

  it('offers a pick the rows already show only once', () => {
    expect(withChosen([DAMS], 'Dams')).toEqual([DAMS]);
  });

  it('leaves the options alone when nothing is picked', () => {
    expect(withChosen([DAMS], undefined)).toEqual([DAMS]);
  });
});
