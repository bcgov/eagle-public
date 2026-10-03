import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { Document } from 'app/models/document';
import { LoggingService } from './logging.service';
import { SEARCH, envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

/**
 * Every public read goes to demi-search and the site makes no request to eagle-api. A read left on
 * eagle-api still renders, so the URL is the only place the mistake shows.
 */
describe('ApiService search routing', () => {
  let httpMock: HttpTestingController;

  function setup(): ApiService {
    httpMock = setupDemiApi();
    return TestBed.inject(ApiService);
  }

  function urlFor(api: ApiService, dataset: string, keys = 'cariboo'): string {
    api.searchKeywords(keys, dataset, [], 1, 10).subscribe();
    const req = httpMock.expectOne(() => true);
    req.flush(envelope([]));
    return req.request.url;
  }

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it.each([
    'Project', 'Document', 'DocumentChunk', 'RecentActivity', 'ProjectNotification',
    'Organization', 'CommentPeriod', 'Comment', 'List',
  ])('sends %s to demi-search', dataset => {
    expect(urlFor(setup(), dataset).startsWith(`${SEARCH}/search?dataset=${dataset}&`)).toBe(true);
  });

  it('sends no read to eagle-api', () => {
    const api = setup();
    const reads: Observable<unknown>[] = [
      api.searchKeywords('cariboo', 'Project', [], 1, 10),
      api.getCountProjects(),
      api.getProjectPins('p1', 1, 10, null),
      api.getOrgsByCompanyType('Proponent'),
      api.getProject('p1', null, null),
      api.getPeriodsByProjId('p1'),
      api.getPeriod('cp1'),
      api.getCountCommentsById('cp1'),
      api.getCommentsByPeriodId(1, 10, 'cp1'),
      api.getComment('c1'),
      api.getDocument('d1'),
      api.getDocumentsByMultiId(['d1']),
      api.getTopNewsItems(),
    ];
    reads.forEach(read => read.subscribe());
    const urls = httpMock.match(() => true).map(req => req.request.url);
    expect(urls.length).toBeGreaterThanOrEqual(reads.length);
    expect(urls.filter(url => url.startsWith('/api/'))).toEqual([]);
  });

  it('encodes the keywords', () => {
    expect(urlFor(setup(), 'Project', 'fish & chips #1')).toContain('&keywords=fish%20%26%20chips%20%231&');
  });

  it('sends no fields parameter', () => {
    expect(urlFor(setup(), 'Project')).not.toContain('fields=');
  });

  it('reads the home page strip from the RecentActivity top rows', async () => {
    const api = setup();
    const items = firstValueFrom(api.getTopNewsItems());
    const req = httpMock.expectOne(`${SEARCH}/search?dataset=RecentActivity&top=true`);
    req.flush(envelope([{ _id: 'a1', headline: 'Pinned' }]));
    expect((await items).map(item => item.headline)).toEqual(['Pinned']);
  });

  it('counts projects from the search total', async () => {
    const api = setup();
    const count = firstValueFrom(api.getCountProjects());
    searchRequest(httpMock, 'Project').flush(envelope([{ _id: 'p' }], 412));
    expect(await count).toBe(412);
  });

  it('splits a long docIds read into requests of at most 300 ids, answered in input order', async () => {
    const api = setup();
    const ids = Array.from({ length: 301 }, (_, i) => `d${i}`);
    const docs = firstValueFrom(api.getDocumentsByMultiId(ids));
    const [first, second] = httpMock.match(req => req.url.startsWith(`${SEARCH}/search?dataset=Document&`));
    expect(first.request.url).toContain(`&docIds=${ids.slice(0, 300).join('|')}&`);
    expect(first.request.url).toContain('&pageSize=300&');
    expect(second.request.url).toContain('&docIds=d300&');
    second.flush(envelope([{ _id: 'd300' }]));
    first.flush(envelope(ids.slice(0, 300).reverse().map(_id => ({ _id }))));
    expect((await docs).map(doc => doc._id)).toEqual(ids);
  });

  it('answers no documents for no ids without a request', async () => {
    expect(await firstValueFrom(setup().getDocumentsByMultiId([]))).toEqual([]);
  });

  it('stops reading organizations at 20 full pages and logs it', async () => {
    const api = setup();
    const warn = vi.spyOn(TestBed.inject(LoggingService), 'warn');
    const orgs = firstValueFrom(api.getOrgsByCompanyType('Proponent'));
    for (let page = 0; page < 20; page++) {
      searchRequest(httpMock, 'Organization').flush(envelope(Array.from({ length: 500 }, (_, i) => ({ _id: `${page}-${i}` }))));
    }
    expect((await orgs).length).toBe(10_000);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('opens a document in the browser through the demi-search download', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    setup().openDocument(new Document({ _id: 'doc1', documentFileName: 'a.pdf' }));
    expect(open).toHaveBeenCalledWith(`${SEARCH}/documents/doc1/download?redirect=1&inline=1`, '_blank');
  });

  it('downloads a document as a file, checked first, through the demi-search download', async () => {
    const done = setup().downloadDocument(new Document({ _id: 'doc1', displayName: 'a.pdf' }));
    httpMock.expectOne({ method: 'HEAD', url: `${SEARCH}/documents/doc1/download?redirect=1` }).flush(null);
    await done;
    const frame = document.body.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(`${SEARCH}/documents/doc1/download?redirect=1`);
    frame?.remove();
  });
});
