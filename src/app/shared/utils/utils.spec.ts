import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Utils } from './utils';
import { AnalyticsService } from 'app/services/analytics/analytics.service';

describe('Utils', () => {
  let utils: Utils;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        Utils,
        { provide: AnalyticsService, useValue: { track: () => undefined } }
      ]
    });
    utils = TestBed.inject(Utils);
  });

  describe('extractFromSearchResults()', () => {
    // The Array.isArray guard never covered an empty array, so `results[0].data` threw a
    // TypeError. demi-api can answer 2xx with no result envelope, which lands here as [].
    it('returns null for an empty array instead of throwing', () => {
      expect(() => utils.extractFromSearchResults([])).not.toThrow();
      expect(utils.extractFromSearchResults([])).toBeNull();
    });

    it('returns null for a null response', () => {
      expect(utils.extractFromSearchResults(null as any)).toBeNull();
    });

    it('returns null when the envelope carries no data', () => {
      expect(utils.extractFromSearchResults([{} as any])).toBeNull();
    });

    it('still returns the search results for a well-formed response', () => {
      const results = utils.extractFromSearchResults([
        { data: { searchResults: [{ _id: 'abc' }] } } as any
      ]);
      expect(results).toEqual([{ _id: 'abc' }]);
    });
  });

  it('returns null, not undefined, for a data-bearing envelope with no searchResults', () => {
    // The declared return type is `T[] | null`. Without the `?? null` this returned `undefined`
    // and the `as T[]` cast made every caller's type wrong about it.
    expect(utils.extractFromSearchResults([{ data: { meta: [] } }] as any)).toBeNull();
  });

});
