import { describe, it, expect } from 'vitest';
import { SearchResults } from './search';

describe('SearchResults', () => {
  it('defaults to an empty result set', () => {
    const results = new SearchResults();

    expect(results.data).toEqual([]);
    expect(results._schemaName).toBe('');
    expect(results.totalSearchCount).toBe(0);
    expect(results.hostname).toBeNull();
  });

  it('copies the schema name and data off the search payload', () => {
    const results = new SearchResults(
      { _schemaName: 'Document', data: [{ _id: 'd1' }] },
      'example.ca',
      42,
    );

    expect(results._schemaName).toBe('Document');
    expect(results.data).toEqual([{ _id: 'd1' }]);
    expect(results.hostname).toBe('example.ca');
    expect(results.totalSearchCount).toBe(42);
  });
});
