import { Injectable, inject } from '@angular/core';
import { buildSearchQuery } from 'app/services/api';
import { LoggingService } from 'app/services/logging.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { Utils } from './utils';

/** The prod edge answers 404 to a search query of about 1900 characters or more. */
const MAX_SEARCH_QUERY_LENGTH = 1800;

export const TOO_MANY_FILTERS_MESSAGE = 'Too many filters selected. Remove some filters and try again.';

@Injectable({ providedIn: 'root' })
export class SearchQueryLimit {
  private readonly tableService = inject(TableService);
  private readonly utils = inject(Utils);
  private readonly logger = inject(LoggingService);

  /** Sends the search unless its query is too long for the prod edge. Returns whether it was sent. */
  fetchIfFits(search: SearchParamObject): boolean {
    const length = buildSearchQuery(search, this.utils).length;
    if (length > MAX_SEARCH_QUERY_LENGTH) {
      this.logger.warn(`Search not sent: query is ${length} characters`, 'SearchQueryLimit', { tableId: search.tableId });
      return false;
    }
    this.tableService.fetchData(search);
    return true;
  }
}
