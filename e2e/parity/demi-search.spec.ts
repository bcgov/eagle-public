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
    expect(answer.meta).toEqual([{ searchResultsTotal: 18, dropped: [] }]);
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
    expect(answer.meta).toEqual([{ searchResultsTotal: 0, dropped: [] }]);
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
    expect(answerSearch(query('dataset=Document&and[isFeatured]=true')).searchResults).toHaveLength(
      3,
    );
  });

  test('keyword and filter apply together', () => {
    expect(
      answerSearch(query('dataset=Document&keywords=report&and[documentAuthorType]=EAO'))
        .searchResults.length,
    ).toBeLessThan(
      answerSearch(query('dataset=Document&and[documentAuthorType]=EAO')).searchResults.length,
    );
  });
});

test.describe('sorting', () => {
  test('sorts numbers inside names naturally: Volume 2 before Volume 10', () => {
    const names = answerSearch(
      query('dataset=Document&keywords=EAC Application&sortBy=%2BdisplayName'),
    ).searchResults.map((row) => row['displayName']);
    expect(names).toEqual(['EAC Application — Volume 2 of 9', 'EAC Application — Volume 10 of 9']);
  });

  test('a leading minus reverses it', () => {
    const names = answerSearch(
      query('dataset=Document&keywords=EAC Application&sortBy=-displayName'),
    ).searchResults.map((row) => row['displayName']);
    expect(names).toEqual(['EAC Application — Volume 10 of 9', 'EAC Application — Volume 2 of 9']);
  });

  test('the default document order is newest first when asked for', () => {
    const dates = answerSearch(query('dataset=Document&sortBy=-datePosted')).searchResults.map(
      (row) => row['datePosted'],
    );
    expect(dates[0]).toBe('2026-02-18');
    expect(dates[dates.length - 1]).toBe('2021-01-26');
  });

  test('a second sort key breaks ties in the first', () => {
    const rows = answerSearch(
      query('dataset=Document&sortBy=%2BdocumentAuthorType&sortBy=%2BdisplayName'),
    ).searchResults;
    const eao = rows
      .filter((row) => row['documentAuthorType'] === 'EAO')
      .map((row) => String(row['displayName']));
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

/**
 * Every filter the unified page advertises, per record type, with the rows it should leave.
 *
 * The ids are the `filterIds` and `advancedFields` of `src/app/pages/search/types/*.ts` for the two
 * built tabs, and `LEGACY_FILTERS` in `src/app/routes/legacy-search.ts` plus the plan's advanced
 * fields for the two still to come. They are spelled out rather than imported because the e2e
 * project compiles on its own and those modules pull in the whole app. Counts were taken from the
 * JSON by hand.
 */
const ADVERTISED: {
  dataset: string;
  total: number;
  filters: { id: string; value: string; left: number }[];
}[] = [
  {
    dataset: 'Project',
    total: 12,
    filters: [
      { id: 'proponent', value: 'org-5', left: 1 },
      { id: 'type', value: 'Mines', left: 4 },
      { id: 'region', value: 'Skeena', left: 5 },
      { id: 'currentPhaseName', value: 'Post decision', left: 1 },
      { id: 'eacDecision', value: 'Certificate issued', left: 2 },
      { id: 'CEAAInvolvement', value: 'Yes', left: 4 },
      { id: 'dateUpdatedStart', value: '2026-02-01', left: 2 },
      { id: 'dateUpdatedEnd', value: '2026-01-31', left: 10 },
    ],
  },
  {
    dataset: 'Document',
    total: 18,
    filters: [
      { id: 'type', value: 'Amendment Application', left: 1 },
      { id: 'milestone', value: 'Amendment', left: 3 },
      { id: 'projectPhase', value: 'Post decision', left: 7 },
      { id: 'documentAuthorType', value: 'EAO', left: 10 },
      { id: 'legislation', value: '2018', left: 14 },
      { id: 'isFeatured', value: 'true', left: 3 },
      { id: 'datePostedStart', value: '2026-01-01', left: 3 },
      { id: 'datePostedEnd', value: '2022-01-01', left: 4 },
    ],
  },
  {
    dataset: 'RecentActivity',
    total: 10,
    filters: [
      { id: 'type', value: 'Amendment', left: 1 },
      { id: 'dateAddedStart', value: '2026-02-01', left: 2 },
      { id: 'dateAddedEnd', value: '2025-12-31', left: 6 },
      {
        id: 'documentUrl',
        value: '/api/document/d1/fetch/Amendment%20%233%20Application%20%E2%80%94%20Volume%201.pdf',
        left: 1,
      },
    ],
  },
  {
    dataset: 'ProjectNotification',
    total: 8,
    filters: [
      { id: 'type', value: 'Mines', left: 1 },
      { id: 'region', value: 'Cariboo', left: 1 },
      { id: 'pcp', value: 'open', left: 2 },
      { id: 'decision', value: 'In Progress', left: 4 },
    ],
  },
];

for (const { dataset, total, filters } of ADVERTISED) {
  test.describe(`${dataset} filters`, () => {
    for (const { id, value, left } of filters) {
      test(`and[${id}] narrows ${dataset}`, () => {
        const answer = answerSearch(
          query(`dataset=${dataset}&and[${id}]=${encodeURIComponent(value)}`),
        );
        expect(answer.searchResults).toHaveLength(left);
        expect(answer.meta[0]?.searchResultsTotal).toBe(left);
        expect(left).toBeLessThan(total);
      });
    }

    test(`no advertised ${dataset} filter is dropped`, () => {
      const params = filters
        .map(({ id, value }) => `and[${id}]=${encodeURIComponent(value)}`)
        .join('&');
      const answer = answerSearch(query(`dataset=${dataset}&${params}`));
      expect(answer.meta[0]?.dropped).toEqual([]);
    });
  });
}

test.describe('meta.dropped', () => {
  test('names a field the dataset does not carry, filtered or sorted', () => {
    expect(
      answerSearch(query('dataset=Project&and[milestone]=Amendment&sortBy=-datePosted')).meta[0]
        ?.dropped,
    ).toEqual(['milestone', 'datePosted']);
  });

  test('projects carry dateUpdated, so the page keeps its date sort', () => {
    expect(answerSearch(query('dataset=Project&sortBy=-dateUpdated')).meta[0]?.dropped).toEqual([]);
  });
});

test('a dropdown option id selects the rows its label names', () => {
  // Option values are `List` ids (`toOptions`), so the id and the label it stands for must agree.
  const phase = rowsFor('List').find(
    (row) => row['type'] === 'projectPhase' && row['name'] === 'Post decision',
  );
  const byId = answerSearch(query(`dataset=Document&and[projectPhase]=${phase?.['_id']}`));
  const byLabel = answerSearch(query('dataset=Document&and[projectPhase]=Post decision'));
  expect(byId.searchResults).toHaveLength(7);
  expect(byId.searchResults).toEqual(byLabel.searchResults);
});

test('repeated calls answer identically', () => {
  const once = answerSearch(query('dataset=Document&sortBy=-datePosted&pageSize=5'));
  const twice = answerSearch(query('dataset=Document&sortBy=-datePosted&pageSize=5'));
  expect(twice).toEqual(once);
});
