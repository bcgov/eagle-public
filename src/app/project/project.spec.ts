import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NEVER, config, of, throwError } from 'rxjs';

import { ProjectComponent } from './project';
import { ConfigService } from '../services/config.service';
import { ProjectService } from '../services/project.service';
import { CommentPeriodService } from '../services/commentperiod.service';
import { StorageService } from '../services/storage.service';
import { SearchService } from '../services/search.service';
import { LoggingService } from '../services/logging.service';
import { AnalyticsService } from '../services/analytics/analytics.service';
import { Utils } from '../shared/utils/utils';
import { CommentPeriod } from '../models/commentperiod';

const DAY = 24 * 60 * 60 * 1000;

describe('ProjectComponent', () => {
  let component: ProjectComponent;
  let mockSearchService: any;
  let mockLogger: any;
  let track: ReturnType<typeof vi.fn>;
  let unhandled: any;
  let originalOnUnhandledError: any;

  beforeEach(() => {
    // RxJS does NOT rethrow a throw from a next handler to the caller - it hands it to
    // config.onUnhandledError from inside a setTimeout. So `expect(...).not.toThrow()` alone
    // cannot see this bug: capture the escape hatch, and flush a macrotask before asserting.
    originalOnUnhandledError = config.onUnhandledError;
    unhandled = vi.fn();
    config.onUnhandledError = unhandled;

    // The component builds Leaflet objects in its field initializers and Leaflet is a global
    // loaded by angular.json scripts, not an import, so jsdom has no `L` without this.
    (globalThis as any).L = {
      featureGroup: () => ({}),
      latLngBounds: () => ({})
    };

    mockSearchService = { getSearchResults: vi.fn(() => of(null)) };
    mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    track = vi.fn();

    TestBed.configureTestingModule({
      imports: [ProjectComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => null }) } },
        { provide: Router, useValue: { events: of(), navigate: vi.fn() } },
        { provide: SearchService, useValue: mockSearchService },
        { provide: LoggingService, useValue: mockLogger },
        { provide: StorageService, useValue: {} },
        { provide: AnalyticsService, useValue: { track } },
        // `lists` never emits, so the constructor effect's initTabLinks() subscribes and then
        // stays put - the tabs under test are only ever driven by the explicit calls below.
        { provide: ConfigService, useValue: { config: () => ({}), lists: NEVER } },
        { provide: ProjectService, useValue: { getById: vi.fn(() => of(null)) } },
        { provide: CommentPeriodService, useValue: {} },
        Utils
      ]
    });
    TestBed.overrideTemplate(ProjectComponent, '');

    component = TestBed.createComponent(ProjectComponent).componentInstance;
    // `legislation` is read by the constructor effect, which runs on TestBed's auto change
    // detection; without it the effect throws and the run reports an unhandled error.
    component.project.set({ _id: 'project-1', legislation: '2018 Act' } as any);
  });

  afterEach(() => {
    config.onUnhandledError = originalOnUnhandledError;
  });

  describe('tabLinkIfNotEmpty()', () => {
    // demi-api answers non-2xx when a search fails, and search.service.getSearchResults turns
    // any non-2xx into a single `null` rather than an array (search.service.ts:65-69). This
    // subscriber used to dereference res[0].data.searchResults on that, throwing a TypeError
    // that nothing caught because a next handler's throw does not reach an error handler.
    const key = 'amendment';
    const modifier = { documentSource: 'AMENDMENT' };
    const flushUnhandled = () => new Promise(resolve => setTimeout(resolve, 0));

    it('does not throw when the search fails and answers null', async () => {
      mockSearchService.getSearchResults.mockReturnValue(of(null));

      expect(() => (component as any).tabLinkIfNotEmpty(key, modifier)).not.toThrow();
      await flushUnhandled();
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('does not throw on an empty response array', async () => {
      mockSearchService.getSearchResults.mockReturnValue(of([]));

      expect(() => (component as any).tabLinkIfNotEmpty(key, modifier)).not.toThrow();
      await flushUnhandled();
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('leaves the optional tab hidden when the search fails', async () => {
      mockSearchService.getSearchResults.mockReturnValue(of(null));

      (component as any).tabLinkIfNotEmpty(key, modifier);

      await flushUnhandled();
      expect(unhandled).not.toHaveBeenCalled();
      expect(component.tabLinks().find(tab => tab.key === key)?.display).toBe(false);
    });

    it('logs the unusable answer, so a 502 does not hide the tab silently', async () => {
      // The `error` callback cannot see this: getSearchResults has already converted the HTTP
      // failure to `null` on the NEXT channel. Without the log inside the next handler, a failed
      // search and a genuinely document-less project are indistinguishable in the console.
      mockSearchService.getSearchResults.mockReturnValue(of(null));

      (component as any).tabLinkIfNotEmpty(key, modifier);

      await flushUnhandled();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(component.tabLinks().find(tab => tab.key === key)?.display).toBe(false);
    });

    it('logs an envelope that carries data but no searchResults', async () => {
      // Not the same shape as `null`. extractFromSearchResults used to return `undefined` here —
      // the `as T[]` cast hid it from the declared `T[] | null` — so a `=== null` guard skipped
      // the diagnostic for exactly this case while the sibling call site logged it.
      mockSearchService.getSearchResults.mockReturnValue(of([{ data: { meta: [] } }]));

      (component as any).tabLinkIfNotEmpty(key, modifier);

      await flushUnhandled();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(component.tabLinks().find(tab => tab.key === key)?.display).toBe(false);
    });

    it('does not log when the search legitimately finds nothing', async () => {
      // The control for the test above: a well-formed empty result must stay quiet, or the log
      // above is satisfied by logging on every no-hit search and says nothing.
      mockSearchService.getSearchResults.mockReturnValue(of([{ data: { searchResults: [] } }]));

      (component as any).tabLinkIfNotEmpty(key, modifier);

      await flushUnhandled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs an error when the stream itself errors', () => {
      mockSearchService.getSearchResults.mockReturnValue(throwError(() => new Error('boom')));

      expect(() => (component as any).tabLinkIfNotEmpty(key, modifier)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('still shows the tab when documents come back', () => {
      mockSearchService.getSearchResults.mockReturnValue(
        of([{ data: { searchResults: [{ _id: 'doc-1' }] } }])
      );

      (component as any).tabLinkIfNotEmpty(key, modifier);

      expect(component.tabLinks().find(tab => tab.key === key)?.display).toBe(true);
    });
  });

  it('names the project banner as the source of a banner click', () => {
    component.project.set({ _id: 'project-1', name: 'Site C', legislation: '2018 Act', commentPeriodForBanner: openPeriod() } as any);

    component.goToViewComments();

    expect(track).toHaveBeenCalledExactlyOnceWith('Comment Period Banner Clicked',
      expect.objectContaining({ destination: 'comment_period_details', source: 'project_banner' }));
  });
});

describe('ProjectComponent period banner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function render(instructions: string): HTMLElement {
    (globalThis as any).L = { featureGroup: () => ({}), latLngBounds: () => ({}) };
    // The tab arrows watch the tab strip; jsdom has no ResizeObserver.
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
    TestBed.configureTestingModule({
      imports: [ProjectComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => null }) } },
        { provide: Router, useValue: { events: of(), navigate: vi.fn() } },
        { provide: SearchService, useValue: { getSearchResults: vi.fn(() => of(null)) } },
        { provide: LoggingService, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } },
        { provide: StorageService, useValue: {} },
        { provide: AnalyticsService, useValue: { track: vi.fn() } },
        { provide: ConfigService, useValue: { config: () => ({}), lists: NEVER } },
        { provide: ProjectService, useValue: { getById: vi.fn(() => of(null)) } },
        { provide: CommentPeriodService, useValue: {} },
        Utils
      ]
    });
    // The real template, with the router, sidebar and banner children left unrendered.
    TestBed.overrideComponent(ProjectComponent, { set: { imports: [CommonModule], schemas: [NO_ERRORS_SCHEMA] } });
    const fixture = TestBed.createComponent(ProjectComponent);
    fixture.componentInstance.project.set(
      { _id: 'project-1', legislation: '2018 Act', commentPeriodForBanner: openPeriod({ instructions }) } as any
    );
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('keeps instruction formatting but strips script from it', () => {
    // Angular warns when it strips content; the warning is expected here.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = render('<b>Read first</b><img src="x" onerror="alert(1)">');
    expect(el.querySelector('#instructions b')?.textContent).toBe('Read first');
    expect(el.querySelector('#instructions img')?.hasAttribute('onerror')).toBe(false);
  });
});

function openPeriod(fields: object = {}): CommentPeriod {
  return new CommentPeriod({
    _id: 'cp1',
    dateStarted: new Date(Date.now() - DAY).toISOString(),
    dateCompleted: new Date(Date.now() + 7 * DAY).toISOString(),
    ...fields,
  });
}
