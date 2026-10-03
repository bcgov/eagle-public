import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, tap } from 'rxjs';
import { LoggingService } from '../services/logging.service';

/**
 * Simple HTTP cache for GET requests.
 * Caches responses for 5 minutes by default.
 */

interface CacheEntry {
  response: HttpResponse<any>;
  timestamp: number;
}

class HttpCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

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

  // If not cached, make the request and cache the response
  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        logger.debug(`Caching response for: ${req.url}`, 'HttpCache');
        cacheService.set(req.urlWithParams, event);
      }
    })
  );
};

// Export cache service for manual cache management
export { cacheService as HttpCacheService };
