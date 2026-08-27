import { describe, it, expect } from 'vitest';
import { pageCountMessage, pageNumbers, withAllPicker } from './table-object';

describe('pageCountMessage', () => {
  it('is empty when there are no results', () => {
    expect(pageCountMessage(0, 1, 25)).toBe('');
  });

  it('counts up to the end of the current page', () => {
    expect(pageCountMessage(100, 1, 25)).toBe('Showing 25 of 100 results');
  });

  it('caps at the total on the last page', () => {
    expect(pageCountMessage(90, 4, 25)).toBe('Showing 90 of 90 results');
  });

  it('warns when the page param is past the end', () => {
    expect(pageCountMessage(50, 10, 25)).toBe('Unable to display results, please clear and re-try');
  });
});

describe('pageNumbers', () => {
  it('lists every page while there are 7 or fewer', () => {
    expect(pageNumbers(7, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('trails off after the first pages', () => {
    expect(pageNumbers(20, 1)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
  });

  it('brackets the current page in the middle', () => {
    expect(pageNumbers(20, 10)).toEqual([1, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 20]);
  });

  it('trails off before the last pages', () => {
    expect(pageNumbers(20, 20)).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
  });
});

describe('withAllPicker', () => {
  const options = [
    { displayText: '10', value: 10 },
    { displayText: '25', value: 25 }
  ];

  it('offers Show All while the result set is small enough', () => {
    expect(withAllPicker(options, 300)).toEqual([...options, { displayText: 'Show All', value: 300 }]);
  });

  it('withholds Show All past the cap, and with no results', () => {
    expect(withAllPicker(options, 501)).toEqual(options);
    expect(withAllPicker(options, 0)).toEqual(options);
  });

  it('never stacks two Show All options', () => {
    const once = withAllPicker(options, 300);
    expect(withAllPicker(once, 400)).toEqual([...options, { displayText: 'Show All', value: 400 }]);
  });
});
