import { describe, it, expect } from 'vitest';
import { ACTS, DEFAULT_ACT, actByYear, actFor } from './legislation';

describe('ACTS', () => {
  // The labels must equal what eagle-api writes to `legislation`, character for character.
  it('holds each Act with the exact label eagle-api writes', () => {
    expect(ACTS.map(({ year, label, stages }) => [year, label, stages])).toEqual([
      [1996, '1996 Environmental Assessment Act', 'phases'],
      [2002, '2002 Environmental Assessment Act', 'phases'],
      [2018, '2018 Environmental Assessment Act', 'detailed'],
      [2025, 'Building Canada Act', 'none'],
    ]);
  });

  it('has unique years and labels', () => {
    expect(new Set(ACTS.map((act) => act.year)).size).toBe(ACTS.length);
    expect(new Set(ACTS.map((act) => act.label)).size).toBe(ACTS.length);
  });

  it('defaults to the 2018 Act, an entry of the registry', () => {
    expect(DEFAULT_ACT.year).toBe(2018);
    expect(ACTS).toContain(DEFAULT_ACT);
  });

  it('points every phaseRowsYear at an Act in the registry', () => {
    for (const act of ACTS.filter((entry) => entry.phaseRowsYear !== undefined)) {
      expect(actByYear(act.phaseRowsYear!)).toBeDefined();
    }
  });

  it('reads the 1996 Act off the 2002 phase rows', () => {
    expect(actByYear(1996)?.phaseRowsYear).toBe(2002);
  });

  it('dates each provincial Act into force, and not the federal one', () => {
    expect(ACTS.map(({ year, inForce }) => [year, inForce])).toEqual([
      [1996, '1995-06-30'],
      [2002, '2002-12-30'],
      [2018, '2019-12-16'],
      [2025, null],
    ]);
  });

  it('orders in-force dates the same way as the Acts', () => {
    const dated = ACTS.flatMap((act) => (act.inForce ? [act.inForce] : []));
    expect(dated).toEqual([...dated].sort());
  });

  it('holds the 1996 phase and step names, which no data source carries', () => {
    const act = actByYear(1996);
    expect(act?.phaseNames).toEqual([
      'Pre-Application',
      'Application Review',
      'Referral',
      'Post Decision',
    ]);
    expect(act?.stepNames).toHaveLength(6);
    expect(act?.stepNames?.[0]).toBe('Application for a PAC');
    expect(ACTS.filter((entry) => entry.phaseNames).map((entry) => entry.year)).toEqual([1996]);
  });
});

describe('actFor()', () => {
  it.each(ACTS.map((act) => [act.label, act.year]))(
    'finds %s by its exact label',
    (label, year) => {
      expect(actFor(label)?.year).toBe(year);
    },
  );

  it('falls back to the first year in a label the registry does not hold verbatim', () => {
    expect(actFor('Environmental Assessment Act, 2002')?.year).toBe(2002);
    expect(actFor('1996 Act, amended 2002')?.year).toBe(1996);
  });

  it.each(['Section 20181', 'Bill C2002'])(
    'reads no year out of a longer number or code: %s',
    (label) => {
      expect(actFor(label)).toBeUndefined();
    },
  );

  it.each(['2031 Environmental Assessment Act', 'Water Sustainability Act 2014'])(
    'is undefined for a year the registry does not hold: %s',
    (label) => {
      expect(actFor(label)).toBeUndefined();
    },
  );

  it.each(['Environmental Assessment Act', '', undefined])(
    'is undefined for a label with no year: %j',
    (label) => {
      expect(actFor(label)).toBeUndefined();
    },
  );
});

describe('actByYear()', () => {
  it('finds each Act by its year', () => {
    for (const act of ACTS) expect(actByYear(act.year)).toBe(act);
  });

  it('is undefined for a year the registry does not hold', () => {
    expect(actByYear(2031)).toBeUndefined();
  });
});
