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

/** The lists a legacy address can name. No legacy page listed comment periods. */
type LegacyList = 'projects' | 'documents' | 'activities' | 'notifications';

/** Project notifications have no tab of their own: they are rows on the projects tab. */
const NOTIFICATION_ROWS = { recordKind: 'notification' };

/** The projects tab showing only project notifications. */
export const NOTIFICATIONS_SEARCH_URL = searchUrl('projects', undefined, NOTIFICATION_ROWS);

/** Filter ids each legacy list put on the query string. */
export const LEGACY_FILTERS: Record<LegacyList, string[]> = {
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
export const SORTABLE_FIELDS: Record<LegacyList, string[]> = {
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
  notifications: ['name'],
};

function validSortBy(record: LegacyList, raw: string | null): string | null {
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
  list: LegacyList,
  search: URLSearchParams,
  scope?: SearchScope,
): URLSearchParams {
  const inside = scope === 'inside';
  const carried: Params = {
    ...(list === 'notifications' ? { record: 'projects', ...NOTIFICATION_ROWS } : { record: list }),
    scope: inside ? scope : null,
    keywords: search.get('keywords'),
    // Passages rank by relevance and by nothing else, so a field sort is dropped rather than kept
    // as a choice the index will refuse.
    sortBy: inside ? null : validSortBy(list, search.get('sortBy')),
    currentPage: search.get('currentPage'),
    pageSize: search.get('pageSize'),
  };

  for (const id of LEGACY_FILTERS[list]) {
    carried[id] = search.get(id);
  }
  // The projects tab offers no "none" comment period, and the API refuses it.
  if (carried['pcp'] === 'none') carried['pcp'] = null;

  return toSearchParams(carried);
}

/**
 * Where a record type's list lives, optionally opened on a keyword and filters. Links that used to
 * point at a legacy list page use this, and so does the home page's search row. A blank keyword is
 * left off.
 */
export function searchUrl(record: RecordType, keywords?: string, filters: Params = {}): string {
  return `/search?${toSearchParams({ record, ...filters, keywords: keywords?.trim() })}`;
}

/**
 * A react-router loader that sends one legacy list page to its record type on /search. The
 * redirect is client side, which is all a single page app can do, and the edge already serves
 * index.html for every path.
 */
export function legacySearchRedirect(list: LegacyList, options: { scope?: SearchScope } = {}) {
  return ({ request }: LoaderFunctionArgs) => {
    const search = new URL(request.url).searchParams;
    return redirect(`/search?${legacySearchQuery(list, search, options.scope)}`);
  };
}

/**
 * Where a /search address should go, or null when it is already a new-style one and the page can
 * render it as it stands. Angular's /search was the document search, and documents are what the
 * new page opens on, so an old address keeps its document filters and drops everything else —
 * `dataset` included. `record=notifications`, the old notifications tab, goes to the projects
 * tab's notification rows. Relative input is resolved against a throwaway origin, so read
 * `pathname` and `search` off the result, not `href`.
 */
export function resolveLegacySearch(url: string | URL): URL | null {
  const current = new URL(url, 'http://localhost');
  const search = current.searchParams;

  const record = search.get('record');
  const notifications = record === 'notifications';
  if (!notifications && record && (RECORD_TYPES as string[]).includes(record)) return null;

  const next = new URL(current);
  next.pathname = '/search';
  next.search = legacySearchQuery(notifications ? 'notifications' : 'documents', search).toString();

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
