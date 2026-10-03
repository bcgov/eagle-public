import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api';
import { SEARCH, envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

const A = '5cf00c03a266b7e1877504cb';
const B = '5cf00c03a266b7e1877504d1';
const C = '5cf00c03a266b7e1877504d2';

/** The query demi-search receives, split into its `and[...]` pairs. */
describe('ApiService search query', () => {
  let httpMock: HttpTestingController;

  function andPairs(read: (api: ApiService) => void): string[] {
    httpMock = setupDemiApi();
    read(TestBed.inject(ApiService));
    const req = searchRequest(httpMock, 'Document');
    req.flush(envelope([]));
    return req.request.url.split('&').filter(pair => pair.startsWith('and['));
  }

  afterEach(() => httpMock.verify());

  it('sends the picks for one filter as one comma list', () => {
    const pairs = andPairs(api => api.searchKeywords('', 'Document', [], 1, 10, '', null, {}, false, null,
      { type: `${A},${B}`, milestone: C }).subscribe());

    expect(pairs).toEqual([`and[type]=${A},${B}`, `and[milestone]=${C}`]);
  });

  it('sends a query modifier as one comma list', () => {
    const pairs = andPairs(api => api.searchKeywords('', 'Document', [], 1, 10, '', null,
      { project: 'p1', type: `${A},${B},${C}` }).subscribe());

    expect(pairs).toEqual(['and[project]=p1', `and[type]=${A},${B},${C}`]);
  });

  it('builds the whole query in a fixed order, skipping null and undefined filters', () => {
    httpMock = setupDemiApi();
    TestBed.inject(ApiService).searchKeywords('oil sands', 'Document', [{ name: 'project', value: 'p1' }], 2, 25, '',
      '-datePosted', { documentSource: 'PROJECT' }, true, '+displayName',
      { type: `${A},${B}`, milestone: null as unknown as string, projectPhase: undefined as unknown as string }, true).subscribe();
    const req = searchRequest(httpMock, 'Document');
    req.flush(envelope([]));

    expect(req.request.url).toBe(`${SEARCH}/search?dataset=Document&project=p1&keywords=oil%20sands&pageNum=1&pageSize=25`
      + `&projectLegislation=default&sortBy=-datePosted&sortBy=+displayName&populate=true`
      + `&and[documentSource]=PROJECT&and[type]=${A},${B}&fuzzy=true`);
  });

  it('encodes each value holding `&` on its own', () => {
    const pairs = andPairs(api => api.searchKeywords('', 'Document', [], 1, 10, '', null, {}, false, null,
      { type: `Oil & Gas,${A}` }).subscribe());

    expect(pairs).toEqual([`and[type]=Oil%20%26%20Gas,${A}`]);
  });
});
