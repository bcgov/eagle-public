/**
 * A deterministic stand-in for demi-search, built from the design prototype's own sample data.
 *
 * The parity gate compares the built /search page against screenshots of the prototype, so the two
 * have to be looking at identical rows. This handler answers every read the page makes with the
 * fixtures under this folder, applying the same keyword, filter, sort and paging rules the
 * prototype applies in the browser.
 *
 * Wire shape comes from `src/app/api/api.ts`:
 *   GET <searchPath>/search?dataset=<name>&keywords=&pageNum=<0-based>&pageSize=&sortBy=&and[k]=v
 *   -> [ { searchResults: [...], meta: [ { searchResultsTotal: <n> } ] } ]
 * `rowsFrom`/`totalFrom` read exactly that envelope, and `search.ts#fetchData` reads the same.
 */
import type { Page, Route } from '@playwright/test';

import activities from './activities.json';
import documents from './documents.json';
import notifications from './notifications.json';
import projects from './projects.json';
import passages from './passages.json';

export type Row = Record<string, unknown>;

/** Every dataset name the unified page can ask for. */
export type Dataset =
  | 'Project'
  | 'Document'
  | 'RecentActivity'
  | 'ProjectNotification'
  | 'DocumentChunk'
  | 'List'
  | 'Organization';

const COLLATOR = new Intl.Collator('en-CA', { numeric: true, sensitivity: 'base' });

/** Ids are stable and derived from the fixture id, so a rerun produces byte-identical responses. */
function withId(row: Row, schemaName: string): Row {
  return { _id: String(row['id'] ?? ''), _schemaName: schemaName, ...row };
}

/** One row per indexed passage: the shape a content-scoped search returns. */
function chunkRows(): Row[] {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const rows: Row[] = [];
  for (const [documentId, hits] of Object.entries(
    passages as Record<string, { page: number; text: string }[]>,
  )) {
    const doc = byId.get(documentId);
    hits.forEach((hit, index) => {
      rows.push({
        _id: `${documentId}-p${hit.page}`,
        _schemaName: 'DocumentChunk',
        documentId,
        // The document's own metadata travels with the chunk so the row can render without a
        // second lookup, which is what demi-search does.
        name: doc?.name ?? documentId,
        date: doc?.date ?? '',
        type: doc?.type ?? '',
        ordinal: index,
        page: hit.page,
        text: hit.text,
      });
    });
  }
  return rows;
}

/**
 * `List` is the app's lookup collection: every dropdown resolves its option labels through it.
 * Each distinct fixture value becomes one row, with `type` naming the field it belongs to, which
 * is how `listsQueryOptions` consumers group them.
 */
function listRows(): Row[] {
  const sources: { type: string; values: string[] }[] = [
    { type: 'doctype', values: documents.map((d) => d.type) },
    { type: 'label', values: documents.map((d) => d.milestone) },
    { type: 'projectPhase', values: documents.map((d) => d.phase) },
    { type: 'author', values: documents.map((d) => d.author) },
    { type: 'region', values: projects.map((p) => p.region) },
    { type: 'type', values: projects.map((p) => p.type) },
    { type: 'activityKind', values: activities.map((a) => a.kind) },
    { type: 'notificationRegion', values: notifications.map((n) => n.region) },
    { type: 'notificationProjectType', values: notifications.map((n) => n.type) },
  ];

  const rows: Row[] = [];
  for (const source of sources) {
    const seen: string[] = [];
    for (const value of source.values) {
      if (value && !seen.includes(value)) seen.push(value);
    }
    // Sorted so the id sequence does not depend on fixture row order.
    for (const [index, name] of seen.sort(COLLATOR.compare).entries()) {
      rows.push({
        _id: `list-${source.type}-${index + 1}`,
        _schemaName: 'List',
        name,
        type: source.type,
      });
    }
  }
  return rows;
}

/** Proponents are an org collection in the app, not a free-text project field. */
function organizationRows(): Row[] {
  const seen: string[] = [];
  for (const project of projects) {
    if (!seen.includes(project.proponent)) seen.push(project.proponent);
  }
  return seen.sort(COLLATOR.compare).map((name, index) => ({
    _id: `org-${index + 1}`,
    _schemaName: 'Organization',
    name,
  }));
}

export function rowsFor(dataset: Dataset): Row[] {
  switch (dataset) {
    case 'Project':
      return projects.map((row) => withId(row, 'Project'));
    case 'Document':
      return documents.map((row) => withId(row, 'Document'));
    case 'RecentActivity':
      return activities.map((row) => withId(row, 'RecentActivity'));
    case 'ProjectNotification':
      return notifications.map((row) => withId(row, 'ProjectNotification'));
    case 'DocumentChunk':
      return chunkRows();
    case 'List':
      return listRows();
    case 'Organization':
      return organizationRows();
  }
}

/**
 * The prototype's rule, kept verbatim: a row matches when any string field other than its id
 * contains the term, case-insensitively. See `keywordHit` in Display Grid - Rebuild.dc.html.
 */
export function keywordHit(row: Row, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  return Object.keys(row).some(
    (key) =>
      key !== 'id' &&
      key !== '_id' &&
      key !== '_schemaName' &&
      typeof row[key] === 'string' &&
      (row[key] as string).toLowerCase().includes(needle),
  );
}

/** `and[k]=a,b` and repeated `and[k]=a&and[k]=b` both mean "a OR b"; separate keys are ANDed. */
export function filterGroups(params: URLSearchParams): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [rawKey, rawValue] of params.entries()) {
    const match = /^and\[(.+)]$/.exec(rawKey);
    if (!match) continue;
    const key = match[1] as string;
    const values = groups.get(key) ?? [];
    for (const value of rawValue.split(',')) {
      const trimmed = value.trim();
      if (trimmed) values.push(trimmed);
    }
    groups.set(key, values);
  }
  return groups;
}

function passesFilters(row: Row, groups: Map<string, string[]>): boolean {
  for (const [key, values] of groups) {
    const actual = row[key];
    const asText = typeof actual === 'boolean' ? String(actual) : String(actual ?? '');
    if (!values.some((value) => value.toLowerCase() === asText.toLowerCase())) return false;
  }
  return true;
}

/** `sortBy=-date` is descending, `+date`/`date` ascending. Ties fall through to the next key. */
export function sortRows(rows: Row[], sortKeys: string[]): Row[] {
  if (sortKeys.length === 0) return rows;
  return rows.slice().sort((a, b) => {
    for (const raw of sortKeys) {
      const direction = raw.startsWith('-') ? -1 : 1;
      const key = raw.replace(/^[+-]/, '');
      const compared = COLLATOR.compare(String(a[key] ?? ''), String(b[key] ?? '')) * direction;
      if (compared !== 0) return compared;
    }
    return 0;
  });
}

export interface SearchAnswer {
  searchResults: Row[];
  meta: { searchResultsTotal: number }[];
}

/** The whole query pipeline, exported so a unit test can drive it without a browser. */
export function answerSearch(params: URLSearchParams): SearchAnswer {
  const dataset = (params.get('dataset') ?? 'Document') as Dataset;
  const keywords = params.get('keywords') ?? '';
  const groups = filterGroups(params);
  // `searchKeywords` emits one `sortBy` per key, primary first.
  const sortKeys = params.getAll('sortBy').filter(Boolean);

  const matched = rowsFor(dataset)
    .filter((row) => keywordHit(row, keywords))
    .filter((row) => passesFilters(row, groups));
  const sorted = sortRows(matched, sortKeys);

  const pageSizeRaw = Number(params.get('pageSize'));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : sorted.length;
  const pageNumRaw = Number(params.get('pageNum'));
  // Already zero-based on the wire: `searchKeywords` subtracts one before it sends.
  const pageNum = Number.isFinite(pageNumRaw) && pageNumRaw > 0 ? pageNumRaw : 0;
  const start = pageNum * pageSize;

  return {
    searchResults: sorted.slice(start, start + pageSize),
    meta: [{ searchResultsTotal: sorted.length }],
  };
}

/** What `search/counts` answers when `datasets` is absent, per the endpoint's swagger. */
const DEFAULT_COUNT_DATASETS: Dataset[] = [
  'Project',
  'Document',
  'RecentActivity',
  'ProjectNotification',
];

const COUNTABLE = new Set<string>([
  ...DEFAULT_COUNT_DATASETS,
  'DocumentChunk',
  'List',
  'Organization',
]);

export interface CountsAnswer {
  counts: Record<string, number | null>;
  meta: [{ unavailable: string[]; degraded: string[]; cached: boolean }];
}

/**
 * Per-record-type totals for one query, which is what the record-type tabs show.
 *
 * Shaped to eagle-demi's `GET /api/search/counts`: a one-element array of `{counts, meta}`, one
 * entry per requested type, and `null` rather than 0 for a type this backend cannot measure, with
 * that type named under `meta[0].unavailable`. The fixtures answer every leg from the same rows
 * `search` uses, so nothing here is ever degraded or cached. The query is read from `keywords`,
 * falling back to `q`, and the record types from `datasets`. `prefix` is accepted and ignored: the
 * prototype matches on substring either way, so it cannot change a fixture count.
 */
export function answerCounts(params: URLSearchParams): [CountsAnswer] {
  const keywords = params.get('keywords') ?? params.get('q') ?? '';
  const groups = filterGroups(params);
  const requested = (params.get('datasets') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const datasets = requested.length > 0 ? requested : [...DEFAULT_COUNT_DATASETS];

  const counts: Record<string, number | null> = {};
  const unavailable: string[] = [];
  for (const name of datasets) {
    if (!COUNTABLE.has(name)) {
      counts[name] = null;
      unavailable.push(name);
      continue;
    }
    counts[name] = rowsFor(name as Dataset)
      .filter((row) => keywordHit(row, keywords))
      .filter((row) => passesFilters(row, groups)).length;
  }

  return [{ counts, meta: [{ unavailable, degraded: [], cached: false }] }];
}

/** Runtime config the app reads before it renders anything. */
export const CONFIG = {
  ENVIRONMENT: 'parity',
  SEARCH_API_PATH: '/demi-search',
  ACCESS_GATE: false,
  DEBUG_MODE: false,
  GH_HASH: 'parity',
};

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  });
}

/**
 * Installs the handler. Every /demi-search read is answered from fixtures; nothing leaves the box.
 * An unrecognised path 404s loudly rather than falling through to the network, so a new call the
 * page starts making shows up as a test failure instead of a silent live request.
 */
export async function routeDemiSearch(page: Page): Promise<void> {
  await page.route('**/demi-search/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/.*\/demi-search\//, '');

    if (path === 'config' || path.endsWith('/config')) return json(route, CONFIG);
    if (path === 'search/counts') return json(route, answerCounts(url.searchParams));
    if (path === 'search') return json(route, [answerSearch(url.searchParams)]);

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `parity fixtures do not answer /demi-search/${path}` }),
    });
  });
}
