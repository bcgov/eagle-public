import { describe, it, expect } from 'vitest';
import { Constants } from './constants';
import { createProjectTabModifiers, extractFromSearchResults } from './utils';

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

describe('createProjectTabModifiers()', () => {
  const LISTS = [
    { _id: 'ms-ce-2002', name: 'Compliance & Enforcement', legislation: 2002, type: 'label' },
    { _id: 'ms-ce-2018', name: 'Compliance & Enforcement', legislation: 2018, type: 'label' },
    { _id: 'ms-amend-2002', name: 'Amendment', legislation: 2002, type: 'label' },
    { _id: 'type-amend-2002', name: 'Amendment Package', legislation: 2002, type: 'doctype' },
    { _id: 'ph-amend-2002', name: 'Post Decision - Amendment', legislation: 2002, type: 'projectPhase' }
  ];

  it('selects compliance documents by milestone alone', () => {
    expect(createProjectTabModifiers(Constants.optionalProjectDocTabs.COMPLIANCE, LISTS)).toEqual({
      documentSource: 'PROJECT',
      milestone: 'ms-ce-2002,ms-ce-2018'
    });
  });

  it('omits a field it has no ids for rather than sending it empty', () => {
    // api.searchKeywords turns '' into `&and[type]=`, and eagle-api answers that with nothing at
    // all, so an empty value silently empties the tab.
    const modifiers = createProjectTabModifiers(Constants.optionalProjectDocTabs.UNSUBSCRIBE_CAC, LISTS);
    expect(modifiers).toEqual({ documentSource: 'PROJECT' });
  });

  it('still sends type, milestone and phase for the amendment tab', () => {
    expect(createProjectTabModifiers(Constants.optionalProjectDocTabs.AMENDMENT, LISTS)).toEqual({
      documentSource: 'PROJECT',
      type: 'type-amend-2002',
      milestone: 'ms-amend-2002',
      projectPhase: 'ph-amend-2002'
    });
  });
});
