import { describe, it, expect } from 'vitest';
import { toWireFilters, yearOptions } from './search-filters';

const TEXT = ['nameContains'];
const YEARS = ['datePosted'];

describe('toWireFilters', () => {
  it('sends a picked value as it is stored', () => {
    expect(toWireFilters({ type: 'letter', milestone: ['m1', 'm2'] })).toEqual({
      type: 'letter',
      milestone: 'm1,m2',
    });
  });

  it('sends a year as the range that year covers', () => {
    expect(toWireFilters({ datePosted: '2021', type: 'l1' }, YEARS)).toEqual({
      type: 'l1',
      datePostedStart: '2021-01-01',
      datePostedEnd: '2021-12-31',
    });
  });

  it('leaves a bound the advanced panel has already set', () => {
    expect(
      toWireFilters({ dateUpdated: '2021', dateUpdatedStart: '2021-06-01' }, ['dateUpdated']),
    ).toEqual({ dateUpdatedStart: '2021-06-01', dateUpdatedEnd: '2021-12-31' });
  });

  it('rides as it is written when the column is not a year column', () => {
    expect(toWireFilters({ datePosted: '2021' })).toEqual({ datePosted: '2021' });
  });

  it('sends typed text under its own id', () => {
    expect(toWireFilters({ nameContains: 'fish habitat' }, YEARS, TEXT)).toEqual({
      nameContains: 'fish%20habitat',
    });
  });

  it('trims what was typed', () => {
    expect(toWireFilters({ nameContains: '  fish  ' }, YEARS, TEXT)).toEqual({
      nameContains: 'fish',
    });
  });

  it.each(['', '   '])('sends nothing at all for a box holding %j', (typed) => {
    // An empty `and[nameContains]=` is a filter that matches nothing, not an absent one.
    expect(toWireFilters({ nameContains: typed }, YEARS, TEXT)).toEqual({});
  });

  it('keeps a typed name whole when it carries a comma', () => {
    // The API layer splits a filter value on commas into one `and[]` each, which would tear this
    // name into two clauses; encoded, it arrives as the one string that was typed.
    expect(toWireFilters({ nameContains: 'Report, Volume 2' }, YEARS, TEXT)).toEqual({
      nameContains: 'Report%2C%20Volume%202',
    });
  });

  it('puts back a name the URL split on its comma', () => {
    expect(toWireFilters({ nameContains: ['Report', ' Volume 2'] }, YEARS, TEXT)).toEqual({
      nameContains: 'Report%2C%20Volume%202',
    });
  });

  it('encodes what would otherwise end the query string', () => {
    expect(toWireFilters({ nameContains: 'A#1 & B' }, YEARS, TEXT)).toEqual({
      nameContains: 'A%231%20%26%20B',
    });
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
