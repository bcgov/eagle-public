import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { buildSearchQuery } from 'app/services/api';
import { LoggingService } from 'app/services/logging.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { Utils } from './utils';

// Test edge, 2026-10-03, bisected with GETs: a query string (after `?`, percent-encoded) of 2048
// characters passes and 2049 gets an HTML 404 before APIM; path length does not count.
const EDGE_QUERY_LIMIT = 2048;
// Margin for a browser that percent-encodes a few more characters than the URL parser here.
const MAX_SEARCH_QUERY_LENGTH = EDGE_QUERY_LIMIT - 48;

export const SEARCH_TOO_LONG_MESSAGE = 'Your search is too long. Remove some filters or use fewer keywords and try again.';

/** The query string a search sends, measured as the browser puts it on the wire. */
function encodedQueryLength(query: string): number {
  return new URL(query, 'https://localhost/').search.length - 1;
}

@Injectable({ providedIn: 'root' })
export class SearchQueryLimit {
  private readonly tableService = inject(TableService);
  private readonly utils = inject(Utils);
  private readonly logger = inject(LoggingService);

  /** Sends the search unless its query is too long for the edge. Returns whether it was sent. */
  fetchIfFits(search: SearchParamObject): boolean {
    const length = encodedQueryLength(buildSearchQuery(search, this.utils));
    if (length > MAX_SEARCH_QUERY_LENGTH) {
      this.logger.warn(`Search not sent: query is ${length} characters`, 'SearchQueryLimit', { tableId: search.tableId });
      return false;
    }
    this.tableService.fetchData(search);
    return true;
  }
}

/** Shown in place of results when a search was too long to send. */
@Component({
  selector: 'app-search-too-long',
  template: '<p class="text-danger" role="alert">{{ message }}</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class SearchTooLongComponent {
  protected readonly message = SEARCH_TOO_LONG_MESSAGE;
}
