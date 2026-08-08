import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api';
import { ConfigService } from './config.service';
import { LoggingService } from './logging.service';

/**
 * Which backend does a search go to?
 *
 * Project, Document and DocumentChunk move to eagle-search (Azure AI Search) when SEARCH_API_PATH
 * is set; everything else stays on eagle-api. Getting this wrong is invisible in the UI — results
 * still render, they just come from the wrong place, or the kill switch silently fails to work.
 */
describe('ApiService search routing', () => {
  const SEARCH = 'https://eagle-search-api-dev.azurewebsites.net';
  let httpMock: HttpTestingController;

  function setup(searchApiPath: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
        {
          provide: ConfigService,
          useValue: {
            getApiPath: () => '/api',
            getSearchApiPath: () => searchApiPath || '/api',
            config: () => ({}),
          },
        },
        { provide: LoggingService, useValue: { debug: vi.fn(), trace: vi.fn(), error: vi.fn(), log: vi.fn() } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(ApiService);
  }

  function urlFor(api: ApiService, dataset: string): string {
    api.searchKeywords('cariboo', dataset, [], 1, 10).subscribe({ error: () => undefined });
    const req = httpMock.expectOne(() => true);
    const url = req.request.urlWithParams || req.request.url;
    req.flush([{ searchResults: [], meta: [] }]);
    return url;
  }

  afterEach(() => httpMock.verify());

  it('routes Project, Document and DocumentChunk to eagle-search when configured', () => {
    const api = setup(SEARCH);
    for (const dataset of ['Project', 'Document', 'DocumentChunk']) {
      expect(urlFor(api, dataset)).toContain(SEARCH);
    }
  });

  it('leaves every other dataset on eagle-api', () => {
    const api = setup(SEARCH);
    for (const dataset of ['RecentActivity', 'ProjectNotification', 'Organization']) {
      const url = urlFor(api, dataset);
      expect(url).not.toContain(SEARCH);
      expect(url.startsWith('/api/')).toBe(true);
    }
  });

  // The kill switch. Clearing SEARCH_API_PATH must send everything back to eagle-api with no
  // redeploy — a kill switch that has never been exercised is not a kill switch.
  it('falls back to eagle-api when SEARCH_API_PATH is empty', () => {
    const api = setup('');
    for (const dataset of ['Project', 'Document', 'DocumentChunk']) {
      const url = urlFor(api, dataset);
      expect(url).not.toContain(SEARCH);
      expect(url.startsWith('/api/')).toBe(true);
    }
  });
});
