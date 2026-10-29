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

import {
  answerCounts,
  answerNative,
  listRows,
  type Row,
} from '../fixtures/unified-search/demi-search';

/** The `List` id the app sends for a term, as its dropdown option values are. */
function idOf(type: string, name: string): string {
  return String(listRows().find((row) => row['type'] === type && row['name'] === name)?.['id']);
}

/** A native read that must answer rows; a 400 or an unknown kind fails the test. */
function read(kind: string, search = ''): { rows: Row[]; total?: number } {
  const answer = answerNative(kind, new URLSearchParams(search));
  if (!answer || 'status' in answer)
    throw new Error(`${kind}?${search}: ${JSON.stringify(answer)}`);
  return answer;
}

/** The status a native read refuses with, or null when it answers. */
function refusal(kind: string, search: string): number | null {
  const answer = answerNative(kind, new URLSearchParams(search));
  return answer && 'status' in answer ? answer.status : null;
}

test.describe('fixture kinds', () => {
  test('each kind holds the row count the prototype ships', () => {
    expect(read('projects').rows).toHaveLength(12);
    expect(read('documents').rows).toHaveLength(18);
    expect(read('updates').rows).toHaveLength(10);
    expect(read('notifications').rows).toHaveLength(8);
    expect(read('comment-periods').rows).toHaveLength(0);
  });

  test('a project carries the Track id, its Eagle id, and its List refs', () => {
    const cedar = read('projects', 'q=cedar').rows[0];
    expect(cedar?.['id']).toBe('track-p1');
    expect(cedar?.['eagleId']).toBe('p1');
    expect(cedar?.['currentPhaseName']).toMatchObject({ name: 'Post decision' });
  });

  test('List resolves the document types the filter dropdown offers', () => {
    const docTypes = listRows().filter((row) => row['type'] === 'doctype');
    expect(docTypes).toHaveLength(9);
    expect(docTypes.map((row) => row['name'])).toContain('Amendment Application');
    // Every row carries the three fields the app's option lists read.
    expect(Object.keys(docTypes[0] as object)).toEqual(
      expect.arrayContaining(['id', 'name', 'type']),
    );
  });

  test('the native lists route pages the rows and counts them all', () => {
    const total = listRows().length;
    const last = read('lists', `page=2&pageSize=${total - 1}&count=true`);
    expect(last.total).toBe(total);
    expect(last.rows).toHaveLength(1);
    expect(read('lists', 'page=1&pageSize=5').total).toBeUndefined();
  });

  test('the native organizations route holds one row per distinct proponent', () => {
    const page = read('organizations', 'page=1&pageSize=100&count=true&sort=name');
    expect(page.total).toBe(12);
    expect(page.rows.every((row) => typeof row['id'] === 'string')).toBe(true);
  });
});

test.describe('list contract', () => {
  test('counts every match into the total, ignoring paging', () => {
    const answer = read('documents', 'pageSize=5&count=true');
    expect(answer.rows).toHaveLength(5);
    expect(answer.total).toBe(18);
  });

  test('page is one-based, as the wire sends it', () => {
    const first = read('documents', 'pageSize=5&page=1');
    const second = read('documents', 'pageSize=5&page=2');
    expect(second.rows).toHaveLength(5);
    expect(second.rows[0]).not.toEqual(first.rows[0]);
  });

  test('refuses a parameter the kind does not take, as DEMI does', () => {
    // Documents take their name text as `displayNameContains`; `hasDocumentUrl` is the updates' own.
    expect(refusal('documents', 'nameContains=fish')).toBe(400);
    expect(refusal('projects', 'hasDocumentUrl=true')).toBe(400);
    expect(refusal('documents/passages', 'q=marine&legislation=2002')).toBe(400);
  });

  test('refuses a repeated value on a single-value filter', () => {
    expect(refusal('notifications', 'pcp=open&pcp=closed')).toBe(400);
    expect(refusal('notifications', 'type=Mines&type=Industrial')).toBeNull();
    expect(refusal('projects', 'region=Skeena&region=Northeast')).toBeNull();
  });

  test('refuses a text filter given twice, so a name split on its comma fails here', () => {
    expect(refusal('projects', 'nameContains=Cedar&nameContains=LNG')).toBe(400);
    expect(refusal('documents', 'displayNameContains=A&displayNameContains=B')).toBe(400);
  });

  test('refuses a sort outside the kind list', () => {
    // The phase is a `List` ref: DEMI sorts it by `currentPhaseName.name` and refuses the bare key.
    expect(refusal('projects', 'sort=currentPhaseName')).toBe(400);
    expect(refusal('updates', 'sort=content')).toBe(400);
  });

  // The columns the results tables sort on, as DEMI's sort lists name them at eagle-demi 5efb3427.
  for (const [kind, key] of [
    ['projects', 'proponentName'],
    ['projects', 'projectType'],
    ['projects', 'sector'],
    ['projects', 'region'],
    ['documents', 'type'],
    ['documents', 'milestone'],
    ['documents', 'projectPhase'],
    ['documents', 'documentAuthorType'],
    ['notifications', 'type'],
    ['notifications', 'region'],
    ['notifications', 'proponent'],
    ['notifications', 'decision'],
    ['updates', 'headline'],
    ['updates', 'type'],
  ]) {
    test(`takes ${kind} sorted on ${key}, as DEMI does`, () => {
      expect(refusal(kind, `sort=-${key}`)).toBeNull();
    });
  }

  test('refuses a keyword where the kind takes none, and passages without one', () => {
    expect(refusal('lists', 'q=kitimat')).toBe(400);
    expect(refusal('documents/passages', '')).toBe(400);
  });

  test('takes a keyword on comment periods', () => {
    expect(refusal('comment-periods', 'q=kitimat')).toBeNull();
  });

  test('reads ids in place of a query', () => {
    expect(read('documents', 'ids=d2,d1').rows.map((row) => row['id'])).toEqual(['d1', 'd2']);
  });
});

test.describe('keywords', () => {
  test('matches any string field, case-insensitively', () => {
    expect(read('projects', 'q=CEDAR').rows.map((row) => row['name'])).toEqual(['Cedar LNG']);
  });

  test('"sediment" is in the document text, not in document names', () => {
    expect(read('documents', 'q=sediment').rows).toHaveLength(0);
    expect(read('documents/passages', 'q=sediment&count=true').total).toBe(8);
  });

  test('a passage page carries one row per passage, the hit wrapped as Azure wraps it', () => {
    // "marine" is in 6 passages spread over 5 documents; d2 holds two of them.
    const answer = read('documents/passages', 'q=marine&count=true');
    expect(answer.rows).toHaveLength(6);
    expect(answer.total).toBe(6);
    expect(answer.rows.filter((row) => row['documentId'] === 'd2')).toHaveLength(2);
    expect(String(answer.rows[0]?.['snippet'])).toContain('<mark>marine</mark>');
  });

  test('a keyword nothing matches answers an empty page with a zero total', () => {
    const answer = read('documents', 'q=zzzz&count=true');
    expect(answer.rows).toEqual([]);
    expect(answer.total).toBe(0);
  });
});

test.describe('filters', () => {
  test('a repeated filter is an OR within the key', () => {
    expect(read('projects', 'region=Skeena&region=Northeast').rows).toHaveLength(8);
  });

  test('separate filters are ANDed', () => {
    expect(
      read('projects', 'region=Skeena&projectType=Mines').rows.map((row) => row['name']),
    ).toEqual(['Eskay Creek Revitalization', 'Kitsault Mine Restart']);
  });

  test('keyword and filter apply together', () => {
    const author = listRows().find((row) => row['type'] === 'author' && row['name'] === 'EAO');
    const filter = `documentAuthorTypeId=${author?.['id']}`;
    expect(read('documents', `q=report&${filter}`).rows.length).toBeLessThan(
      read('documents', filter).rows.length,
    );
  });

  test('repeated notification types are an OR', () => {
    expect(
      read('notifications', 'type=Mines&type=Industrial').rows.map((row) => row['name']),
    ).toEqual(['Bear Creek Aggregate Expansion', 'Skeena Modular Housing Works']);
  });

  test('a text filter matches inside the name, case-insensitively', () => {
    expect(read('projects', 'nameContains=CEDAR').rows.map((row) => row['name'])).toEqual([
      'Cedar LNG',
    ]);
  });

  test('a passage narrows by the List refs of its document', () => {
    const type = listRows().find(
      (row) => row['type'] === 'doctype' && row['name'] === 'Amendment Application',
    );
    const narrowed = read('documents/passages', `q=marine&typeId=${type?.['id']}`).rows;
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.length).toBeLessThan(6);
  });
});

test.describe('sorting', () => {
  test('sorts numbers inside names naturally: Volume 2 before Volume 10', () => {
    const names = read('documents', 'q=EAC Application&sort=displayName').rows.map(
      (row) => row['displayName'],
    );
    expect(names).toEqual(['EAC Application — Volume 2 of 9', 'EAC Application — Volume 10 of 9']);
  });

  test('a leading minus reverses it', () => {
    const names = read('documents', 'q=EAC Application&sort=-displayName').rows.map(
      (row) => row['displayName'],
    );
    expect(names).toEqual(['EAC Application — Volume 10 of 9', 'EAC Application — Volume 2 of 9']);
  });

  test('the default document order is newest first when asked for', () => {
    const dates = read('documents', 'sort=-datePosted').rows.map((row) => row['datePosted']);
    expect(dates[0]).toBe('2026-02-18');
    expect(dates[dates.length - 1]).toBe('2021-01-26');
  });

  test('two rows of the same date fall back to the name, flipped with the sort', () => {
    const names = read('documents', 'sort=-datePosted')
      .rows.filter((row) => row['datePosted'] === '2022-08-05')
      .map((row) => String(row['displayName']));
    expect(names).toEqual(['EAC Application — Volume 10 of 9', 'EAC Application — Volume 2 of 9']);
  });

  test('the same tie reads the other way round when the date sort is ascending', () => {
    const names = read('documents', 'sort=datePosted')
      .rows.filter((row) => row['datePosted'] === '2022-08-05')
      .map((row) => String(row['displayName']));
    expect(names).toEqual(['EAC Application — Volume 2 of 9', 'EAC Application — Volume 10 of 9']);
  });

  test('projects sort by the phase name inside the List ref', () => {
    const names = read('projects', 'sort=currentPhaseName.name').rows.map((row) => row['name']);
    // "Application Development and Review" holds two projects, tied on phase and broken by name.
    expect(names.slice(0, 3)).toEqual([
      '7 Mile Renewable Fuels Production Facility',
      'Tilbury Phase 2 LNG Expansion',
      'Aspen Solar and Energy Storage',
    ]);
    expect(names[names.length - 1]).toBe('Highland Valley Copper 2040');
  });

  test('projects sort by last updated, newest first', () => {
    const names = read('projects', 'sort=-dateUpdated').rows.map((row) => row['name']);
    expect(names[0]).toBe('Cedar LNG');
    expect(names[names.length - 1]).toBe('Vancouver Island Waste-to-Energy');
  });

  test('updates sort by headline, Z to A', () => {
    const headlines = read('updates', 'sort=-headline').rows.map((row) => row['headline']);
    expect(headlines[0]).toBe('Readiness decision issued');
    expect(headlines[headlines.length - 1]).toBe('Amendment #3 application accepted for review');
  });

  test('passages keep the index order, which stands for relevance', () => {
    const documents = read('documents/passages', 'q=sediment').rows.map((row) => row['documentId']);
    expect(documents).toEqual(['d1', 'd2', 'd3', 'd5', 'd8', 'd10', 'd12', 'd13']);
  });
});

test('counts answer the /counts shape for projects and documents', () => {
  expect(answerCounts(new URLSearchParams('kind=projects,documents&q=sediment'))).toEqual({
    projects: 0,
    documents: 0,
  });
  expect(answerCounts(new URLSearchParams('kind=projects,documents'))).toEqual({
    projects: 12,
    documents: 18,
  });
});

/**
 * Every filter the unified page sends, per native kind, with the rows it should leave. The names
 * are the `wire` maps of `src/app/pages/search/types/*.ts`, spelled out rather than imported
 * because the e2e project compiles on its own and those modules pull in the whole app. Counts were
 * taken from the JSON by hand.
 */
const SENT: {
  kind: string;
  total: number;
  filters: { name: string; value: string; left: number }[];
}[] = [
  {
    kind: 'projects',
    total: 12,
    filters: [
      { name: 'proponentName', value: 'Cedar LNG Partners LP', left: 1 },
      { name: 'projectType', value: 'Mines', left: 4 },
      { name: 'region', value: 'Skeena', left: 5 },
      { name: 'currentPhaseName', value: idOf('projectPhase', 'Post decision'), left: 1 },
      { name: 'eacDecision', value: idOf('eaDecisions', 'Certificate issued'), left: 2 },
      { name: 'CEAAInvolvement', value: idOf('ceaaInvolvements', 'Yes'), left: 4 },
      { name: 'sector', value: 'Metal Mines', left: 3 },
      { name: 'nameContains', value: 'mine', left: 1 },
      { name: 'dateUpdatedStart', value: '2026-01-01', left: 3 },
      { name: 'dateUpdatedEnd', value: '2025-03-01', left: 2 },
    ],
  },
  {
    kind: 'documents',
    total: 18,
    filters: [
      { name: 'typeId', value: idOf('doctype', 'Amendment Application'), left: 1 },
      { name: 'milestoneId', value: idOf('label', 'Amendment'), left: 3 },
      { name: 'projectPhaseId', value: idOf('projectPhase', 'Post decision'), left: 7 },
      { name: 'documentAuthorTypeId', value: idOf('author', 'EAO'), left: 10 },
      { name: 'legislation', value: '2018', left: 14 },
      { name: 'isFeatured', value: 'true', left: 3 },
      { name: 'datePostedStart', value: '2026-01-01', left: 3 },
      { name: 'datePostedEnd', value: '2022-01-01', left: 4 },
      { name: 'displayNameContains', value: 'management plan', left: 2 },
    ],
  },
  {
    kind: 'updates',
    total: 10,
    filters: [
      { name: 'type', value: 'Amendment', left: 1 },
      { name: 'dateAddedStart', value: '2026-01-01', left: 4 },
      { name: 'dateAddedEnd', value: '2025-09-30', left: 3 },
      { name: 'hasDocumentUrl', value: 'true', left: 9 },
    ],
  },
  {
    kind: 'notifications',
    total: 8,
    filters: [
      { name: 'type', value: 'Mines', left: 1 },
      { name: 'region', value: 'Cariboo', left: 1 },
      { name: 'pcp', value: 'open', left: 2 },
      { name: 'decision', value: 'In Progress', left: 4 },
    ],
  },
];

for (const { kind, total, filters } of SENT) {
  test.describe(`${kind} filters`, () => {
    for (const { name, value, left } of filters) {
      test(`${name} narrows ${kind}`, () => {
        const answer = read(kind, `${name}=${encodeURIComponent(value)}&count=true`);
        expect(answer.rows).toHaveLength(left);
        expect(answer.total).toBe(left);
        expect(left).toBeLessThan(total);
      });
    }
  });
}

test('a List id selects the rows that carry the term it names', () => {
  // Option values are `List` ids (`toOptions`), so an id has to land on the rows of its term.
  const byId = read('documents', `projectPhaseId=${idOf('projectPhase', 'Post decision')}`);
  expect(byId.rows).toHaveLength(7);
  expect(byId.rows.every((row) => row['projectPhase'] === 'Post decision')).toBe(true);
});

test('repeated calls answer identically', () => {
  const once = read('documents', 'sort=-datePosted&pageSize=5');
  const twice = read('documents', 'sort=-datePosted&pageSize=5');
  expect(twice).toEqual(once);
});
