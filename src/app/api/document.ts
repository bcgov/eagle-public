import * as api from './api';
import { demiParentId } from './commentperiod';
import { Document } from 'app/models/document';

/** DEMI 400s above 100 rows for an anonymous request, and public visitors are anonymous. */
const ANONYMOUS_PAGE_SIZE_CAP = 100;

/** DEMI 400s an anonymous page that reaches past this row (`page * pageSize`). */
export const ANONYMOUS_ROW_DEPTH = 2000;

/** The rows of `total` an anonymous visitor can page through: whole pages within the depth. */
export function reachableTotal(total: number, pageSize: number): number {
  return Math.min(total, Math.floor(ANONYMOUS_ROW_DEPTH / pageSize) * pageSize);
}

/** The columns DEMI's `/documents` sorts by. */
const SORT_KEYS = ['datePosted', 'displayName'];

/** The tables' filter names that DEMI names after the List id they hold. */
const NATIVE_FILTER: Record<string, string> = {
  type: 'typeId',
  milestone: 'milestoneId',
  projectPhase: 'projectPhaseId',
  documentAuthorType: 'documentAuthorTypeId',
};

/** DEMI takes these as one day, `YYYY-MM-DD`; the filter panel sends a full ISO timestamp. */
const DAY_FILTERS = ['datePostedStart', 'datePostedEnd'];

/**
 * A document as DEMI's native `/documents` answers it. `type`, `milestone` and the like hold the
 * List name, and the `…Id` beside each holds the List id.
 */
export interface NativeDocument {
  id: string;
  /** The DEMI (Track) project id, or a notification's own Eagle id. */
  projectId?: string;
  /** Joined from the parent project; a notification parent has none. */
  projectEagleId?: string;
  displayName?: string;
  documentFileName?: string;
  fileSize?: number | null;
  mimeType?: string;
  typeId?: string;
  milestoneId?: string;
  projectPhaseId?: string;
  documentAuthorTypeId?: string;
  [field: string]: unknown;
}

/** A DEMI row in the shape the pages read: `_id`, and List ids where the pages look names up. */
export function fromNativeDocument(row: NativeDocument): Document {
  const {
    id,
    projectId,
    projectEagleId,
    typeId,
    milestoneId,
    projectPhaseId,
    documentAuthorTypeId,
    fileSize,
    mimeType,
    ...fields
  } = row;
  return new Document({
    ...fields,
    _id: id,
    project: projectEagleId ?? projectId,
    type: typeId,
    milestone: milestoneId,
    projectPhase: projectPhaseId,
    documentAuthorType: documentAuthorTypeId,
    internalSize: fileSize == null ? undefined : String(fileSize),
    documentFileSize: fileSize ?? undefined,
    internalMime: mimeType,
    // The only label the comment attachment list renders.
    internalOriginalName: row.documentFileName ?? row.displayName,
  });
}

/**
 * Filter sets in the tables' names (comma-joined ids) as native filters. A field two sets both
 * narrow keeps only the values both allow, so a tab's own types and a picked type intersect.
 */
export function documentFilters(
  ...sets: Record<string, string | null | undefined>[]
): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  for (const set of sets) {
    for (const [name, value] of Object.entries(set)) {
      if (value == null || value === '') continue;
      const field = NATIVE_FILTER[name] ?? name;
      const values = DAY_FILTERS.includes(name)
        ? [value.slice(0, 10)]
        : value.split(',').filter(Boolean);
      const known = filters[field];
      filters[field] = known ? known.filter((one) => values.includes(one)) : values;
    }
  }
  return filters;
}

/**
 * The table's `sortBy` as DEMI's one sort key. A keyword search keeps DEMI's best-match order, and
 * a column DEMI cannot sort by falls back to newest first.
 */
function nativeSort(sortBy: string | undefined, q: string | undefined): string | undefined {
  const key = sortBy?.replace(/^[+-]/, '') ?? '';
  if (SORT_KEYS.includes(key)) return sortBy?.startsWith('-') ? `-${key}` : key;
  return q || !key ? undefined : '-datePosted';
}

export interface DocumentQuery {
  /** The Eagle id the page holds: a project's, or a notification's. */
  projId: string;
  /** 1-based. */
  page: number;
  pageSize: number;
  /** The table's sort, `-datePosted` style. */
  sortBy?: string;
  keywords?: string;
  /** Native filters, from `documentFilters`. */
  filters?: Record<string, string[]>;
}

export interface DocumentPage {
  rows: Document[];
  /** Every match, ignoring paging. */
  total: number;
}

/** One page of a project's or notification's documents. A failure throws `ApiError`. */
export async function readDocuments(
  query: DocumentQuery,
  signal?: AbortSignal,
): Promise<DocumentPage> {
  const q = query.keywords?.trim() || undefined;
  const { rows, total } = await api.listNative<NativeDocument>(
    'documents',
    {
      page: query.page,
      pageSize: Math.min(query.pageSize, ANONYMOUS_PAGE_SIZE_CAP),
      count: true,
      q,
      sort: nativeSort(query.sortBy, q),
      filters: { ...query.filters, project: await demiParentId(query.projId) },
    },
    signal,
  );
  return { rows: rows.map(fromNativeDocument), total: total ?? rows.length };
}

/** The documents for `ids`, in that order. DEMI's `ids=` leaves out images uploaded with an Update. */
export async function getByMultiId(ids: string[]): Promise<Document[]> {
  return (await api.byIdsNative<NativeDocument>('documents', ids)).map(fromNativeDocument);
}
