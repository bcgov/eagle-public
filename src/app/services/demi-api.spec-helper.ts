import { TestBed } from '@angular/core/testing';
import { Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { ConfigService } from './config.service';
import { LoggingService } from './logging.service';
import { AnalyticsService } from './analytics/analytics.service';

export const SEARCH = '/demi-search';
export const DEMI_PROJECTS = '/demi-projects';

const noop = () => undefined;

/**
 * A TestBed with the real ApiService over HttpTestingController, pointed at the DEMI defaults.
 * `lists` stands in for the `List` rows ConfigService would load.
 */
export function setupDemiApi(providers: Provider[] = [], lists: any[] = []): HttpTestingController {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ConfigService,
        useValue: {
          getSearchApiPath: () => SEARCH,
          getDemiProjectsPath: () => DEMI_PROJECTS,
          config: () => ({}),
          lists: of(lists),
        },
      },
      { provide: LoggingService, useValue: { debug: noop, trace: noop, log: noop, warn: noop, error: noop } },
      { provide: AnalyticsService, useValue: { track: noop } },
      ...providers,
    ],
  });
  return TestBed.inject(HttpTestingController);
}

/** The `[{searchResults, meta}]` envelope demi-search answers with. */
export function envelope(rows: any[], total: number = rows.length): any[] {
  return [{ searchResults: rows, meta: [{ searchResultsTotal: total }] }];
}

/** The one pending `/search` request for `dataset`. */
export function searchRequest(httpMock: HttpTestingController, dataset: string): TestRequest {
  return httpMock.expectOne(req => req.url.startsWith(`${SEARCH}/search?dataset=${dataset}&`));
}
