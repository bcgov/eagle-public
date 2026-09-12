import { redirect, type LoaderFunctionArgs } from 'react-router';
import { normalizeSortBy, toSearchParams, type Params } from 'app/components/table/table-params';
import {
  RECORD_TYPES,
  type RecordType,
  type SearchScope,
} from 'app/components/display-grid/use-grid-url-state';

/**
 * The four Angular-era list pages — /projects-list, /search, /news and /project-notifications —
 * become one /search page with a record type. Bookmarks, emails and search engine results still
 * carry the old addresses, so every one of them has to land on the same result set it used to.
 * The table of old address to new one is in docs/deviations-from-angular.md.
 */

/** Filter ids each legacy page put on the query string, by the record type it becomes. */
export const LEGACY_FILTERS: Record<RecordType, string[]> = {
  projects: [
    'type',
    'eacDecision',
    'proponent',
    'region',
    'CEAAInvolvement',
    'currentPhaseName',
    'decisionDateStart',
    'decisionDateEnd',
  ],
  documents: [
    'milestone',
    'documentAuthorType',
    'type',
    'projectPhase',
    'datePostedStart',
    'datePostedEnd',
  ],
  activities: [],
  notifications: ['type', 'region', 'pcp', 'decision'],
};

/**
 * Fields the new grid can sort each record type by. An old sort naming a column that no longer
 * exists is dropped rather than passed on, so the page falls back to its own default instead of
 * asking the API to sort by something it will reject.
 */
export const SORTABLE_FIELDS: Record<RecordType, string[]> = {
  projects: ['name', 'dateUpdated', 'proponent', 'type', 'region', 'currentPhaseName'],
  documents: [
    'displayName',
    'datePosted',
    'type',
    'milestone',
    'projectPhase',
    'documentAuthorType',
  ],
  activities: ['dateAdded', 'headline'],
  notifications: ['name', 'dateUpdated'],
};

function validSortBy(record: RecordType, raw: string | null): string | null {
  if (!raw) return null;
  const sortBy = normalizeSortBy(raw);
  return SORTABLE_FIELDS[record].includes(sortBy.replace(/^[+-]/, '')) ? sortBy : null;
}

/**
 * The new query string for one legacy address. Only the params listed here survive: paging, the
 * keyword, a sort the record type can honour, and that type's own filters. Everything else,
 * `dataset` included, is dropped.
 */
function legacySearchQuery(
  record: RecordType,
  search: URLSearchParams,
  scope?: SearchScope,
): URLSearchParams {
  const carried: Params = {
    record,
    scope: scope === 'inside' ? scope : null,
    keywords: search.get('keywords'),
    sortBy: validSortBy(record, search.get('sortBy')),
    currentPage: search.get('currentPage'),
    pageSize: search.get('pageSize'),
  };

  for (const id of LEGACY_FILTERS[record]) {
    carried[id] = search.get(id);
  }

  return toSearchParams(carried);
}

/**
 * A react-router loader that sends one legacy list page to its record type on /search. The
 * redirect is client side, which is all a single page app can do, and the edge already serves
 * index.html for every path.
 */
export function legacySearchRedirect(record: RecordType, options: { scope?: SearchScope } = {}) {
  return ({ request }: LoaderFunctionArgs) => {
    const search = new URL(request.url).searchParams;
    return redirect(`/search?${legacySearchQuery(record, search, options.scope)}`);
  };
}

/**
 * Where a /search address should go, or null when it is already a new-style one and the page can
 * render it as it stands. Angular's /search was the document search, and documents are what the
 * new page opens on, so an old address keeps its document filters and drops everything else —
 * `dataset` included. Relative input is resolved against a throwaway origin, so read `pathname`
 * and `search` off the result, not `href`.
 */
export function resolveLegacySearch(url: string | URL): URL | null {
  const current = new URL(url, 'http://localhost');
  const search = current.searchParams;

  const record = search.get('record');
  if (record && (RECORD_TYPES as string[]).includes(record)) return null;

  const next = new URL(current);
  next.pathname = '/search';
  next.search = legacySearchQuery('documents', search).toString();

  return next.href === current.href ? null : next;
}

/**
 * The path inside an old hash-router address, or null when the hash is an ordinary in-page anchor.
 * `#//host` is refused: resolved as a path it would hand the reader to another site.
 */
export function hashToPath(hash: string): string | null {
  if (!hash.startsWith('#/') || hash.startsWith('#//')) return null;
  return hash.slice(1);
}
