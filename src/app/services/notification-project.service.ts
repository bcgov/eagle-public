import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';
import {
  type DisplayItem,
  mapNotificationApiHit,
  buildNotificationFacets,
} from 'app/search/search-collections';

export interface NotificationSearchResult {
  items: any[];
  totalCount: number;
  facets: Record<string, DisplayItem[]>;
}

export interface NotificationDateRange {
  fromKey?: string;  // URL param key for from date (e.g. 'dateRangeStart')
  toKey?: string;    // URL param key for to date (e.g. 'dateRangeEnd')
  params: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class NotificationProjectService {
  private api = inject(ApiService);

  /**
   * Search ProjectNotifications via eagle-api.
   * Applies client-side facet+date filtering (API returns all, filter locally).
   */
  search(
    query: string,
    refs: Record<string, Set<string>>,
    dateRange: NotificationDateRange,
  ): Observable<NotificationSearchResult> {
    return this.api.searchKeywords(
      query,
      'ProjectNotification',
      [],      // fields — return all
      1, 250,
      '',      // projectLegislation
      '-notificationReceivedDate',
      {},      // queryModifier
      true,    // populate — joins documents[]
      null,    // secondarySort
      {},      // filter — applied client-side
      false,   // fuzzy
    ).pipe(
      map((raw: any) => {
        const all: any[] = raw?.[0]?.searchResults ?? [];
        const filtered = this.applyClientFilters(all, refs, dateRange);

        return {
          items:      filtered.map(n => mapNotificationApiHit(n)),
          totalCount: filtered.length,
          facets:     buildNotificationFacets(all, refs),
        };
      }),
      catchError(() => of({ items: [], totalCount: 0, facets: {} })),
    );
  }

  /**
   * Fetch a single ProjectNotification by its ID.
   * Returns the mapped notification object or null if not found.
   */
  getById(id: string): Observable<any | null> {
    return this.api.searchKeywords(
      '',
      'ProjectNotification',
      [],
      1, 1,
      '',
      '',
      { _id: id },  // queryModifier: adds &and[_id]=id
      false,
      null,
      {},
      false,
    ).pipe(
      map((raw: any) => {
        const hit = raw?.[0]?.searchResults?.[0];
        return hit ? mapNotificationApiHit(hit) : null;
      }),
      catchError(() => of(null)),
    );
  }

  private applyClientFilters(
    all: any[],
    refs: Record<string, Set<string>>,
    dateRange: NotificationDateRange,
  ): any[] {
    const { fromKey, toKey, params } = dateRange;

    const fromMs = fromKey && params[fromKey]
      ? new Date(params[fromKey] + 'T00:00:00Z').getTime() : null;
    const toMs = toKey && params[toKey]
      ? new Date(params[toKey] + 'T23:59:59Z').getTime() : null;

    return all.filter(n => {
      for (const [attr, values] of Object.entries(refs)) {
        if (values.size > 0 && !values.has(n[attr] ?? '')) return false;
      }
      if (fromMs || toMs) {
        const d = n.notificationReceivedDate
          ? new Date(n.notificationReceivedDate).getTime() : null;
        if (!d) return false;
        if (fromMs && d < fromMs) return false;
        if (toMs && d > toMs) return false;
      }
      return true;
    });
  }
}
