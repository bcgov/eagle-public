import { describe, it, expect } from 'vitest';
import { extractFromSearchResults } from './utils';

describe('extractFromSearchResults()', () => {
  // The Array.isArray guard never covered an empty array, so `results[0].data` threw a
  // TypeError. demi-api can answer 2xx with no result envelope, which lands here as [].
  it('returns null for an empty array instead of throwing', () => {
    expect(() => extractFromSearchResults([])).not.toThrow();
    expect(extractFromSearchResults([])).toBeNull();
  });

  it('returns null for a null response', () => {
    expect(extractFromSearchResults(null as any)).toBeNull();
  });

  it('returns null when the envelope carries no data', () => {
    expect(extractFromSearchResults([{} as any])).toBeNull();
  });

  it('still returns the search results for a well-formed response', () => {
    const results = extractFromSearchResults([
      { data: { searchResults: [{ _id: 'abc' }] } } as any
    ]);
    expect(results).toEqual([{ _id: 'abc' }]);
  });

  it('returns null, not undefined, for a data-bearing envelope with no searchResults', () => {
    // The declared return type is `T[] | null`. Without the `?? null` this returned `undefined`
    // and the `as T[]` cast made every caller's type wrong about it.
    expect(extractFromSearchResults([{ data: { meta: [] } }] as any)).toBeNull();
  });
});
