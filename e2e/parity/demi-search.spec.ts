/**
 * Tests for the fixture backend itself.
 *
 * The parity gate compares screenshots, which only means anything if both sides were shown the
 * same rows. That makes the query rules in `demi-search.ts` load-bearing, so they get their own
 * checks. Every expected number here was counted from the JSON fixtures directly, not produced by
 * the code under test.
 *
 * No browser and no server: these are pure functions over the fixture files.
 */
import { expect, test } from '@playwright/test';

import { answerCounts, answerSearch, rowsFor } from '../fixtures/unified-search/demi-search';

function query(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

test.describe('fixture datasets', () => {
  test('each dataset holds the row count the prototype ships', () => {
    expect(rowsFor('Project')).toHaveLength(12);
    expect(rowsFor('Document')).toHaveLength(18);
    expect(rowsFor('RecentActivity')).toHaveLength(10);
    expect(rowsFor('ProjectNotification')).toHaveLength(8);
  });

  test('every indexed passage becomes one DocumentChunk row', () => {
    // 8 documents carry passages; 14 passages in total across them.
    expect(rowsFor('DocumentChunk')).toHaveLength(14);
  });

  test('List resolves the document types the filter dropdown offers', () => {
    const docTypes = rowsFor('List').filter((row) => row['type'] === 'doctype');
    expect(docTypes).toHaveLength(9);
    expect(docTypes.map((row) => row['name'])).toContain('Amendment Application');
    // Every row carries the three fields the app's option lists read.
    expect(Object.keys(docTypes[0] as object)).toEqual(
      expect.arrayContaining(['_id', 'name', 'type']),
    );
  });

  test('Organization holds one row per distinct proponent', () => {
    expect(rowsFor('Organization')).toHaveLength(12);
  });
});

test.describe('search envelope', () => {
  test('answers in the [{ searchResults, meta }] shape the app reads', () => {
    const answer = answerSearch(query('dataset=Document'));
    expect(answer.searchResults).toHaveLength(18);
    expect(answer.meta).toEqual([{ searchResultsTotal: 18 }]);
  });

  test('total ignores paging', () => {
    const answer = answerSearch(query('dataset=Document&pageSize=5&pageNum=0'));
    expect(answer.searchResults).toHaveLength(5);
    expect(answer.meta[0]?.searchResultsTotal).toBe(18);
  });

  test('pageNum is zero-based, as the wire sends it', () => {
    const first = answerSearch(query('dataset=Document&pageSize=5&pageNum=0'));
    const second = answerSearch(query('dataset=Document&pageSize=5&pageNum=1'));
    expect(second.searchResults).toHaveLength(5);
    expect(second.searchResults[0]).not.toEqual(first.searchResults[0]);
  });
});

test.describe('keywords', () => {
  test('matches any string field, case-insensitively', () => {
    const answer = answerSearch(query('dataset=Project&keywords=CEDAR'));
    expect(answer.searchResults.map((row) => row['name'])).toEqual(['Cedar LNG']);
  });

  test('"sediment" is in the document text, not in document names', () => {
    expect(answerSearch(query('dataset=Document&keywords=sediment')).searchResults).toHaveLength(0);
    expect(
      answerSearch(query('dataset=DocumentChunk&keywords=sediment')).searchResults,
    ).toHaveLength(8);
  });

  test('a keyword nothing matches answers an empty page with a zero total', () => {
    const answer = answerSearch(query('dataset=Document&keywords=zzzz'));
    expect(answer.searchResults).toEqual([]);
    expect(answer.meta).toEqual([{ searchResultsTotal: 0 }]);
  });
});

test.describe('and[] filters', () => {
  test('one value narrows to that value', () => {
    expect(answerSearch(query('dataset=Project&and[region]=Skeena')).searchResults).toHaveLength(5);
  });

  test('comma-separated values are an OR within the key', () => {
    expect(
      answerSearch(query('dataset=Project&and[region]=Skeena,Northeast')).searchResults,
    ).toHaveLength(8);
  });

  test('a repeated key is the same OR', () => {
    expect(
      answerSearch(query('dataset=Project&and[region]=Skeena&and[region]=Northeast')).searchResults,
    ).toHaveLength(8);
  });

  test('separate keys are ANDed', () => {
    const answer = answerSearch(query('dataset=Project&and[region]=Skeena&and[type]=Mines'));
    expect(answer.searchResults.map((row) => row['name'])).toEqual([
      'Eskay Creek Revitalization',
      'Kitsault Mine Restart',
    ]);
  });

  test('a boolean field filters on its text form', () => {
    expect(answerSearch(query('dataset=Document&and[featured]=true')).searchResults).toHaveLength(
      3,
    );
  });

  test('keyword and filter apply together', () => {
    expect(
      answerSearch(query('dataset=Document&keywords=report&and[author]=EAO')).searchResults.length,
    ).toBeLessThan(answerSearch(query('dataset=Document&and[author]=EAO')).searchResults.length);
  });
});

test.describe('sorting', () => {
  test('sorts numbers inside names naturally: Volume 2 before Volume 10', () => {
    const names = answerSearch(
      query('dataset=Document&keywords=EAC Application&sortBy=%2Bname'),
    ).searchResults.map((row) => row['name']);
    expect(names).toEqual(['EAC Application — Volume 2 of 9', 'EAC Application — Volume 10 of 9']);
  });

  test('a leading minus reverses it', () => {
    const names = answerSearch(
      query('dataset=Document&keywords=EAC Application&sortBy=-name'),
    ).searchResults.map((row) => row['name']);
    expect(names).toEqual(['EAC Application — Volume 10 of 9', 'EAC Application — Volume 2 of 9']);
  });

  test('the default document order is newest first when asked for', () => {
    const dates = answerSearch(query('dataset=Document&sortBy=-date')).searchResults.map(
      (row) => row['date'],
    );
    expect(dates[0]).toBe('2026-02-18');
    expect(dates[dates.length - 1]).toBe('2021-01-26');
  });

  test('a second sort key breaks ties in the first', () => {
    const rows = answerSearch(
      query('dataset=Document&sortBy=%2Bauthor&sortBy=%2Bname'),
    ).searchResults;
    const eao = rows.filter((row) => row['author'] === 'EAO').map((row) => String(row['name']));
    expect(eao).toHaveLength(10);
    const collator = new Intl.Collator('en-CA', { numeric: true });
    expect(eao).toEqual([...eao].sort((a, b) => collator.compare(a, b)));
  });
});

test('counts answer the endpoint shape for one keyword', () => {
  const [answer] = answerCounts(query('keywords=sediment'));
  // No `datasets`: the four record types the endpoint answers by default, and nothing else.
  expect(Object.keys(answer.counts)).toEqual([
    'Project',
    'Document',
    'RecentActivity',
    'ProjectNotification',
  ]);
  expect(answer.counts['Document']).toBe(0);
  expect(answer.counts['Project']).toBe(0);
  expect(answer.meta[0]).toEqual({ unavailable: [], degraded: [], cached: false });

  // Named types are answered too, and a type this backend cannot measure is null, never 0.
  const [named] = answerCounts(query('q=sediment&datasets=DocumentChunk,Nonsense'));
  expect(named.counts['DocumentChunk']).toBe(8);
  expect(named.counts['Nonsense']).toBeNull();
  expect(named.meta[0].unavailable).toEqual(['Nonsense']);
});

test('repeated calls answer identically', () => {
  const once = answerSearch(query('dataset=Document&sortBy=-date&pageSize=5'));
  const twice = answerSearch(query('dataset=Document&sortBy=-date&pageSize=5'));
  expect(twice).toEqual(once);
});
