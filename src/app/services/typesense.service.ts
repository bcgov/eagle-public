import { Injectable, inject } from '@angular/core';
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

  private cachedSearchClient: any = null;
  private cachedClientKey = '';
  private lastHitsCache: Record<string, any[]> = {};
  private lastFacetsCache: Record<string, Record<string, any[]>> = {};

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
    // Include sort_by in cache key — different sort orders require separate adapter instances
    // because sort_by is fixed in additionalSearchParameters at adapter construction time.
    const sortKey = additionalSearchParameters['sort_by'] ?? '';
    const clientKey = `${apiKey}@${host}:${port}${path}|${additionalSearchParameters.query_by}|${sortKey}`;

    if (!this.cachedSearchClient || this.cachedClientKey !== clientKey) {
      const adapter = new TypesenseInstantSearchAdapter({
        server: { apiKey, nodes: [{ host, port, protocol, path }], connectionTimeoutSeconds: 5 },
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
