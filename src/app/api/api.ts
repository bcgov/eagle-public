import type { Project } from 'app/models/project';
import type { Comment } from 'app/models/comment';
import type { CommentPeriod } from 'app/models/commentperiod';
import type { Document } from 'app/models/document';
import type { SearchResults } from 'app/models/search';
import type { Org } from 'app/models/organization';
import { encodeString } from 'app/utils/utils';
import { logger } from 'app/config/logging';
import { getApiPath, getSearchApiPath } from 'app/config/config';
import { track } from 'app/analytics/analytics';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
  ) {
    super(`${status} - ${statusText}`);
    this.name = 'ApiError';
  }
}

interface ResponseWithHeaders<T> {
  body: T;
  headers: Headers;
}

// IE, Edge, etc
export const isMS = !!(window.navigator as any).msSaveOrOpenBlob;

export function apiPath(): string {
  return getApiPath();
}

/**
 * Base URL for search. eagle-search when SEARCH_API_PATH is set, eagle-api otherwise.
 *
 * Only the datasets in AZURE_DATASETS move; RecentActivity and ProjectNotification stay on
 * eagle-api. The two backends answer the same query language and the same
 * `[{searchResults, meta}]` envelope, which is why nothing downstream has to change.
 */
export function searchPath(): string {
  return getSearchApiPath();
}

const AZURE_DATASETS = new Set(['Project', 'Document', 'DocumentChunk']);

async function send(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET';
  logger.logHttpRequest(method, url, 'api');

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    logger.logHttpError(method, url, error, 'api');
    throw error;
  }

  logger.logHttpResponse(method, url, response.status, undefined, 'api');
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }
  return response;
}

export async function getJson<T>(url: string): Promise<T> {
  return (await send(url)).json() as Promise<T>;
}

async function getWithHeaders<T>(url: string): Promise<ResponseWithHeaders<T>> {
  const response = await send(url);
  return { body: (await response.json()) as T, headers: response.headers };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await send(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export async function downloadDocument(document: Document): Promise<void> {
  track('Document Downloaded', {
    document_id: document._id,
    document_name: document.displayName,
    document_type: document.internalMime || 'unknown',
  });

  let blob;
  try {
    blob = await downloadResource(document._id);
  } catch (e) {
    throw new Error(String(e));
  }
  if (!blob) {
    throw new Error();
  }
  let filename = document.displayName;
  filename = encodeString(filename, false);
  if (isMS) {
    (window.navigator as any).msSaveBlob(blob, filename);
  } else {
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    window.document.body.appendChild(a);
    a.setAttribute('style', 'display: none');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }
}

export async function openDocument(document: Document): Promise<void> {
  track('Document Opened', {
    document_id: document._id,
    document_name: document.displayName || document.documentFileName,
    document_source: document.documentSource || 'unknown',
  });

  let filename;
  if (document.documentSource === 'COMMENT') {
    filename = document.internalOriginalName;
  } else {
    filename = document.documentFileName;
  }
  logger.debug('Opening document', 'api', { document });
  let safeName = '';
  try {
    safeName = encodeString(filename || '', true);
  } catch (e) {
    logger.warn('Failed to encode document filename', 'api', e);
  }
  logger.debug('Opening document with safe name', 'api', { safeName });
  window.open('/api/public/document/' + document._id + '/download/' + safeName, '_blank');
}

//
// Bulk download (demi-api). Rides the search base path, so an empty SEARCH_API_PATH turns it off.
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

async function downloadResource(id: string): Promise<Blob> {
  const queryString = `document/${id}/download`;
  const blob = await (await send(apiPath() + '/' + queryString)).blob();
  if (!blob) {
    throw new Error('Failed to download document');
  }
  return blob;
}

//
// Searching
//
export async function searchKeywords(
  keys: string,
  dataset: string,
  fields: any[],
  pageNum: number,
  pageSize: number,
  projectLegislation = '',
  sortBy: string | null = null,
  queryModifier: Record<string, string> = {},
  populate = false,
  secondarySort: string | null = null,
  filter: Record<string, string> = {},
  fuzzy = false,
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
  // No `&fields=`: neither backend reads it on /search. eagle-api's search controller never
  // touches the parameter and swagger does not declare it; demi-search accepts it only to keep
  // saved URLs out of its unknown-parameter 400. Angular sent `fields=[object Object]` here
  // because `fields` holds `{name, value}` pairs, already emitted above as `&name=value`.
  queryString += '&fuzzy=' + fuzzy;

  const base = AZURE_DATASETS.has(dataset) ? searchPath() : apiPath();
  const fullUrl = `${base}/${queryString}`;
  logger.trace(`API call URL: ${fullUrl}`, 'api');

  return getJson<SearchResults[]>(fullUrl);
}

/** Dropdown/filter list items, lazily fetched and cached by TanStack Query. */
export function listsQueryOptions() {
  return {
    queryKey: ['lists'],
    queryFn: async (): Promise<any[]> => {
      const data = await getJson<{ searchResults?: any[] }[]>(
        `${apiPath()}/search?pageSize=250&dataset=List`,
      );
      return data?.[0]?.searchResults ?? [];
    },
  };
}

//
// Projects
//
export async function getProjectPins(
  id: string,
  pageNum: number,
  pageSize: number,
  sortBy: any,
): Promise<Org> {
  let queryString = `project/${id}/pin`;
  if (pageNum !== null) {
    queryString += `?pageNum=${pageNum - 1}`;
  }
  if (pageSize !== null) {
    queryString += `&pageSize=${pageSize}`;
  }
  if (sortBy !== '' && sortBy !== null) {
    queryString += `&sortBy=${sortBy}`;
  }
  return getJson<Org>(`${apiPath()}/${queryString}`);
}

// CAC
export async function cacSignUp(project: Project, meta: any): Promise<any> {
  // We are just looking for a 200 OK
  return postJson(`${apiPath()}/project/${project._id}/cacSignUp`, meta);
}

export async function cacRemoveMember(projectId: string, meta: any): Promise<any> {
  // We are just looking for a 200 OK
  const response = await send(`${apiPath()}/project/${projectId}/cacRemoveMember`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  return response.json();
}

// Organizations

export async function getOrgsByCompanyType(type: string): Promise<Org[]> {
  const fields = ['name'];

  const queryString = `organization?companyType=${type}&sortBy=+name&fields=${buildValues(fields)}`;
  return getJson<Org[]>(`${apiPath()}/${queryString}`);
}

export async function getProject(
  id: string,
  cpStart: string | null,
  cpEnd: string | null,
): Promise<Project[]> {
  const fields = [
    'CEAAInvolvement',
    'CELead',
    'CELeadEmail',
    'CELeadPhone',
    'centroid',
    'description',
    'eacDecision',
    'location',
    'name',
    'projectLeadId',
    'projectLead',
    'projectLeadEmail',
    'projectLeadPhone',
    'proponent',
    'region',
    'responsibleEPDId',
    'responsibleEPD',
    'responsibleEPDEmail',
    'responsibleEPDPhone',
    'type',
    'legislation',
    'addedBy',
    'build',
    'CEAALink',
    'code',
    'commodity',
    'currentPhaseName',
    'dateAdded',
    'dateCommentsClosed',
    'commentPeriodStatus',
    'dateUpdated',
    'decisionDate',
    'duration',
    'eaoMember',
    'epicProjectID',
    'fedElecDist',
    'isTermsAgreed',
    'overallProgress',
    'primaryContact',
    'proMember',
    'provElecDist',
    'sector',
    'shortName',
    'status',
    'legislation',
    'substitution',
    'featuredDocuments',
    'updatedBy',
    'read',
    'write',
    'delete',
    'featuredDocuments',
    'projectCAC',
    'projectCACPublished',
    'cacEmail',
  ];
  let queryString = `project/${id}?populate=true`;
  if (cpStart !== null) {
    queryString += `&cpStart[since]=${cpStart}`;
  }
  if (cpEnd !== null) {
    queryString += `&cpEnd[until]=${cpEnd}`;
  }
  queryString += `&fields=${buildValues(fields)}`;
  return getJson<Project[]>(`${apiPath()}/${queryString}`);
}

//
// Comment Periods
//
export async function getPeriodsByProjId(projId: string): Promise<any> {
  const fields = [
    'project',
    'dateStarted',
    'dateCompleted',
    'instructions',
    'isMet',
    'metURL',
    'informationLabel',
  ];
  const queryString = `commentperiod?project=${projId}&sortBy=-dateStarted&fields=${buildValues(fields)}`;
  return getJson<any>(`${apiPath()}/${queryString}`);
}

export async function getPeriod(id: string): Promise<CommentPeriod[]> {
  const fields = [
    'additionalText',
    'dateCompleted',
    'dateStarted',
    'informationLabel',
    'instructions',
    'openHouses',
    'project',
    'relatedDocuments',
    'commentTip',
  ];
  const queryString = 'commentperiod/' + id + '?fields=' + buildValues(fields);
  return getJson<CommentPeriod[]>(`${apiPath()}/${queryString}`);
}

//
// Comments
//
export async function getCommentsByPeriodId(
  pageNum: number | null,
  pageSize: number | null,
  getCount: boolean,
  periodId: string,
): Promise<ResponseWithHeaders<any>> {
  const fields = [
    'author',
    'comment',
    'documents',
    'commentId',
    'dateAdded',
    'dateUpdated',
    'isAnonymous',
    'location',
    'period',
    'read',
    'write',
    'delete',
  ];
  // TODO: May want to pass this as a parameter in the future.
  const sort = '-commentId';

  let queryString = 'public/comment?period=' + periodId + '&fields=' + buildValues(fields) + '&';
  if (sort !== null) {
    queryString += `sortBy=${sort}&`;
  }
  if (pageNum !== null) {
    queryString += `pageNum=${pageNum}&`;
  }
  if (pageSize !== null) {
    queryString += `pageSize=${pageSize}&`;
  }
  if (getCount !== null) {
    queryString += `count=${getCount}&`;
  }
  return getWithHeaders<any>(`${apiPath()}/${queryString}`);
}

export async function getComment(id: string): Promise<ResponseWithHeaders<any>> {
  const fields = [
    'author',
    'comment',
    'commentId',
    'dateAdded',
    'dateUpdated',
    'isAnonymous',
    'location',
    'period',
    'read',
    'write',
    'delete',
  ];
  const queryString = 'public/comment/' + id + '?fields=' + buildValues(fields);
  return getWithHeaders<any>(`${apiPath()}/${queryString}`);
}

export async function addComment(comment: Comment): Promise<Comment> {
  const fields = ['comment', 'author'];
  const queryString = 'public/comment?fields=' + buildValues(fields);
  return postJson<Comment>(`${apiPath()}/${queryString}`, comment);
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
  const queryString = `document?docIds=${buildValues(ids)}&fields=${buildValues(fields)}`;
  return getJson<Document[]>(`${apiPath()}/${queryString}`);
}

export async function uploadDocument(formData: FormData): Promise<Document> {
  const fields = ['documentFileName', 'displayName', 'internalURL', 'internalMime'];
  const queryString = 'document/?fields=' + buildValues(fields);
  const response = await send(`${apiPath()}/${queryString}`, { method: 'POST', body: formData });
  return response.json() as Promise<Document>;
}

/** Checks the shared access password. Resolves when accepted; throws ApiError 401 when not. */
export async function checkGatePassword(password: string): Promise<void> {
  await send(`${apiPath()}/public/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function getTopNewsItems(): Promise<any[]> {
  const queryString = 'public/recentActivity?top=true';
  return getJson<any[]>(`${apiPath()}/${queryString}`);
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
