import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { ApiService } from './api';

@Injectable({ providedIn: 'root' })
export class NotificationProjectService {
  private api = inject(ApiService);

  /**
   * Fetch a single ProjectNotification by its ID.
   * Returns the notification's name for display, or null if not found.
   */
  getById(id: string): Observable<{ name: string } | null> {
    return this.api.searchKeywords(
      '',
      'ProjectNotification',
      [],
      1, 1,
      '',
      '',
      { _id: id },
      false,
      null,
      {},
      false,
    ).pipe(
      map((raw: any) => {
        const hit = raw?.[0]?.searchResults?.[0];
        return hit ? { name: hit.name || '' } : null;
      }),
      catchError(() => of(null)),
    );
  }
}
