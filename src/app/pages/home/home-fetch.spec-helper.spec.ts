import { describe, it, expect, afterEach, vi } from 'vitest';
import { native, stubFetch } from './home-fetch.spec-helper';

describe('native', () => {
  it('answers the rows as a plain array with the given total in x-total-count', async () => {
    const response = native([{ _id: 'a' }], 42);

    expect(response.headers.get('x-total-count')).toBe('42');
    expect(await response.json()).toEqual([{ _id: 'a' }]);
  });

  it('defaults x-total-count to the number of rows', () => {
    expect(native([{ _id: 'a' }, { _id: 'b' }]).headers.get('x-total-count')).toBe('2');
  });
});

describe('stubFetch fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers any unmatched URL, native or not, with an empty native response', async () => {
    stubFetch(() => undefined);

    const response = await fetch('/demi-search/documents/recent-uploads?limit=5');

    expect(response.headers.get('x-total-count')).toBe('0');
    expect(await response.json()).toEqual([]);
  });
});
