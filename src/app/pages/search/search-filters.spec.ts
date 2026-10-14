import { describe, it, expect } from 'vitest';
import { takesFilter, toNativeFilters, yearOptions } from './search-filters';

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
