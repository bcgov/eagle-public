import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { buildSearchQuery } from 'app/services/api';
import { LoggingService } from 'app/services/logging.service';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { setupDemiApi } from 'app/services/demi-api.spec-helper';
import { Utils } from './utils';
import { SearchQueryLimit } from './search-query-limit';

describe('SearchQueryLimit', () => {
  function setup() {
    const tableService = { fetchData: vi.fn() };
    setupDemiApi([{ provide: TableService, useValue: tableService }]);
    const warn = vi.spyOn(TestBed.inject(LoggingService), 'warn');
    return { tableService, warn, limit: TestBed.inject(SearchQueryLimit), utils: TestBed.inject(Utils) };
  }

  /** A document search whose query string (after `?`) is `length` characters, padded with `pad`. */
  function searchOfLength(utils: Utils, length: number, pad = 'x'): SearchParamObject {
    const search = new SearchParamObject('t', '', 'Document', [], 1, 10, '-datePosted', { project: 'p1' }, true, '', { type: '' });
    const base = buildSearchQuery(search, utils).length - 'search?'.length;
    search.filters = { type: pad.repeat(length - base) };
    return search;
  }

  it('sends a search whose query is 2000 characters', () => {
    const { tableService, limit, utils } = setup();
    const search = searchOfLength(utils, 2000);

    expect(limit.fetchIfFits(search)).toBe(true);
    expect(tableService.fetchData).toHaveBeenCalledWith(search);
  });

  it('does not send a search whose query is 2001 characters', () => {
    const { tableService, limit, utils } = setup();

    expect(limit.fetchIfFits(searchOfLength(utils, 2001))).toBe(false);
    expect(tableService.fetchData).not.toHaveBeenCalled();
  });

  it('counts a space as the three characters the browser sends', () => {
    const { tableService, limit, utils } = setup();

    expect(limit.fetchIfFits(searchOfLength(utils, 1000, ' '))).toBe(false);
    expect(tableService.fetchData).not.toHaveBeenCalled();
  });

  it('logs the length and table of a search it does not send', () => {
    const { warn, limit, utils } = setup();

    limit.fetchIfFits(searchOfLength(utils, 2001));

    expect(warn).toHaveBeenCalledWith('Search not sent: query is 2001 characters', 'SearchQueryLimit', { tableId: 't' });
  });
});
