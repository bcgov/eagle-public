import { redirect, type LoaderFunctionArgs } from 'react-router';
import { normalizeSortBy, toSearchParams, type Params } from 'app/components/table/table-params';
import {
  RECORD_TYPES,
  type RecordType,
  type SearchScope,
} from 'app/components/display-grid/use-grid-url-state';

// Old bookmarks, emails and search results carry the legacy list addresses and must land on the
// same result set. Address mapping: docs/deviations-from-angular.md.

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
 * Sortable fields per record type. Any other sort is dropped so the API is not asked to sort by a
 * field it rejects.
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

/** New query string for a legacy address; params not listed here (`dataset` too) are dropped. */
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

/** List URL on /search for a record type, with optional keyword and filters; blank keyword left off. */
export function searchUrl(record: RecordType, keywords?: string, filters: Params = {}): string {
  return `/search?${toSearchParams({ record, ...filters, keywords: keywords?.trim() })}`;
}

/**
 * Loader redirecting a legacy list page to its record type on /search. Client side: the edge
 * serves index.html for every path.
 */
export function legacySearchRedirect(list: LegacyList, options: { scope?: SearchScope } = {}) {
  return ({ request }: LoaderFunctionArgs) => {
    const search = new URL(request.url).searchParams;
    return redirect(`/search?${legacySearchQuery(list, search, options.scope)}`);
  };
}

/**
 * Redirect target for a legacy /search address, or null if current. Read `pathname`/`search`, not
 * `href`: relative input resolves against a throwaway origin.
 */
export function resolveLegacySearch(url: string | URL): URL | null {
  const current = new URL(url, 'http://localhost');
  const search = current.searchParams;

  const record = search.get('record');
  const notifications = record === 'notifications';
  if (record && (RECORD_TYPES as string[]).includes(record)) return null;

  const next = new URL(current);
  next.pathname = '/search';
  next.search = legacySearchQuery(notifications ? 'notifications' : 'documents', search).toString();

  return next.href === current.href ? null : next;
}

/** Path in a hash-router address, or null for a plain anchor. `#//host` is refused: it leaves the site. */
export function hashToPath(hash: string): string | null {
  if (!hash.startsWith('#/') || hash.startsWith('#//')) return null;
  return hash.slice(1);
}
