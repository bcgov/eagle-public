import type { CommentPeriod } from 'app/models/commentperiod';
import type { Document } from 'app/models/document';
import type { ISearchResult, SearchResults } from 'app/models/search';
import type { Org } from 'app/models/organization';
import { encodeString } from 'app/utils/utils';
import { logger } from 'app/config/logging';
import { getDemiProjectsPath, getSearchApiPath } from 'app/config/config';
import { queryClient } from './query-client';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
  ) {
    super(`${status} - ${statusText}`);
    this.name = 'ApiError';
  }
}

/** Base URL for search and for every other read: demi-search answers all of them. */
export function searchPath(): string {
  return getSearchApiPath();
}

/** Base URL for the single-project DEMI document, without a trailing slash. */
export function demiProjectsPath(): string {
  return getDemiProjectsPath();
}

/**
 * A `List` row as the project document points at one. DEMI stores these fields as bare `List` ids
 * and eagle-api populates them into rows, so the reader has to accept either.
 */
export interface ListRef {
  _id?: string;
  name?: string;
  type?: string;
  legislation?: number;
}

/**
 * The DEMI project document, as far as the public app reads it. Everything else on the document is
 * passed through untouched and ignored, hence the index signature.
 */
export interface DemiProject {
  /** The Eagle Mongo `_id`. DEMI's own `id` is the Track project id and means nothing here. */
  eagleId?: string;
  _id?: string;
  name?: string;
  description?: string;
  /** Track's spelling of eagle-api's `type`, `status` and `location`. */
  projectType?: string;
  projectState?: string;
  address?: string;
  /** When DEMI last synced the document, NOT Eagle's `dateUpdated`. */
  updatedAt?: string;
  /** Eagle's own last-modified date, mirrored by DEMI. */
  dateUpdated?: string;
  region?: string;
  provElecDist?: string;
  sector?: string;
  /** GeoJSON `{type, coordinates}`, where eagle-api answers a bare `[lon, lat]`. */
  centroid?: { coordinates?: number[] } | number[];
  legislation?: string;
  build?: string;
  code?: string;
  substitution?: boolean;
  overallProgress?: number;
  eaoMember?: string;
  dateAdded?: string;
  decisionDate?: string;
  /**
   * `eacDecision`, `currentPhaseName` and `CEAAInvolvement` arrive as bare `List` ids from DEMI
   * today and as populated rows from eagle-api, so the mapper resolves the id form against the
   * `List` rows the page already holds.
   */
  eacDecision?: string | ListRef;
  applicableRegulation?: unknown;
  currentPhaseName?: string | ListRef;
  phaseHistory?: unknown[];
  CEAAInvolvement?: string | ListRef;
  CEAALink?: string;
  projectLead?: string;
  projectLeadEmail?: string;
  projectLeadPhone?: string;
  responsibleEPD?: string;
  responsibleEPDEmail?: string;
  responsibleEPDPhone?: string;
  /** The proponent as two scalars, where eagle-api populates the whole Organization. */
  proponentId?: string;
  proponentName?: string;
  phases?: unknown[];
  shortUrl?: string;
  /** EA certificate number, e.g. `E23-01`. No source has the conditions count it carries. */
  eaCertificate?: string;
  /** Pinned Indigenous Nations, `{_id, name, province}` rows. Public per project, not per Nation. */
  pins?: { _id?: string; name?: string; province?: string }[];
  [field: string]: unknown;
}

/**
 * Query options for the single-project DEMI fetch, shared by every consumer that needs a field off
 * that document (the project record itself, phase dates, pins, the short link, …) so they collapse
 * onto one request via the shared query key. An unset DEMI_PROJECTS_PATH asks for nothing.
 */
export function demiProjectQueryOptions(projId: string) {
  const base = demiProjectsPath();
  return {
    queryKey: ['demi-project', projId],
    enabled: !!base && !!projId,
    retry: false,
    queryFn: async (): Promise<DemiProject | null> => {
      try {
        return await getJson<DemiProject>(`${base}/${encodeURIComponent(projId)}`, {
          quiet404: true,
        });
      } catch (err) {
        // 404 means DEMI has no record for this project — an answer, not a failure.
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}

/**
 * The DEMI project document for a plain (non-hook) caller, through the app's own query cache so it
 * shares the one request the hooks already make for the same project. `null` when DEMI has no
 * record for it.
 */
export async function getDemiProject(projId: string): Promise<DemiProject | null> {
  return queryClient.fetchQuery(demiProjectQueryOptions(projId));
}

/**
 * Rows out of the `[{ searchResults, meta }]` envelope `/search` answers with.
 * `searchKeywords` is declared as returning that envelope, not the rows, so every caller that
 * wants a plain array unwraps it here rather than reaching through `any`.
 */
function rowsFrom<T>(envelope: unknown): T[] {
  return (envelope as ISearchResult<T>[] | undefined)?.[0]?.searchResults ?? [];
}

/** How many rows match, ignoring paging. `null` when the backend did not count. */
function totalFrom(envelope: unknown): number | null {
  const total = (envelope as ISearchResult<unknown>[] | undefined)?.[0]?.meta?.[0]
    ?.searchResultsTotal;
  return typeof total === 'number' ? total : null;
}

/**
 * Drops every key but `fields`. `/search` ignores `fields=` and answers the whole stored record, so
 * the projection the bespoke eagle-api routes used to do happens on this side instead.
 */
function pickFields<T>(row: unknown, fields: string[]): T {
  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).filter(([field]) => fields.includes(field)),
  ) as unknown as T;
}

async function send(
  url: string,
  init: RequestInit = {},
  quietStatuses: number[] = [],
): Promise<Response> {
  const method = init.method ?? 'GET';
  logger.logHttpRequest(method, url, 'api');

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    logger.logHttpError(method, url, error, 'api');
    throw error;
  }

  if (!quietStatuses.includes(response.status)) {
    logger.logHttpResponse(method, url, response.status, undefined, 'api');
  }
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
  return response;
}

/**
 * `quiet404`: skip the error log (and telemetry) for a 404 an expected/off-switch caller already
 * handles. `signal`: let the caller drop a request it no longer wants, e.g. a search superseded by
 * the next keystroke.
 */
export async function getJson<T>(
  url: string,
  options?: { quiet404?: boolean; signal?: AbortSignal },
): Promise<T> {
  return (
    await send(url, { signal: options?.signal }, options?.quiet404 ? [404] : [])
  ).json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await send(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

//
// Bulk download (demi-api). Rides the search base path.
//

/** One document: demi-api answers 200 with a presigned URL instead of queueing a job. */
export interface BulkDownloadSingle {
  url: string;
  expiresIn: number;
  fileName: string;
  displayName: string;
  single: true;
}

/** Two or more documents: 202 and a job to poll. */
export interface BulkDownloadAccepted {
  id: string;
  status: string;
  documentCount: number;
  estimatedPartCount: number;
  statusUrl: string;
}

export interface BulkDownloadPart {
  n: number;
  url: string;
  fileName: string;
  bytes: number;
  count: number;
}

export interface BulkDownloadError {
  documentId: string;
  name: string;
  reason: string;
}

export interface BulkDownloadStatus {
  id: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'expired' | 'cancelled';
  documentCount: number;
  partCount: number;
  partsReady: number;
  includedCount: number;
  errorCount: number;
  errors: BulkDownloadError[];
  bytes?: number;
  parts?: BulkDownloadPart[];
}

export async function createBulkDownload(
  documentIds: string[],
): Promise<BulkDownloadSingle | BulkDownloadAccepted> {
  return postJson(`${searchPath()}/bulk-downloads`, { documentIds });
}

export async function getBulkDownload(id: string): Promise<BulkDownloadStatus> {
  return getJson(`${searchPath()}/bulk-downloads/${id}`);
}

/** `keepalive` lets the request outlive the page, so a cancel sent while unloading still arrives. */
export async function cancelBulkDownload(id: string, keepalive = false): Promise<void> {
  await send(`${searchPath()}/bulk-downloads/${id}`, { method: 'DELETE', keepalive });
}

//
// Searching
//
export async function searchKeywords(
  keys: string,
  dataset: string,
  fields: any[],
  // Null on either means "no paging parameter", which the body has always honoured.
  pageNum: number | null,
  pageSize: number | null,
  projectLegislation = '',
  sortBy: string | null = null,
  queryModifier: Record<string, string> = {},
  populate = false,
  secondarySort: string | null = null,
  filter: Record<string, string> = {},
  fuzzy = false,
  signal?: AbortSignal,
): Promise<SearchResults[]> {
  logger.debug(`api.searchKeywords called with keys: ${keys}`, 'api', { filter });

  projectLegislation = projectLegislation === '' ? 'default' : projectLegislation;
  let queryString = `search?dataset=${dataset}`;
  if (fields && fields.length > 0) {
    fields.forEach((item) => {
      queryString += `&${item.name}=${item.value}`;
    });
  }
  if (keys) {
    queryString += `&keywords=${keys}`;
  }
  if (pageNum !== null) {
    queryString += `&pageNum=${pageNum - 1}`;
  }
  if (pageSize !== null) {
    queryString += `&pageSize=${pageSize}`;
  }
  if (projectLegislation !== '') {
    queryString += `&projectLegislation=${projectLegislation}`;
  }
  if (sortBy !== null) {
    queryString += `&sortBy=${sortBy}`;
  }
  if (secondarySort !== null) {
    queryString += `&sortBy=${secondarySort}`;
  }
  queryString += `&populate=${populate}`;
  Object.keys(queryModifier).forEach((key: string) => {
    queryModifier[key].split(',').forEach((item: string) => {
      queryString += `&and[${key}]=${item}`;
    });
  });
  let safeItem: string;
  Object.keys(filter).map((key: string) => {
    filter[key].split(',').map((item: string) => {
      if (item.includes('&')) {
        safeItem = encodeString(item, true);
      } else {
        safeItem = item;
      }
      queryString += `&and[${key}]=${safeItem}`;
    });
  });
  // No `&fields=`: demi-search does not read it on /search, and accepts it only to keep saved URLs
  // out of its unknown-parameter 400. Angular sent `fields=[object Object]` here because `fields`
  // holds `{name, value}` pairs, already emitted above as `&name=value`.
  queryString += '&fuzzy=' + fuzzy;

  const fullUrl = `${searchPath()}/${queryString}`;
  logger.trace(`API call URL: ${fullUrl}`, 'api');

  return getJson<SearchResults[]>(fullUrl, { signal });
}

/** One page holds every row of these small collections; callers need all of them at once. */
const ALL_ROWS_PAGE_SIZE = 250;

/** Dropdown/filter list items, lazily fetched and cached by TanStack Query. */
export function listsQueryOptions() {
  return {
    queryKey: ['lists'],
    queryFn: async (): Promise<any[]> => {
      return rowsFrom(
        await getJson<unknown>(
          `${searchPath()}/search?pageSize=${ALL_ROWS_PAGE_SIZE}&dataset=List`,
        ),
      );
    },
  };
}

//
// Projects
//
/**
 * One page of a project's pinned Indigenous Nations, in the `[{total_items, results}]` envelope the
 * page reads.
 *
 * DEMI carries the rows on the project document (`{_id, name, province}`, published per project by
 * its `pinsRead[]`), so this reads them off the one shared document rather than making a second
 * round trip. Sorting and paging happen here, because a stored array arrives in whatever order
 * Mongo held it. No document, or a document with no pins, means no pins and an absent card.
 */
export async function getProjectPins(
  id: string,
  pageNum: number,
  pageSize: number,
  sortBy: any,
): Promise<Org> {
  const doc = await getDemiProject(id);
  const pins = [...(doc?.pins ?? [])];
  if (sortBy === '+name' || sortBy === '-name') {
    const direction = sortBy === '-name' ? -1 : 1;
    pins.sort((a, b) => direction * (a.name ?? '').localeCompare(b.name ?? ''));
  }
  const from = pageNum !== null && pageSize !== null ? (pageNum - 1) * pageSize : 0;
  const page = pageSize !== null ? pins.slice(from, from + pageSize) : pins;
  return [{ total_items: pins.length, results: page }] as unknown as Org;
}

// Organizations

/** demi-search 400s above 500 rows on a filtered search, and this query is always filtered. */
const ORGS_PAGE_SIZE = 500;

/** Every organization of one company type, for the proponent filter dropdown. */
export async function getOrgsByCompanyType(type: string): Promise<Org[]> {
  const orgs: Org[] = [];
  for (let pageNum = 1; ; pageNum++) {
    const envelope = await searchKeywords(
      '',
      'Organization',
      [],
      pageNum,
      ORGS_PAGE_SIZE,
      '',
      '+name',
      {
        companyType: type,
      },
    );
    const rows = rowsFrom<Org>(envelope);
    orgs.push(...rows);
    // A short page means the last one.
    if (rows.length < ORGS_PAGE_SIZE) {
      return orgs;
    }
  }
}

//
// Comment Periods
//
/**
 * The fields the engagement cards have always been given. `/search` ignores `fields=`, so the
 * projection the old `/commentperiod` route did happens here: the full record also carries
 * `additionalText`, which the cards would otherwise show in place of the description they derive
 * from the instructions.
 */
const PERIOD_LIST_FIELDS = [
  '_id',
  'project',
  'dateStarted',
  'dateCompleted',
  'instructions',
  'isMet',
  'metURL',
  // Only the overview banner draws this, and only for a MET period; the cards ignore it.
  'metBannerImageUrl',
  'informationLabel',
];

/**
 * Every comment period of one project, newest first, read as `and[project]`. A project has
 * single-digit comment periods, hence the one page.
 */
export async function getPeriodsByProjId(projId: string): Promise<CommentPeriod[]> {
  const envelope = await searchKeywords(
    '',
    'CommentPeriod',
    [],
    1,
    ALL_ROWS_PAGE_SIZE,
    '',
    '-dateStarted',
    { project: projId },
  );
  return rowsFrom<Record<string, unknown>>(envelope).map((period) =>
    pickFields<CommentPeriod>(period, PERIOD_LIST_FIELDS),
  );
}

/**
 * The fields the old `/commentperiod/{id}` route projected for the details page, plus `_id`, less
 * `commentTip`, which only the removed comment form showed.
 * The stored record also carries the admin and role fields (`metURLAdmin`, `classificationRoles`,
 * `commenterRoles`, `downloadRoles`, ...), which nothing on the page reads and which have no
 * business reaching it.
 */
const PERIOD_DETAIL_FIELDS = [
  '_id',
  'additionalText',
  'dateCompleted',
  'dateStarted',
  'informationLabel',
  'instructions',
  'openHouses',
  'project',
  'relatedDocuments',
];

/** One comment period, filtered as `and[_id]`: a bare `_id` is not read as a filter. */
export async function getPeriod(id: string): Promise<CommentPeriod[]> {
  const envelope = await searchKeywords('', 'CommentPeriod', [], 1, 1, '', null, { _id: id });
  return rowsFrom<Record<string, unknown>>(envelope).map((period) =>
    pickFields<CommentPeriod>(period, PERIOD_DETAIL_FIELDS),
  );
}

//
// Comments
//
/** Newest comment first, the order the comments table has always shown. */
const COMMENTS_SORT = '-commentId';

/** One page of comments plus how many there are in total, whichever backend answered. */
export interface CommentPage {
  comments: any[];
  totalCount: number | null;
}

/**
 * One page of a comment period's comments, newest first.
 *
 * `pageNum` is zero-based here, where `searchKeywords` takes it one-based. The total always comes
 * back: demi-search counts into the envelope's `meta` whether or not it was asked to.
 */
export async function getCommentsByPeriodId(
  pageNum: number | null,
  pageSize: number | null,
  periodId: string,
): Promise<CommentPage> {
  const envelope = await searchKeywords(
    '',
    'Comment',
    [],
    pageNum === null ? null : pageNum + 1,
    pageSize,
    '',
    COMMENTS_SORT,
    { period: periodId },
  );
  return { comments: rowsFrom(envelope), totalCount: totalFrom(envelope) };
}

//
// Documents
//
export async function getDocumentsByMultiId(ids: string[]): Promise<Document[]> {
  const fields = [
    'eaoStatus',
    'internalOriginalName',
    'documentFileName',
    'labels',
    'internalOriginalName',
    'displayName',
    'documentType',
    'datePosted',
    'dateUploaded',
    'dateReceived',
    'documentFileSize',
    'documentSource',
    'internalURL',
    'internalMime',
    'checkbox',
    'project',
    'type',
    'documentAuthor',
    'documentAuthorType',
    'milestone',
    'description',
    'isPublished',
    'isFeatured',
  ];
  // demi-search reads `docIds` bare rather than as `and[docIds]`, and takes a pipe-separated list.
  // A present-but-empty value matches nothing there, which is what an empty `ids` means here too.
  // It goes through the `fields` argument because that is the only one `searchKeywords` emits as a
  // plain parameter.
  const envelope = await searchKeywords(
    '',
    'Document',
    [{ name: 'docIds', value: buildValues(ids) }],
    1,
    Math.max(ids.length, 1),
  );
  // `_id` is not in `fields`, because it is answered whether or not it is asked for and every
  // caller keys documents by it.
  return rowsFrom<Document>(envelope).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    return pickFields<Document>(
      {
        ...record,
        // The demi-search index holds no `internalOriginalName`, and it is the only label the
        // comment attachment list renders.
        internalOriginalName:
          record['internalOriginalName'] ?? record['documentFileName'] ?? record['displayName'],
      } as unknown as Document,
      ['_id', ...fields],
    );
  });
}

/**
 * Checks the shared access password. Resolves when accepted; throws ApiError 401 when not.
 *
 * A 404 throws like any other failure. The curtain renders only where the config says
 * `ACCESS_GATE: true`, so a backend with no gate route is a broken deployment, and resolving there
 * would open a site that asked to be closed.
 */
export async function checkGatePassword(password: string): Promise<void> {
  await send(`${searchPath()}/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

/** How many items the home strip shows. */
const TOP_NEWS_PAGE_SIZE = 4;

/**
 * The home page's top-news strip.
 *
 * demi-search reads `top` BARE, not `and[top]`, hence the `fields` argument, which emits
 * `&name=value`. It answers the whole strip pinned first then newest, so no sort is sent.
 */
export async function getTopNewsItems(): Promise<any[]> {
  return rowsFrom(
    await searchKeywords(
      '',
      'RecentActivity',
      [{ name: 'top', value: 'true' }],
      1,
      TOP_NEWS_PAGE_SIZE,
      '',
      null,
    ),
  );
}

//
// Local helpers
//
function buildValues(collection: any[]): string {
  if (!collection || collection.length === 0) {
    return '';
  }
  let values = '';
  collection.forEach(function (a) {
    values += a + '|';
  });
  // trim the last |
  return values.replace(/\|$/, '');
}
