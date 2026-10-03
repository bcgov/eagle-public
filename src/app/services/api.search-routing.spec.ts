import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api';
import { Document } from 'app/models/document';
import { LoggingService } from './logging.service';
import { AnalyticsService } from './analytics/analytics.service';
import { DEMI_PROJECTS, SEARCH, envelope, searchRequest, setupDemiApi } from './demi-api.spec-helper';

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
    expect(urls.filter(url => !url.startsWith(`${SEARCH}/`) && !url.startsWith(`${DEMI_PROJECTS}/`))).toEqual([]);
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

  describe('a long docIds read', () => {
    // A real period: 167 Mongo ids. The prod edge 404s a 1919-char query, so 1500 leaves margin.
    const ids = Array.from({ length: 167 }, (_, i) => i.toString(16).padStart(24, '0'));
    const QUERY_BUDGET = 1500;

    function documentReads() {
      return httpMock.match(req => req.url.startsWith(`${SEARCH}/search?dataset=Document&`));
    }

    function idsOf(req: { request: { urlWithParams: string } }): string[] {
      return new URLSearchParams(req.request.urlWithParams.split('?')[1]).get('docIds')!.split('|');
    }

    it('splits into requests whose query stays under the edge limit, even with `|` sent as %7C', () => {
      const api = setup();
      api.getDocumentsByMultiId(ids).subscribe();
      const reads = documentReads();
      expect(reads.length).toBeGreaterThan(1);
      reads.forEach(req => {
        const query = req.request.urlWithParams.split('?')[1];
        expect(query.replaceAll('|', '%7C').length).toBeLessThanOrEqual(QUERY_BUDGET);
        expect(query).toContain(`&pageSize=${idsOf(req).length}&`);
      });
      expect(reads.flatMap(idsOf)).toEqual(ids);
      reads.forEach(req => req.flush(envelope([])));
    });

    it('answers in input order whatever order the batches return', async () => {
      const api = setup();
      const docs = firstValueFrom(api.getDocumentsByMultiId(ids));
      documentReads().reverse().forEach(req => req.flush(envelope(idsOf(req).reverse().map(_id => ({ _id })))));
      expect((await docs).map(doc => doc._id)).toEqual(ids);
    });

    it('still shows the other batches when one fails, and warns once', async () => {
      const api = setup();
      const warn = vi.spyOn(TestBed.inject(LoggingService), 'warn');
      const docs = firstValueFrom(api.getDocumentsByMultiId(ids));
      const [lost, ...kept] = documentReads();
      lost.flush('gone', { status: 404, statusText: 'Not Found' });
      kept.forEach(req => req.flush(envelope(idsOf(req).map(_id => ({ _id })))));
      expect((await docs).map(doc => doc._id)).toEqual(ids.slice(idsOf(lost).length));
      expect(warn).toHaveBeenCalledOnce();
    });
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

  describe('downloadDocument', () => {
    const DOWNLOAD = `${SEARCH}/documents/doc1/download?redirect=1`;
    const frameFor = () => document.body.querySelector(`iframe[src="${DOWNLOAD}"]`);
    let track: ReturnType<typeof vi.fn>;

    function download(): Promise<void> {
      track = vi.fn();
      httpMock = setupDemiApi([{ provide: AnalyticsService, useValue: { track } }]);
      return TestBed.inject(ApiService).downloadDocument(new Document({ _id: 'doc1', displayName: 'a.pdf' }));
    }

    afterEach(() => frameFor()?.remove());

    it('downloads as a file through the demi-search download once the check passes, and counts it', async () => {
      const done = download();
      httpMock.expectOne({ method: 'HEAD', url: DOWNLOAD }).flush(null);
      await done;
      expect(frameFor()).not.toBeNull();
      expect(track).toHaveBeenCalledWith('Document Downloaded', expect.objectContaining({ document_id: 'doc1' }));
    });

    it('neither downloads nor counts a document whose check fails', async () => {
      const done = download();
      expect(track).not.toHaveBeenCalled();
      httpMock.expectOne({ method: 'HEAD', url: DOWNLOAD }).flush(null, { status: 404, statusText: 'Not Found' });
      await expect(done).rejects.toMatchObject({ status: 404 });
      expect(frameFor()).toBeNull();
      expect(track).not.toHaveBeenCalled();
    });
  });
});
