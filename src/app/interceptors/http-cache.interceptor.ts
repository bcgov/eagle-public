import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';
import { LoggingService } from '../services/logging.service';

/**
 * Simple HTTP cache for GET requests.
 * Caches responses for 15 minutes by default.
 */

interface CacheEntry {
  response: HttpResponse<any>;
  timestamp: number;
}

class HttpCacheService {
  private cache = new Map<string, CacheEntry>();
  inFlight = new Map<string, Observable<HttpEvent<any>>>();
  private readonly defaultTTL = 15 * 60 * 1000; // 15 minutes

  get(url: string): HttpResponse<any> | null {
    const entry = this.cache.get(url);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      // Cache expired
      this.cache.delete(url);
      return null;
    }

    return entry.response;
  }

  set(url: string, response: HttpResponse<any>): void {
    this.cache.set(url, {
      response,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  clearByPrefix(prefix: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    });
  }
}

// Singleton cache service
const cacheService = new HttpCacheService();

export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggingService);
  
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  // Don't cache proxy Typesense requests — Typesense adapter has its own 120 s cache
  // and the shareReplay ghost-request pattern here causes stale results + missed retries
  if (req.url.includes('/typesense/')) {
    return next(req);
  }

  // Don't cache requests with cache-control: no-cache header
  if (req.headers.has('cache-control') && req.headers.get('cache-control') === 'no-cache') {
    return next(req);
  }

  // Check if we have a cached response
  const cachedResponse = cacheService.get(req.urlWithParams);
  if (cachedResponse) {
    logger.debug(`Cache hit for: ${req.url}`, 'HttpCache');
    return of(cachedResponse.clone());
  }

  // Check for an in-flight request to coalesce parallel identical requests
  const existing = cacheService.inFlight.get(req.urlWithParams);
  if (existing) {
    logger.debug(`Coalescing duplicate request: ${req.url}`, 'HttpCache');
    return existing;
  }

  // Make the request, cache the response, and track it as in-flight
  const request$ = next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        logger.debug(`Caching response for: ${req.url}`, 'HttpCache');
        cacheService.set(req.urlWithParams, event);
      }
    }),
    shareReplay(1),
    finalize(() => cacheService.inFlight.delete(req.urlWithParams))
  );

  cacheService.inFlight.set(req.urlWithParams, request$);
  return request$;
};

// Export cache service for manual cache management
export { cacheService as HttpCacheService };
