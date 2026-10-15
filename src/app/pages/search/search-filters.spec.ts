import { describe, it, expect } from 'vitest';
import {
  rowValueOptions,
  takesFilter,
  toNativeFilters,
  withChosen,
  withRowOptions,
  yearOptions,
} from './search-filters';

const YEARS = ['datePosted'];
const WIRE = {
  type: 'typeId',
  milestone: 'milestoneId',
  datePostedStart: 'datePostedStart',
  datePostedEnd: 'datePostedEnd',
};

describe('toNativeFilters', () => {
  it('sends each pick under the native name, a list as a list', () => {
    expect(toNativeFilters({ type: 'letter', milestone: ['m1', 'm2'] }, [], WIRE)).toEqual({
      typeId: 'letter',
      milestoneId: ['m1', 'm2'],
    });
  });

  it('sends a year as the range that year covers', () => {
    expect(toNativeFilters({ datePosted: '2021', type: 'l1' }, YEARS, WIRE)).toEqual({
      typeId: 'l1',
      datePostedStart: '2021-01-01',
      datePostedEnd: '2021-12-31',
    });
  });

  it('leaves a bound the advanced panel has already set', () => {
    expect(
      toNativeFilters({ datePosted: '2021', datePostedStart: '2021-06-01' }, YEARS, WIRE),
    ).toEqual({ datePostedStart: '2021-06-01', datePostedEnd: '2021-12-31' });
  });

  it('leaves out a filter the list does not take, which DEMI would answer 400', () => {
    expect(toNativeFilters({ type: 'l1', nameContains: 'fish' }, [], WIRE)).toEqual({
      typeId: 'l1',
    });
  });

  it('sends nothing for an empty pick', () => {
    expect(toNativeFilters({ type: '', milestone: [] }, [], WIRE)).toEqual({});
  });

  describe('a typed filter', () => {
    const TEXT_WIRE = { nameContains: 'displayNameContains' };

    it('sends a name the URL split on its comma as one trimmed value', () => {
      const native = toNativeFilters(
        { nameContains: ['Rio Tinto', ' Kitimat '] },
        [],
        TEXT_WIRE,
        {},
        ['nameContains'],
      );

      expect(native).toEqual({ displayNameContains: 'Rio Tinto, Kitimat' });
    });

    it('sends nothing for blank text', () => {
      expect(toNativeFilters({ nameContains: '  ' }, [], TEXT_WIRE, {}, ['nameContains'])).toEqual(
        {},
      );
    });
  });
});

describe('takesFilter', () => {
  it('takes an id the list names, and a year column whose range it names', () => {
    expect(takesFilter(WIRE, 'type')).toBe(true);
    expect(takesFilter(WIRE, 'datePosted')).toBe(true);
  });

  it('refuses an id the list does not name', () => {
    expect(takesFilter(WIRE, 'legislation')).toBe(false);
  });
});

describe('yearOptions', () => {
  const thisYear = new Date().getFullYear();
  const values = (chosen = '') => yearOptions(chosen).map((option) => option.value);

  it('runs from this year back to the first Environmental Assessment Act, newest first', () => {
    const years = values();

    expect(years[0]).toBe(String(thisYear));
    expect(years.at(-1)).toBe('1995');
    expect(years).toHaveLength(thisYear - 1995 + 1);
    expect(years.map(Number)).toEqual([...years.map(Number)].sort((a, b) => b - a));
  });

  it('reaches a year no page of results would have shown', () => {
    // The default sort is newest first, so page one only ever carries the current year.
    expect(values()).toContain('2004');
  });

  it('labels a year with itself', () => {
    expect(yearOptions('')).toContainEqual({ value: '2004', label: '2004' });
  });

  it('keeps a year chosen before the range, in its place at the end', () => {
    const years = values('1990');

    expect(years.at(-1)).toBe('1990');
    expect(years.at(-2)).toBe('1995');
  });

  it('keeps a year chosen after the range, in its place at the front', () => {
    const ahead = String(thisYear + 2);

    expect(values(ahead)[0]).toBe(ahead);
  });

  it('offers a chosen year the range already holds only once', () => {
    expect(values('2004').filter((year) => year === '2004')).toHaveLength(1);
  });

  it('ignores a chosen value that is not a year', () => {
    expect(values('any')).toEqual(values());
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
