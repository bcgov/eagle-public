import { describe, it, expect } from 'vitest';
import { pageNumbers, tableObject } from './table-object';

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

describe('table options', () => {
  it('leaves selection off unless a table asks for it', () => {
    // On by default would grow a checkbox column on every table.
    expect(tableObject({ tableId: 'test' }).options.selectable).toBeUndefined();
  });
});
