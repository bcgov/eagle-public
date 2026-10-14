import type { RecentUpload, RecentUploads } from 'app/models/recent-upload';
import { logger } from 'app/config/logging';
import { getDemiApiPath, getDemiProjectsPath, getSearchApiPath } from 'app/config/config';
import { queryClient } from './query-client';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    /** The `error` text a DEMI native route answers with, when there was one. */
    public detail?: string,
  ) {
    super(`${status} - ${detail || statusText}`);
    this.name = 'ApiError';
  }
}

/** Base URL of demi-search: the home feed, recent uploads, bulk downloads and the gate. */
export function searchPath(): string {
  return getSearchApiPath();
}

/** Base URL for the single-project DEMI document, without a trailing slash. */
export function demiProjectsPath(): string {
  return getDemiProjectsPath();
}

/** A `List` row as DEMI's native `/lists` answers it. `id` is the Eagle `_id`. */
export interface ListRef {
  id?: string;
  name?: string;
  type?: string;
  legislation?: number;
}

/** A `List` row populated onto a project document, still keyed by the Eagle `_id`. */
export type EmbeddedListRef = Omit<ListRef, 'id'> & { _id?: string };

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
   * `eacDecision`, `currentPhaseName` and `CEAAInvolvement` arrive either as bare `List` ids or as
   * populated rows. `Project.fromNative` keeps only the populated form.
   */
  eacDecision?: string | EmbeddedListRef;
  applicableRegulation?: unknown;
  currentPhaseName?: string | EmbeddedListRef;
  phaseHistory?: unknown[];
  CEAAInvolvement?: string | EmbeddedListRef;
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
 * onto one request via the shared query key. An unset or blank DEMI_PROJECTS_PATH reads `/demi-projects`.
 */
export function demiProjectQueryOptions(projId: string) {
  const base = demiProjectsPath();
  return {
    queryKey: ['demi-project', projId],
    enabled: !!projId,
    retry: false,
    queryFn: (): Promise<DemiProject | null> =>
      nullOn404(getJson<DemiProject>(`${base}/${encodeURIComponent(projId)}`, { quiet404: true })),
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

/** An abort is a request the app dropped on purpose, never a failure to report or swallow. */
export function isAbortError(error: unknown): boolean {
  return (error as Error | undefined)?.name === 'AbortError';
}

/** `readErrorBody`: put the `{error}` text a DEMI native route answers with on the ApiError. */
async function send(
  url: string,
  init: RequestInit = {},
  quietStatuses: number[] = [],
  readErrorBody = false,
): Promise<Response> {
  const method = init.method ?? 'GET';
  logger.logHttpRequest(method, url, 'api');

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // Search-as-you-type aborts the request each keystroke supersedes. Logging those would send
    // Application Insights one exception per keystroke.
    if (init.signal?.aborted || isAbortError(error)) throw error;
    logger.logHttpError(method, url, error, 'api');
    throw error;
  }

  if (!quietStatuses.includes(response.status)) {
    logger.logHttpResponse(method, url, response.status, undefined, 'api');
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.statusText,
      readErrorBody ? await errorDetail(response) : undefined,
    );
  }
  return response;
}

async function errorDetail(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const error = (body as { error?: unknown } | null)?.error;
    return typeof error === 'string' ? error : undefined;
  } catch {
    // An error page that is not JSON leaves the status text to speak for it.
    return undefined;
  }
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
// DEMI native reads: `GET <DEMI_API_PATH>/<kind>` answers a plain array of rows, paging and the
// total travel in the query string and headers, and errors answer `{error}`.
//

/** DEMI 400s an `ids=` list longer than this. */
const NATIVE_IDS_LIMIT = 100;

/** A filter value. An array means any of these, and DEMI takes one only on its multi-value fields. */
export type NativeFilterValue = string | number | boolean | readonly (string | number)[];

export interface NativeListParams {
  /** 1-based page number. */
  page?: number;
  pageSize?: number;
  /** Ask DEMI to count every match into `x-total-count`. */
  count?: boolean;
  /** One field from the kind's sort list, `-` in front for descending. DEMI 400s on a list. */
  sort?: string;
  q?: string;
  /** At most `NATIVE_IDS_LIMIT`; `byIdsNative` splits longer lists. */
  ids?: readonly string[];
  /** Native field names. An `undefined` value is left out. */
  filters?: Record<string, NativeFilterValue | undefined>;
}

export interface NativePage<T> {
  rows: T[];
  /** Every match, ignoring paging. Only there when DEMI counted (`count: true`). */
  total?: number;
}

function nativePath(kind: string): string {
  return `${getDemiApiPath()}/${kind}`;
}

function nativeQuery(params: NativeListParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  if (params.count) query.set('count', 'true');
  if (params.sort) query.set('sort', params.sort);
  if (params.q) query.set('q', params.q);
  if (params.ids) query.set('ids', params.ids.join(','));
  for (const [field, value] of Object.entries(params.filters ?? {})) {
    if (value === undefined) continue;
    // DEMI reads a repeated parameter as OR.
    const values = Array.isArray(value) ? value : [value];
    values.forEach((one) => query.append(field, String(one)));
  }
  return query.toString();
}

/** An empty `ids` or filter list leaves nothing to match; sent as is, it would match everything. */
function matchesNothing(params: NativeListParams): boolean {
  return (
    params.ids?.length === 0 ||
    Object.values(params.filters ?? {}).some((value) => Array.isArray(value) && value.length === 0)
  );
}

function totalCount(response: Response): number | undefined {
  const header = response.headers.get('x-total-count');
  const total = header === null || header.trim() === '' ? NaN : Number(header);
  return Number.isFinite(total) ? total : undefined;
}

/** One page of a kind's rows. A failure throws `ApiError` carrying DEMI's `error` text. */
export async function listNative<T>(
  kind: string,
  params: NativeListParams = {},
  signal?: AbortSignal,
): Promise<NativePage<T>> {
  if (matchesNothing(params)) return { rows: [], total: params.count ? 0 : undefined };
  const query = nativeQuery(params);
  const url = query ? `${nativePath(kind)}?${query}` : nativePath(kind);
  const response = await send(url, { signal }, [], true);
  return { rows: (await response.json()) as T[], total: totalCount(response) };
}

/** One row by DEMI id or Eagle id. A missing row throws `ApiError` 404, not logged as an error. */
export async function getNative<T>(kind: string, id: string, signal?: AbortSignal): Promise<T> {
  const response = await send(
    `${nativePath(kind)}/${encodeURIComponent(id)}`,
    { signal },
    [404],
    true,
  );
  return response.json() as Promise<T>;
}

/** The rows for `ids`, read `NATIVE_IDS_LIMIT` at a time, in the order of `ids`. Unknown ids are absent. */
export async function byIdsNative<T>(kind: string, ids: readonly string[]): Promise<T[]> {
  const batches: string[][] = [];
  for (let from = 0; from < ids.length; from += NATIVE_IDS_LIMIT) {
    batches.push(ids.slice(from, from + NATIVE_IDS_LIMIT));
  }
  const pages = await Promise.all(
    batches.map((batch) => listNative<T>(kind, { ids: batch, pageSize: batch.length })),
  );
  const position = new Map(ids.map((id, at) => [id, at]));
  const placeOf = (row: T) => position.get((row as { id?: string }).id ?? '') ?? Infinity;
  return pages.flatMap((page) => page.rows).sort((a, b) => placeOf(a) - placeOf(b));
}

/** DEMI 400s an anonymous page above this, and the public app is always anonymous. */
export const ANONYMOUS_PAGE_SIZE = 100;

/**
 * Every row of a kind, read `ANONYMOUS_PAGE_SIZE` at a time until `x-total-count`. An empty page
 * ends it early, so a count that drifts between reads cannot loop.
 */
export async function listAllNative<T>(
  kind: string,
  params: Omit<NativeListParams, 'page' | 'pageSize' | 'count'> = {},
): Promise<T[]> {
  const read = (page: number) =>
    listNative<T>(kind, { ...params, page, pageSize: ANONYMOUS_PAGE_SIZE, count: true });
  const first = await read(1);
  const rows = [...first.rows];
  const total = first.total ?? rows.length;
  for (let page = 2; rows.length < total; page++) {
    const next = await read(page);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  if (rows.length < total) {
    logger.warn(`${kind} answered ${rows.length} of ${total} rows; the rest are not shown`, 'api');
  }
  return rows;
}

/** `read`'s answer, or null on a 404: DEMI holds no such row the caller may read. */
async function nullOn404<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** One row by id, or null when DEMI holds none the caller may read. */
export function nativeOrNull<T>(kind: string, id: string): Promise<T | null> {
  return nullOn404(getNative<T>(kind, id));
}

/** Every `List` row. Dropdowns, filters and id-to-name lookups all read this one cached result. */
export function listsQueryOptions() {
  return {
    queryKey: ['lists'],
    queryFn: () => listAllNative<ListRef>('lists'),
  };
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

/**
 * The projects that received a document most recently, newest first. demi-search holds the answer
 * for five minutes, so this stays cheap even though every home page visit asks for it.
 */
export async function getRecentUploads(limit = 5): Promise<RecentUpload[]> {
  const response = await getJson<RecentUploads>(
    `${searchPath()}/documents/recent-uploads?limit=${limit}`,
  );
  return response?.items ?? [];
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
