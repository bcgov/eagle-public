import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, expand, reduce, EMPTY } from 'rxjs';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import { ConfigService } from './config.service';

/**
 * Shared Typesense client factory.
 *
 * Centralises URL parsing, adapter creation, and HTTP connection-pool caching
 * so every search page (projects, documents, activities, etc.) reuses the same
 * client instance without needing to duplicate 30+ lines of setup code.
 *
 * Also manages per-index stale-hit caches for stale-while-revalidate display
 * on component remount.
 */
@Injectable({ providedIn: 'root' })
export class TypesenseService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);

  private cachedSearchClient: any = null;
  private cachedClientKey = '';
  private lastHitsCache: Record<string, any[]> = {};
  private lastFacetsCache: Record<string, Record<string, any[]>> = {};
  private healthCheckResult: boolean | null = null;

  /**
   * Health-checks the Typesense endpoint using native fetch (bypasses HttpClient
   * interceptors). Result is cached for the session lifetime so only one network
   * round-trip is ever made. On first-load cold-connection failures the check
   * retries once after 1.5 s before giving up.
   */
  async checkHealth(searchHost: string): Promise<boolean> {
    if (this.healthCheckResult !== null) {
      return this.healthCheckResult;
    }

    const healthUrl = `${searchHost}/health`;
    const attempt = async (): Promise<boolean> => {
      try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
        return res.ok;
      } catch {
        return false;
      }
    };

    let ok = await attempt();
    if (!ok) {
      // One retry after a short delay — handles TLS cold-start on the dev proxy
      await new Promise(r => setTimeout(r, 1500));
      ok = await attempt();
    }

    if (!ok) {
      console.warn('[TypesenseService] Health check failed after retry — search unavailable');
    }

    this.healthCheckResult = ok;
    return ok;
  }

  /**
   * Returns a cached Typesense search client built from runtime config.
   * Reuses the same HTTP connection pool across component destroy/recreate cycles
   * to prevent the ~3 s cold-start penalty on re-navigation.
   *
   * @param additionalSearchParameters  Typesense-specific params (query_by, weights, etc.).
   *   Required by the adapter; cache key includes query_by so different collections
   *   each get their own cached client.
   */
  getSearchClient(additionalSearchParameters: { query_by: string; [key: string]: any }): any {
    const config = this.configService.config();
    const searchHost = config.TYPESENSE_SEARCH_HOST || '/search-api';
    const apiKey = config.TYPESENSE_SEARCH_KEY || '';
    const { host, port, protocol, path } = this.parseHost(searchHost);
    // Include sort_by and filter_by in cache key — different sort orders or base filters
    // require separate adapter instances (sort_by and filter_by are fixed at construction time).
    const sortKey   = additionalSearchParameters['sort_by']   ?? '';
    const filterKey = additionalSearchParameters['filter_by'] ?? '';
    const clientKey = `${apiKey}@${host}:${port}${path}|${additionalSearchParameters.query_by}|${sortKey}|${filterKey}`;

    if (!this.cachedSearchClient || this.cachedClientKey !== clientKey) {
      const adapter = new TypesenseInstantSearchAdapter({
        server: {
          apiKey,
          nodes: [{ host, port, protocol, path }],
          connectionTimeoutSeconds: 5,   // Allow slow proxy connection in dev
          numRetries: 1,                 // One retry on transient failure; more just creates noise
          retryIntervalSeconds: 0.1,
          cacheSearchResultsForSeconds: 120, // Avoid re-querying identical strings
        },
        additionalSearchParameters,
      });
      this.cachedSearchClient = adapter.searchClient;
      this.cachedClientKey = clientKey;
    }

    return this.cachedSearchClient;
  }

  /** Returns stale hits for the given index (shown instantly on remount). */
  getLastHits(indexName: string): any[] {
    return this.lastHitsCache[indexName] ?? [];
  }

  /** Stores the latest successful result set for stale-while-revalidate display. */
  setLastHits(indexName: string, hits: any[]): void {
    this.lastHitsCache[indexName] = [...hits];
  }

  /** Returns cached facet items for the given index + attribute. */
  getLastFacets(indexName: string, attribute: string): any[] {
    return this.lastFacetsCache[indexName]?.[attribute] ?? [];
  }

  /** Stores the latest facet items for stale-while-revalidate display. */
  setLastFacets(indexName: string, attribute: string, items: any[]): void {
    if (!this.lastFacetsCache[indexName]) this.lastFacetsCache[indexName] = {};
    this.lastFacetsCache[indexName][attribute] = [...items];
  }

  /**
   * Fetches the top recent activities directly from Typesense REST API.
   * Returns them mapped to the shape ActivityCardComponent expects so the
   * home page can use Typesense instead of the MongoDB /api/public/recentActivity endpoint.
   *
   * Sorted pinned-first then newest-first, filtered to active=true only.
   */
  getTopActivities(perPage = 5): Observable<any[]> {
    return this.searchCollection('activities', {
      q: '*',
      query_by: 'headline',
      filter_by: 'active:true',
      sort_by: 'pinned:desc,dateAdded:desc',
      per_page: String(perPage),
    }).pipe(
      map(res => (res.hits ?? []).map((hit: any) => {
        const d = hit.document;
        return {
          _id: d.id,
          headline: d.headline,
          content: d.contentHtml || d.content,
          dateAdded: d.dateAdded ? d.dateAdded * 1000 : null,
          type: d.type,
          documentUrl: d.documentUrl || null,
          active: d.active,
          notificationName: d.notificationName || null,
          projectNotification: d.notificationName ? { name: d.notificationName } : null,
          project: d.projectId ? { _id: d.projectId, name: d.projectName || '' } : null,
          pcp: null,
        };
      }))
    );
  }

  /**
   * Fetches ALL projects from Typesense, paginating at 250/page.
   * Maps each hit to the shape ProjectsComponent / the map expects.
   * Used as a fast replacement for the MongoDB getAllFull() API call.
   */
  getAllProjects(): Observable<any[]> {
    const fetchPage = (page: number) =>
      this.searchCollection('projects', { q: '*', query_by: 'name', per_page: '250', page: String(page) });

    return fetchPage(1).pipe(
      expand(res => {
        const fetched = res.page * 250;
        return fetched < res.found ? fetchPage(res.page + 1) : EMPTY;
      }),
      reduce((acc: any[], res: any) => {
        const mapped = (res.hits ?? []).map((hit: any) => {
          const d = hit.document;
          return {
            _id:              d.id,
            name:             d.name             || null,
            description:      d.description      || null,
            location:         d.location         || null,
            sector:           d.sector           || null,
            region:           d.region           || null,
            type:             d.type             || null,
            status:           d.status           || null,
            currentPhaseName: d.currentPhaseName ? { name: d.currentPhaseName } : null,
            eacDecision:      d.eacDecision      ? { name: d.eacDecision }      : null,
            centroid:         d.centroid         || [],
          };
        });
        return acc.concat(mapped);
      }, [])
    );
  }

  /**
   * Fetches featured documents for a given project from Typesense.
   * Returns raw Typesense document fields (datePosted in seconds) suitable
   * for SearchDocumentCardComponent.
   */
  getFeaturedDocumentsCards(projId: string): Observable<any[]> {
    return this.searchCollection('documents', {
      q: '*',
      query_by: 'displayName',
      filter_by: `projectId:${projId} && isFeatured:true`,
      sort_by: 'datePosted:desc',
      per_page: '5',
    }).pipe(
      map(res => (res.hits ?? []).map((hit: any) => hit.document))
    );
  }

  /**
   * Fetches paginated activities for a given project from Typesense.
   * Returns items in the shape SearchActivityCardComponent expects:
   * - dateAdded / datePosted in seconds (card does *1000 internally via Algolia convention)
   * - _highlightResult.headline.value / _highlightResult.content.value for highlighted text
   * - projectId, projectName, type, notificationName, pcpId etc. as raw fields
   */
  getProjectActivitiesCards(
    projId: string,
    page: number,
    pageSize: number,
    sortBy: string,
    keywords: string,
  ): Observable<{ items: any[]; total: number }> {
    const tsSort = sortBy === '-score'
      ? '_text_match:desc,dateAdded:desc'
      : sortBy
        ? `${sortBy.slice(1)}:${sortBy.charAt(0) === '-' ? 'desc' : 'asc'}`
        : 'pinned:desc,dateAdded:desc';

    return this.searchCollection('activities', {
      q:           keywords || '*',
      query_by:    'headline,content',
      filter_by:   `projectId:${projId} && active:true`,
      sort_by:     tsSort,
      page:        String(page),
      per_page:    String(pageSize),
      highlight_full_fields: 'headline,content',
    }).pipe(
      map(res => ({
        total: res.found ?? 0,
        items: (res.hits ?? []).map((hit: any) => {
          const d = hit.document;
          // Build Algolia-compatible _highlightResult so SearchActivityCardComponent
          // can render <mark> tags from the Typesense snippet.
          const highlightResult: Record<string, any> = {};
          for (const h of (hit.highlights ?? [])) {
            highlightResult[h.field] = { value: h.value ?? h.snippet ?? '' };
          }
          return {
            ...d,
            _highlightResult: Object.keys(highlightResult).length ? highlightResult : undefined,
          };
        }),
      }))
    );
  }

  /**
   * Fetches paginated activities for a given project from Typesense.
   * Replaces the MongoDB RecentActivity search on the Activities & Updates tab.
   *
   * @param projId   Project ObjectID string
   * @param page     1-based page number
   * @param pageSize Items per page
   * @param sortBy   MongoDB-style sort string (e.g. '-dateAdded', '+dateAdded', '-score')
   * @param keywords Keyword search string (empty string = wildcard)
   */
  getProjectActivities(
    projId: string,
    page: number,
    pageSize: number,
    sortBy: string,
    keywords: string,
  ): Observable<{ items: any[]; total: number }> {
    // Convert MongoDB-style sort ('-dateAdded') to Typesense style ('dateAdded:desc')
    // '-score' means full-text relevance — map to _text_match:desc
    const tsSort = sortBy === '-score'
      ? '_text_match:desc,dateAdded:desc'
      : sortBy
        ? `${sortBy.slice(1)}:${sortBy.charAt(0) === '-' ? 'desc' : 'asc'}`
        : 'pinned:desc,dateAdded:desc';

    return this.searchCollection('activities', {
      q:           keywords || '*',
      query_by:    'headline,content',
      filter_by:   `projectId:${projId} && active:true`,
      sort_by:     tsSort,
      page:        String(page),
      per_page:    String(pageSize),
      highlight_full_fields: 'headline,content',
    }).pipe(
      map(res => ({
        total: res.found ?? 0,
        items: (res.hits ?? []).map((hit: any) => {
          const d = hit.document;
          const getHighlightValue = (field: string) =>
            hit.highlights?.find((h: any) => h.field === field)?.value;
          return {
            _id:                 d.id,
            // Full headline text with <mark> tags on matched terms
            headline:            getHighlightValue('headline') ?? d.headline ?? '',
            // Full content with <mark> tags when matched; falls back to rich
            // contentHtml when no match (contentHtml is not indexed so marks
            // can only appear in the plain-text content.value from Typesense)
            content:             getHighlightValue('content') ?? d.contentHtml ?? d.content ?? '',
            dateAdded:           d.dateAdded ? d.dateAdded * 1000 : null,
            type:                d.type                || null,
            documentUrl:         d.documentUrl         || null,
            active:              d.active,
            notificationName:    d.notificationName    || null,
            projectNotification: d.notificationName ? { name: d.notificationName } : null,
            project:             d.projectId ? { _id: d.projectId, name: d.projectName || '' } : null,
            // Reconstruct pcp object from stored fields so "View Engagement" button works
            pcp: d.pcpId ? {
              _id:    d.pcpId,
              isMet:  d.pcpIsMet  || false,
              metURL: d.pcpMetURL || null,
            } : null,
          };
        }),
      }))
    );
  }

  /**
   * Returns up to 5 project name suggestions for the given prefix query.
   * Used to drive the autocomplete dropdown on the map search input.
   * Only called when TYPESENSE_ENABLED is true.
   */
  getProjectSuggestions(query: string): Observable<{ id: string; name: string; highlighted: string }[]> {
    return this.searchCollection('projects', {
      q: query,
      query_by: 'name',
      per_page: '250',   // fetch up to 250 for accurate marker filtering; dropdown limits to 5
      num_typos: '1',
      highlight_fields: 'name',
      include_fields: 'id,name',
    }).pipe(
      map(res => (res.hits ?? []).map((hit: any) => {
        const snippet = hit.highlights?.[0]?.snippet ?? hit.document.name ?? '';
        return {
          id:          hit.document.id   as string,
          name:        hit.document.name as string,
          highlighted: snippet,
        };
      }))
    );
  }

  /** Makes a direct Typesense REST search call to the given collection. */
  private searchCollection(collection: string, params: Record<string, string>): Observable<any> {
    const config = this.configService.config();
    const apiKey = config.TYPESENSE_SEARCH_KEY || '';
    const baseUrl = this.buildSearchUrl();
    return this.http.get<any>(
      `${baseUrl}/collections/${collection}/documents/search?${new URLSearchParams(params)}`,
      { headers: { 'X-TYPESENSE-API-KEY': apiKey } }
    );
  }

  /**
   * Builds the base URL for direct Typesense REST calls.
   * For path-only TYPESENSE_SEARCH_HOST (deployed), prefixes with window.location.origin.
   * For absolute URLs (local dev), uses the URL directly.
   */
  private buildSearchUrl(): string {
    const config = this.configService.config();
    const searchHost = config.TYPESENSE_SEARCH_HOST || '/search-api';
    if (searchHost.startsWith('http')) {
      return searchHost.replace(/\/$/, '');
    }
    const origin = `${window.location.protocol}//${window.location.host}`;
    return `${origin}${searchHost}`;
  }

  /**
   * Parses TYPESENSE_SEARCH_HOST into connection params.
   * Handles both absolute URLs (local dev port-forward) and path-only values
   * (deployed, routed through rproxy on the same origin).
   */
  private parseHost(searchHost: string): { host: string; port: number; protocol: 'http' | 'https'; path: string } {
    if (searchHost.startsWith('http')) {
      const url = new URL(searchHost);
      const protocol = url.protocol.replace(':', '') as 'http' | 'https';
      const port = url.port ? parseInt(url.port, 10) : (protocol === 'https' ? 443 : 80);
      return { host: url.hostname, port, protocol, path: url.pathname === '/' ? '' : url.pathname };
    }
    const protocol = window.location.protocol.replace(':', '') as 'http' | 'https';
    const port = window.location.port ? parseInt(window.location.port, 10) : (protocol === 'https' ? 443 : 80);
    return { host: window.location.hostname, port, protocol, path: searchHost };
  }
}
