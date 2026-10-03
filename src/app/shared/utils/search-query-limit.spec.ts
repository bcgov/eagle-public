import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { buildSearchQuery } from 'app/services/api';
import { SearchParamObject } from 'app/services/search.service';
import { TableService } from 'app/services/table.service';
import { setupDemiApi } from 'app/services/demi-api.spec-helper';
import { Utils } from './utils';
import { SearchQueryLimit } from './search-query-limit';

describe('SearchQueryLimit', () => {
  function setup() {
    const tableService = { fetchData: vi.fn() };
    setupDemiApi([{ provide: TableService, useValue: tableService }]);
    return { tableService, limit: TestBed.inject(SearchQueryLimit), utils: TestBed.inject(Utils) };
  }

  /** A document search whose query is exactly `length` characters. */
  function searchOfLength(utils: Utils, length: number): SearchParamObject {
    const search = new SearchParamObject('t', '', 'Document', [], 1, 10, '-datePosted', { project: 'p1' }, true, '', { type: '' });
    const base = buildSearchQuery(search, utils).length;
    search.filters = { type: 'x'.repeat(length - base) };
    return search;
  }

  it('sends a search of 1800 characters', () => {
    const { tableService, limit, utils } = setup();
    const search = searchOfLength(utils, 1800);

    expect(limit.fetchIfFits(search)).toBe(true);
    expect(tableService.fetchData).toHaveBeenCalledWith(search);
  });

  it('does not send a search of 1801 characters', () => {
    const { tableService, limit, utils } = setup();

    expect(limit.fetchIfFits(searchOfLength(utils, 1801))).toBe(false);
    expect(tableService.fetchData).not.toHaveBeenCalled();
  });
});
