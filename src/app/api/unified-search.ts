import { getDemiApiPath } from 'app/config/config';
import { logger } from 'app/config/logging';
import {
  byIdsNative,
  getJson,
  isAbortError,
  listNative,
  type NativeFilterValue,
  type NativeListParams,
} from './api';

/** The reads behind /search, on DEMI's native list routes. */

type Row = Record<string, unknown>;

/** The native kinds the search tabs list. */
export type SearchKind = 'projects' | 'documents' | 'updates' | 'notifications' | 'comment-periods';

export type SearchFilters = Record<string, NativeFilterValue>;

/** DEMI refuses an anonymous `page * pageSize` past this many rows. */
export const ANON_PAGE_DEPTH = 2000;

export interface SearchPage {
  rows: Row[];
  /** Every match, from `x-total-count`. */
  total: number;
}

/** One page of a kind's rows, counted. */
export async function searchPage(
  kind: SearchKind,
  params: Omit<NativeListParams, 'count'>,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const { rows, total } = await listNative<Row>(kind, { ...params, count: true }, signal);
  return { rows, total: total ?? rows.length };
}

/** One passage hit, as `/documents/passages` answers it: the index highlight, not chunk text. */
interface NativePassage {
  id?: string;
  documentId?: string;
  pageNumber?: number;
  pageNumbered?: boolean;
  snippet?: string;
}

/** The document fields a passage group is labelled with. */
interface DocumentLabel {
  id?: string;
  displayName?: string;
  datePosted?: string;
  type?: string;
  fileSize?: number;
}

export interface PassageGroup {
  documentId: string;
  displayName?: string;
  datePosted?: string;
  type?: string;
  fileSize?: number;
  /** In rank order, as the page of passages listed them. */
  passages: { snippet: string; pageNumber?: number; pageNumbered: boolean }[];
}

/** Document names for the groups. A failed read leaves the groups unnamed rather than empty. */
async function documentLabels(ids: string[]): Promise<Map<string, DocumentLabel>> {
  try {
    const rows = await byIdsNative<DocumentLabel>('documents', ids);
    return new Map(rows.map((row) => [String(row.id), row]));
  } catch (error) {
    if (isAbortError(error)) throw error;
    logger.warn('Passage document names could not be read', 'unified-search', error);
    return new Map();
  }
}

/**
 * One page of passages, grouped under their document in the order each document first ranks.
 * `total` counts passages, not documents.
 */
export async function passagePage(
  params: { q: string; page: number; pageSize: number; filters: SearchFilters },
  signal?: AbortSignal,
): Promise<{ rows: PassageGroup[]; total: number }> {
  const { rows, total } = await listNative<NativePassage>(
    'documents/passages',
    { ...params, count: true },
    signal,
  );
  const groups = new Map<string, PassageGroup>();
  for (const row of rows) {
    const documentId = String(row.documentId ?? '');
    if (!documentId) continue;
    const group = groups.get(documentId) ?? { documentId, passages: [] };
    group.passages.push({
      snippet: row.snippet ?? '',
      pageNumber: row.pageNumber,
      pageNumbered: row.pageNumbered === true,
    });
    groups.set(documentId, group);
  }
  const labels = groups.size > 0 ? await documentLabels([...groups.keys()]) : new Map();
  const grouped = [...groups.values()].map((group) => {
    const label = labels.get(group.documentId);
    return {
      ...group,
      displayName: label?.displayName,
      datePosted: label?.datePosted,
      type: label?.type,
      fileSize: label?.fileSize,
    };
  });
  return { rows: grouped, total: total ?? rows.length };
}

/** How many rows a list would hold. Null when the read failed, so no badge claims a number. */
export async function kindTotal(
  kind: SearchKind | 'documents/passages',
  params: { q?: string; filters?: SearchFilters },
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const { total } = await listNative<Row>(kind, { ...params, pageSize: 1, count: true }, signal);
    return total ?? null;
  } catch (error) {
    if (isAbortError(error)) throw error;
    logger.warn('Count read failed; the tab shows no badge', 'unified-search', kind);
    return null;
  }
}

/** `GET /counts`, which only measures projects and documents. Null per kind on a failed read. */
export async function projectAndDocumentCounts(
  q: string,
  signal?: AbortSignal,
): Promise<{ projects: number | null; documents: number | null }> {
  const query = new URLSearchParams({ kind: 'projects,documents' });
  if (q) query.set('q', q);
  try {
    const answer = await getJson<Record<string, unknown>>(`${getDemiApiPath()}/counts?${query}`, {
      signal,
    });
    const read = (value: unknown) => (typeof value === 'number' ? value : null);
    return { projects: read(answer?.['projects']), documents: read(answer?.['documents']) };
  } catch (error) {
    if (isAbortError(error)) throw error;
    logger.warn('Counts read failed; the tabs show no badge', 'unified-search');
    return { projects: null, documents: null };
  }
}
