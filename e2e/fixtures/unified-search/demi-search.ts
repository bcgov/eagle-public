/**
 * A deterministic stand-in for DEMI's native list routes, built from the design prototype's own
 * sample data.
 *
 * The parity gate compares the built /search page against screenshots of the prototype, so the two
 * have to be looking at identical rows. This handler answers every read the page makes with the
 * fixtures under this folder, applying the keyword, filter, sort and paging rules of the native
 * list contract (eagle-demi `helpers/native-query.js`):
 *   GET <DEMI_API_PATH>/<kind>?page=<1-based>&pageSize=&count=true&sort=[-]field&q=&<filter>=v
 *   -> [...rows], x-total-count: <n> when `count=true`
 * A parameter the kind does not take answers 400, as DEMI does, so a misnamed filter fails here.
 *
 * The JSON fixtures keep the prototype's Eagle-shaped rows; each kind maps them to the native row
 * DEMI answers with.
 */
import type { Page, Route } from '@playwright/test';

import activities from './activities.json';
import chunks from './chunks.json';
import documents from './documents.json';
import notifications from './notifications.json';
import projects from './projects.json';

export type Row = Record<string, unknown>;

const COLLATOR = new Intl.Collator('en-CA', { numeric: true, sensitivity: 'base' });

/** Azure AI Search hands back its hits wrapped in `<mark>`, and DEMI passes those through. */
function marked(snippet: string, keywords: string): string {
  const needle = keywords.trim();
  if (!needle) return snippet;
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return snippet.replace(pattern, (hit) => `<mark>${hit}</mark>`);
}

/**
 * `List` is the app's lookup collection: every dropdown resolves its option labels through it.
 * Each distinct fixture value becomes one native row, with `type` naming the field it belongs to,
 * which is how `listsQueryOptions` consumers group them.
 */
export function listRows(): Row[] {
  // `legislation` rides along on the document-type rows, which is where the documents tab reads
  // the Acts its Legislation filter offers.
  const legislationByType = new Map(documents.map((d) => [d.type, d.legislation]));
  const sources: { type: string; values: string[]; legislation?: boolean }[] = [
    { type: 'doctype', values: documents.map((d) => d.type), legislation: true },
    { type: 'label', values: documents.map((d) => d.milestone) },
    {
      type: 'projectPhase',
      values: [...documents.map((d) => d.projectPhase), ...projects.map((p) => p.currentPhaseName)],
    },
    { type: 'author', values: documents.map((d) => d.documentAuthorType) },
    { type: 'eaDecisions', values: projects.map((p) => p.eacDecision) },
    { type: 'ceaaInvolvements', values: projects.map((p) => p.CEAAInvolvement) },
    { type: 'region', values: projects.map((p) => p.region) },
    { type: 'type', values: projects.map((p) => p.type) },
    { type: 'activityKind', values: activities.map((a) => a.type) },
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
        id: `list-${source.type}-${index + 1}`,
        kind: 'List',
        name,
        type: source.type,
        ...(source.legislation ? { legislation: legislationByType.get(name) } : {}),
      });
    }
  }
  return rows;
}

/** Proponents are an org collection in the app, not a free-text project field. */
function organizationRows(): Row[] {
  const byId = new Map(projects.map((project) => [project.proponent._id, project.proponent.name]));
  return [...byId.entries()]
    .sort((a, b) => COLLATOR.compare(a[1], b[1]))
    .map(([id, name]) => ({ id, name, companyType: 'Proponent/Certificate Holder' }));
}

let listIds: Map<string, string> | null = null;
/** The `List` id a fixture value of one `List` type resolves to. */
function listId(type: string, name: string): string | undefined {
  listIds ??= new Map(
    listRows().map((row): [string, string] => [`${row['type']}:${row['name']}`, String(row['id'])]),
  );
  return listIds.get(`${type}:${name}`);
}

/** A `List` ref as DEMI stores one on a project: `{_id, name}`, or null for no value. */
function listRef(type: string, name: string): Row | null {
  return name ? { _id: listId(type, name), name } : null;
}

/** DEMI's own project id is the Track id; fixture projects have none, so one is made up. */
function trackId(eagleId: string): string {
  return `track-${eagleId}`;
}

/** A fixture row as the native kind answers it. */
interface NativeKind {
  source: () => Row[];
  toNative: (row: Row) => Row;
  /** Query name -> row field. */
  filters: Record<string, string>;
  /** Filters that take a repeated value; any other repeated parameter is a 400. */
  multi?: string[];
  /** `<name>` -> the row field a `ge`/`le` day bound applies to. */
  ranges?: Record<string, { field: string; op: 'ge' | 'le' }>;
  sorts: string[];
  /** Whether `q` is taken; `required` refuses a read without one. */
  q: boolean | 'required';
}

const ID_FILTERS = ['typeId', 'milestoneId', 'projectPhaseId', 'documentAuthorTypeId'];

const KINDS: Record<string, NativeKind> = {
  projects: {
    source: () => projects,
    toNative: (row) => {
      const p = row as (typeof projects)[number];
      return {
        id: trackId(p._id),
        eagleId: p._id,
        name: p.name,
        dateUpdated: p.dateUpdated,
        proponentId: p.proponent._id,
        proponentName: p.proponent.name,
        projectType: p.type,
        region: p.region,
        currentPhaseName: listRef('projectPhase', p.currentPhaseName),
        eacDecision: listRef('eaDecisions', p.eacDecision),
        CEAAInvolvement: listRef('ceaaInvolvements', p.CEAAInvolvement),
      };
    },
    filters: Object.fromEntries(
      [
        'projectType',
        'region',
        'proponentName',
        'currentPhaseName',
        'eacDecision',
        'CEAAInvolvement',
      ].map((name) => [name, name]),
    ),
    multi: [
      'projectType',
      'region',
      'proponentName',
      'currentPhaseName',
      'eacDecision',
      'CEAAInvolvement',
    ],
    ranges: {
      decisionDateStart: { field: 'decisionDate', op: 'ge' },
      decisionDateEnd: { field: 'decisionDate', op: 'le' },
    },
    sorts: ['name'],
    q: true,
  },
  documents: {
    source: () => documents,
    toNative: (row) => {
      const d = row as (typeof documents)[number];
      return {
        id: d._id,
        projectId: trackId(d.project._id),
        projectEagleId: d.project._id,
        projectName: d.project.name,
        displayName: d.displayName,
        datePosted: d.datePosted,
        type: d.type,
        typeId: listId('doctype', d.type),
        milestone: d.milestone,
        milestoneId: listId('label', d.milestone),
        projectPhase: d.projectPhase,
        projectPhaseId: listId('projectPhase', d.projectPhase),
        documentAuthorType: d.documentAuthorType,
        documentAuthorTypeId: listId('author', d.documentAuthorType),
        legislation: d.legislation,
        isFeatured: d.isFeatured,
      };
    },
    filters: Object.fromEntries(
      [...ID_FILTERS, 'isFeatured', 'legislation'].map((name) => [name, name]),
    ),
    multi: [...ID_FILTERS, 'legislation'],
    ranges: {
      datePostedStart: { field: 'datePosted', op: 'ge' },
      datePostedEnd: { field: 'datePosted', op: 'le' },
    },
    sorts: ['datePosted', 'displayName'],
    q: true,
  },
  'documents/passages': {
    source: () => chunks,
    toNative: (row) => {
      const c = row as (typeof chunks)[number];
      const document = documents.find((d) => d._id === c.documentId);
      return {
        id: c.chunkId,
        documentId: c.documentId,
        projectId: trackId(c.project._id),
        pageNumber: c.pageNumber,
        pageNumbered: Number.isInteger(c.pageNumber),
        snippet: c.snippet,
        // The parent's facets, stamped on every chunk; the API filters on them but does not send them.
        typeId: document && listId('doctype', document.type),
        milestoneId: document && listId('label', document.milestone),
        projectPhaseId: document && listId('projectPhase', document.projectPhase),
        documentAuthorTypeId: document && listId('author', document.documentAuthorType),
      };
    },
    filters: Object.fromEntries(['documentId', ...ID_FILTERS].map((name) => [name, name])),
    multi: ID_FILTERS,
    sorts: [],
    q: 'required',
  },
  updates: {
    source: () => activities,
    toNative: (row) => {
      const u = row as (typeof activities)[number];
      return {
        id: u._id,
        headline: u.headline,
        content: u.content,
        dateAdded: u.dateAdded,
        type: u.type,
        documentUrl: u.documentUrl,
        projectId: u.project?._id ?? null,
        projectEagleId: u.project?._id,
        projectName: u.project?.name,
      };
    },
    filters: { type: 'type', project: 'projectId' },
    multi: ['type'],
    sorts: ['dateAdded', 'dateUpdated', 'publishDate'],
    q: true,
  },
  notifications: {
    source: () => notifications,
    toNative: ({ _id, ...rest }) => ({ id: _id, ...rest }),
    filters: { type: 'type', region: 'region', pcp: 'pcp', decision: 'decision' },
    sorts: ['notificationReceivedDate', 'name'],
    q: true,
  },
  // A notification card looks up its own comment periods. The prototype has none.
  'comment-periods': {
    source: () => [],
    toNative: (row) => row,
    filters: { project: 'projectId', status: 'status' },
    multi: ['status'],
    sorts: ['dateStarted', 'dateCompleted'],
    q: false,
  },
  lists: { source: listRows, toNative: (row) => row, filters: {}, sorts: [], q: false },
  organizations: {
    source: organizationRows,
    toNative: (row) => row,
    filters: { companyType: 'companyType' },
    multi: ['companyType'],
    sorts: ['name'],
    q: false,
  },
};

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
      typeof row[key] === 'string' &&
      (row[key] as string).toLowerCase().includes(needle),
  );
}

/**
 * The label a dropdown value stands for, so an option's `List` or `Organization` id and the label
 * it names select the same rows.
 */
let optionLabels: Map<string, string> | null = null;
function labelFor(value: string): string | undefined {
  optionLabels ??= new Map([
    ...listRows().map((row): [string, string] => [String(row['id']), String(row['name'])]),
    ...organizationRows().map((row): [string, string] => [String(row['id']), String(row['name'])]),
  ]);
  return optionLabels.get(value);
}

/** What a filter compares against: a `List` ref answers with its own `_id`. */
function comparableText(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; name?: unknown };
    return String(record._id ?? record.name ?? '');
  }
  return typeof value === 'boolean' ? String(value) : String(value ?? '');
}

/** A `List` ref matches by its id or its name, as a value matches by itself or its label. */
function passesFilter(row: Row, field: string, values: string[]): boolean {
  const stored = row[field];
  const held = [comparableText(stored)];
  if (stored && typeof stored === 'object') held.push(String((stored as Row)['name'] ?? ''));
  const texts = held.map((text) => text.toLowerCase());
  return values.some((value) => {
    const label = labelFor(value);
    return texts.includes(value.toLowerCase()) || (!!label && texts.includes(label.toLowerCase()));
  });
}

/** The record's display name, whatever its kind calls it: the prototype's `row.name`. */
function nameOf(row: Row): string {
  return String(row['displayName'] ?? row['name'] ?? row['headline'] ?? '');
}

/**
 * `-date` is descending, `date` ascending. Ties fall to the name, flipped with the key: the
 * prototype breaks a tied date the same way, so a descending date puts "Volume 10 of 9" above
 * "Volume 2". No key keeps the source order, which stands in for relevance.
 */
export function sortRows(rows: Row[], sort: string | null): Row[] {
  if (!sort) return rows;
  const direction = sort.startsWith('-') ? -1 : 1;
  const key = sort.replace(/^[+-]/, '');
  // A field no fixture row carries (notifications have no received date) keeps the stored order.
  if (!rows.some((row) => row[key] != null)) return rows;
  return rows.slice().sort((a, b) => {
    const compared = COLLATOR.compare(String(a[key] ?? ''), String(b[key] ?? '')) * direction;
    return compared !== 0 ? compared : COLLATOR.compare(nameOf(a), nameOf(b)) * direction;
  });
}

const CONTROL_PARAMS = ['page', 'pageSize', 'count', 'sort', 'q', 'ids'];

export type NativeAnswer = { rows: Row[]; total?: number } | { status: 400; error: string };

/**
 * One page of a native `GET /<kind>`, and the total DEMI puts in `x-total-count` when asked to
 * count. `undefined` for a kind the fixtures do not hold.
 */
export function answerNative(kind: string, params: URLSearchParams): NativeAnswer | undefined {
  const spec = KINDS[kind];
  if (!spec) return undefined;
  for (const name of new Set(params.keys())) {
    if (!CONTROL_PARAMS.includes(name) && !(name in spec.filters) && !spec.ranges?.[name]) {
      return { status: 400, error: `unknown parameter: ${name}` };
    }
    const repeated = params.getAll(name).length > 1;
    if (repeated && !spec.multi?.includes(spec.filters[name] ?? name)) {
      return { status: 400, error: `parameter given more than once: ${name}` };
    }
  }
  const sort = params.get('sort');
  if (sort && !spec.sorts.includes(sort.replace(/^[+-]/, ''))) {
    return { status: 400, error: `cannot sort on: ${sort}` };
  }
  const q = params.get('q')?.trim() ?? '';
  if (q && !spec.q) return { status: 400, error: 'q is not supported on this list' };
  if (!q && spec.q === 'required') return { status: 400, error: 'q is required' };

  const ids = params.get('ids')?.split(',');
  let rows = spec
    .source()
    .filter((row) => keywordHit(row, q))
    .map(spec.toNative)
    .filter((row) => !ids || ids.includes(String(row['id'])));
  for (const [name, field] of Object.entries(spec.filters)) {
    const values = params.getAll(name);
    if (values.length > 0) rows = rows.filter((row) => passesFilter(row, field, values));
  }
  for (const [name, { field, op }] of Object.entries(spec.ranges ?? {})) {
    const day = params.get(name);
    if (!day) continue;
    // ISO dates, so a string comparison is a date comparison.
    rows = rows.filter((row) => {
      const actual = comparableText(row[field]).slice(0, 10);
      return op === 'ge' ? actual >= day : actual <= day;
    });
  }
  const sorted = sortRows(rows, sort);

  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 100);
  const shown = sorted
    .slice((page - 1) * pageSize, page * pageSize)
    .map((row) =>
      kind === 'documents/passages' ? { ...row, snippet: marked(String(row['snippet']), q) } : row,
    );
  return params.get('count') === 'true' ? { rows: shown, total: sorted.length } : { rows: shown };
}

/** `GET /counts?kind=projects,documents&q=`: each kind's list total, as a plain object. */
export function answerCounts(params: URLSearchParams): Record<string, number> {
  const kinds = (params.get('kind') ?? 'projects,documents').split(',');
  const query = new URLSearchParams(params);
  query.delete('kind');
  query.set('count', 'true');
  const counts: Record<string, number> = {};
  for (const kind of kinds) {
    const answer = answerNative(kind, query);
    counts[kind] = answer && 'total' in answer ? (answer.total ?? 0) : 0;
  }
  return counts;
}

/** Runtime config the app reads before it renders anything. */
export const CONFIG = {
  ENVIRONMENT: 'parity',
  SEARCH_API_PATH: '/demi-search',
  ACCESS_GATE: false,
  // The prototype searches inside documents, so the scope switch has to be offered here too.
  CONTENT_SEARCH: true,
  DEBUG_MODE: false,
  GH_HASH: 'parity',
};

function json(route: Route, body: unknown, headers: Record<string, string> = {}, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store', ...headers },
    body: JSON.stringify(body),
  });
}

/**
 * Installs the handlers. The runtime config and every native read are answered from fixtures;
 * nothing leaves the box. An unrecognised path 404s loudly rather than falling through to the
 * network, so a new call the page starts making shows up as a test failure instead of a silent
 * live request.
 */
export async function routeDemiSearch(page: Page): Promise<void> {
  await page.route('**/demi-search/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/.*\/demi-search\//, '');
    if (path === 'config' || path.endsWith('/config')) return json(route, CONFIG);
    // The home page reads its uploads panel here once the native projects answer; the prototype has none.
    if (path === 'documents/recent-uploads') return json(route, []);
    return json(route, { error: `parity fixtures do not answer /demi-search/${path}` }, {}, 404);
  });
  await page.route('**/demi/api/**', async (route) => {
    const url = new URL(route.request().url());
    const kind = url.pathname.replace(/.*\/demi\/api\//, '');
    if (kind === 'counts') return json(route, answerCounts(url.searchParams));
    const answer = answerNative(kind, url.searchParams);
    if (!answer) {
      return json(route, { error: `parity fixtures do not answer /demi/api/${kind}` }, {}, 404);
    }
    if ('status' in answer) return json(route, { error: answer.error }, {}, answer.status);
    const headers: Record<string, string> =
      answer.total === undefined ? {} : { 'x-total-count': String(answer.total) };
    return json(route, answer.rows, headers);
  });
}
