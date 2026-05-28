import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

/**
 * Migrates legacy /search query param names to the current canonical names.
 *
 * Mappings:
 *   pageNum  → currentPage   (old pagination param)
 *   q        → keywords      (old search query alias)
 *
 * If no legacy params present, passes through (returns true).
 * If legacy params found, redirects to /search with migrated params.
 */
export const migrateSearchParams: CanActivateFn = (route) => {
  const router = inject(Router);
  const qp = route.queryParams;

  // Unified search (documents/content tab) uses 'q' natively — don't migrate it.
  const tab = qp['tab'];
  const isUnifiedTab = tab === 'documents' || tab === 'content';

  const MIGRATIONS: Record<string, string> = {
    pageNum: 'currentPage',
    ...(!isUnifiedTab && { q: 'keywords' }),
  };

  const staleKeys = Object.keys(MIGRATIONS).filter(k => qp[k] != null);
  if (!staleKeys.length) return true;

  const migrated = { ...qp };
  for (const old of staleKeys) {
    const next = MIGRATIONS[old];
    // Only write the new key if not already present — canonical wins.
    if (migrated[next] == null) migrated[next] = migrated[old];
    delete migrated[old];
  }

  return router.createUrlTree(['/search'], { queryParams: migrated });
};

// ── Functional redirects for legacy path routes ──────────────────────────────
// Angular 17.1+ supports redirectTo as a RedirectFunction that receives
// { params, queryParams, data, fragment } from the matched route.
// This lets us forward and remap query params instead of dropping them.

/** Maps common old pagination/search params to their current names. */
function mapCommonParams(src: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'pageNum')  { out['currentPage'] = v; continue; }
    if (k === 'q')        { out['keywords']    = v; continue; }
    out[k] = v;
  }
  return out;
}

function buildSearchUrl(tab: string, queryParams: Record<string, string>): string {
  const mapped = mapCommonParams(queryParams);
  const qs = new URLSearchParams({ tab, ...mapped }).toString();
  return `/search?${qs}`;
}

/**
 * /project-notifications?* → /search?tab=notifications&*
 */
export function legacyProjectNotificationsRedirect(
  { queryParams }: { queryParams: Record<string, string> },
): string {
  return buildSearchUrl('notifications', queryParams);
}

/**
 * /projects-list?* → /search?tab=projects&*
 */
export function legacyProjectsListRedirect(
  { queryParams }: { queryParams: Record<string, string> },
): string {
  return buildSearchUrl('projects', queryParams);
}

/**
 * /news?* → /search?tab=updates&*
 */
export function legacyNewsRedirect(
  { queryParams }: { queryParams: Record<string, string> },
): string {
  return buildSearchUrl('updates', queryParams);
}
