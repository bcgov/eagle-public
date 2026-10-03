import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, Provider } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { NEVER, Subject, of } from 'rxjs';

import { CommentsComponent } from './comments.component';
import { ToastService } from '../services/toast.service';
import { CommentPeriod } from '../models/commentperiod';
import { Project } from '../models/project';
import { CommentPeriodService } from '../services/commentperiod.service';
import { CommentService } from '../services/comment.service';
import { ProjectService } from '../services/project.service';
import { DocumentService } from '../services/document.service';
import { AnalyticsService } from '../services/analytics/analytics.service';
import { SEARCH, setupDemiApi } from '../services/demi-api.spec-helper';

const DOWNLOAD = `${SEARCH}/documents/doc1/download?redirect=1`;
const DAY = 24 * 60 * 60 * 1000;
const METURL = 'https://engage.eao.gov.bc.ca/site-c';
const route = () => [
  { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ projId: 'p1', commentPeriodId: 'cp1' })) } },
  { provide: Router, useValue: { navigate: vi.fn(), url: '/p/p1/cp/cp1/details' } },
  { provide: ProjectService, useValue: { getById: () => of(new Project({ _id: 'p1', name: 'Site C' })) } },
];

function openPeriod(fields: object = {}): CommentPeriod {
  return new CommentPeriod({
    _id: 'cp1',
    // Differs from the project record's id, so a test can tell which one was used.
    project: 'period-p1',
    dateStarted: new Date(Date.now() - DAY).toISOString(),
    dateCompleted: new Date(Date.now() + 7 * DAY).toISOString(),
    ...fields,
  });
}

/** Attachment downloads run through the real ApiService; only the HEAD check answers vary. */
describe('CommentsComponent attachment download', () => {
  let httpMock: HttpTestingController;
  let show: ReturnType<typeof vi.fn>;

  function setup(): CommentsComponent {
    show = vi.fn();
    httpMock = setupDemiApi([
      { provide: ToastService, useValue: { show } },
      // No route ids, so the constructor loads nothing.
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate: vi.fn(), url: '' } },
      { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
    ]);
    return TestBed.runInInjectionContext(() => new CommentsComponent());
  }

  function frame(): HTMLIFrameElement | null {
    return document.body.querySelector(`iframe[src="${DOWNLOAD}"]`);
  }

  // The download leaves a one-minute timer to remove its frame.
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    httpMock.verify();
    frame()?.remove();
    vi.useRealTimers();
  });

  it('checks the file, then starts the download and says so', async () => {
    const done = setup().downloadDocument({ _id: 'doc1', displayName: 'a.pdf' });
    const req = httpMock.expectOne(DOWNLOAD);
    expect(req.request.method).toBe('HEAD');
    req.flush(null);
    await done;
    expect(frame()).not.toBeNull();
    expect(show).toHaveBeenCalledWith('Starting download', '', { duration: 2000, type: 'info' });
  });

  it('shows an error and starts nothing when the file is missing', async () => {
    const done = setup().downloadDocument({ _id: 'doc1', displayName: 'a.pdf' });
    httpMock.expectOne(DOWNLOAD).flush(null, { status: 404, statusText: 'Not Found' });
    await done;
    expect(frame()).toBeNull();
    expect(show).toHaveBeenCalledExactlyOnceWith('Error opening document! Please try again later', '', { duration: 2000, type: 'error' });
  });

  it('shows an error when the check cannot reach the server', async () => {
    const done = setup().downloadDocument({ _id: 'doc1', displayName: 'a.pdf' });
    httpMock.expectOne(DOWNLOAD).error(new ProgressEvent('error'));
    await done;
    expect(frame()).toBeNull();
    expect(show).toHaveBeenCalledExactlyOnceWith('Error opening document! Please try again later', '', { duration: 2000, type: 'error' });
  });
});

describe('CommentsComponent period banner', () => {
  let track: ReturnType<typeof vi.fn>;

  afterEach(() => vi.restoreAllMocks());

  function render(period: CommentPeriod, providers: Provider[] = []): HTMLElement {
    track = vi.fn();
    setupDemiApi([
      ...route(),
      { provide: AnalyticsService, useValue: { track } },
      { provide: CommentPeriodService, useValue: { getById: () => of(period) } },
      // A synchronous answer would run detectChanges inside the constructor; the list is not under test.
      { provide: CommentService, useValue: { getByPeriodId: () => NEVER } },
      ...providers,
    ]);
    const fixture = TestBed.createComponent(CommentsComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function closedPeriod(fields: object = {}): CommentPeriod {
    return openPeriod({
      dateStarted: new Date(Date.now() - 30 * DAY).toISOString(),
      dateCompleted: new Date(Date.now() - 2 * DAY).toISOString(),
      ...fields,
    });
  }

  it('shows the period read-only, with no way to submit a comment', () => {
    const el = render(openPeriod());
    expect(el.querySelector('h2')?.textContent).toBe('Public Comment Period is Now Open');
    expect(el.textContent).not.toMatch(/submit/i);
  });

  it('links an ENGAGE period to ENGAGE in a new tab', () => {
    const link = render(openPeriod({ isMet: true, metURL: METURL })).querySelector<HTMLAnchorElement>('a.engage-link');
    expect(link?.getAttribute('href')).toBe(METURL);
    expect(link?.target).toBe('_blank');
    expect(link?.textContent).toContain('Share your thoughts');
  });

  it('records a click on the ENGAGE link', () => {
    const link = render(openPeriod({ isMet: true, metURL: METURL })).querySelector<HTMLAnchorElement>('a.engage-link')!;
    // jsdom cannot open the new tab.
    link.addEventListener('click', e => e.preventDefault());
    link.click();
    expect(track).toHaveBeenCalledExactlyOnceWith('Comment Period Banner Clicked', {
      project_id: 'p1',
      project_name: 'Site C',
      status: 'Open',
      is_met: true,
      destination: 'external_met',
    });
  });

  it('records the period\'s project id for a click when the project carries only a name', () => {
    // Notification routes set the project to a bare name.
    const el = render(openPeriod({ isMet: true, metURL: METURL }), [
      { provide: ProjectService, useValue: { getById: () => of({ name: 'Notice' }) } },
    ]);
    const link = el.querySelector<HTMLAnchorElement>('a.engage-link')!;
    link.addEventListener('click', e => e.preventDefault());
    link.click();
    expect(track).toHaveBeenCalledWith('Comment Period Banner Clicked',
      expect.objectContaining({ project_id: 'period-p1', destination: 'external_met' }));
  });

  it('says comments are not taken here when the period has no ENGAGE page', () => {
    const el = render(openPeriod());
    expect(el.textContent).toContain('Comments are not accepted on this site.');
    expect(el.querySelector('a.engage-link')).toBeNull();
  });

  it('gives no ENGAGE link for a period whose ENGAGE address is not http or https', () => {
    const el = render(openPeriod({ isMet: true, metURL: 'javascript:alert(1)' }));
    expect(el.querySelector('a.engage-link')).toBeNull();
    expect(el.textContent).toContain('Comments are not accepted on this site.');
  });

  it('gives a closed period with no ENGAGE page neither a link nor the not-accepted note', () => {
    const el = render(closedPeriod());
    expect(el.querySelector('h2')?.textContent).toBe('Public Comment Period is Now Closed');
    expect(el.querySelector('a.engage-link')).toBeNull();
    expect(el.textContent).not.toContain('Comments are not accepted on this site.');
  });

  it('links a closed ENGAGE period to view the engagement', () => {
    const link = render(closedPeriod({ isMet: true, metURL: METURL })).querySelector<HTMLAnchorElement>('a.engage-link');
    expect(link?.getAttribute('href')).toBe(METURL);
    expect(link?.textContent).toContain('View Engagement');
  });

  it('keeps instruction formatting but strips script from it', () => {
    // Angular warns when it strips content; the warning is expected here.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = render(openPeriod({ instructions: '<b>Read first</b><img src="x" onerror="alert(1)">' }));
    expect(el.querySelector('#instructions b')?.textContent).toBe('Read first');
    expect(el.querySelector('#instructions img')?.hasAttribute('onerror')).toBe(false);
  });
});

describe('CommentsComponent related documents', () => {
  let httpMock: HttpTestingController;

  afterEach(() => httpMock.verify());

  function renderDocs(): HTMLElement {
    const docs = new Subject<any[]>();
    httpMock = setupDemiApi([
      ...route(),
      { provide: CommentPeriodService, useValue: { getById: () => of(openPeriod({ relatedDocuments: ['doc1'] })) } },
      { provide: CommentService, useValue: { getByPeriodId: () => NEVER } },
      { provide: DocumentService, useValue: { getByMultiId: () => docs } },
    ]);
    const fixture = TestBed.createComponent(CommentsComponent);
    fixture.detectChanges();
    docs.next([{ _id: 'doc1', displayName: 'a.pdf' }]);
    return fixture.nativeElement;
  }

  it('does not scroll the page when Space opens a document', () => {
    const row = renderDocs().querySelector<HTMLElement>('li.clickable-row')!;
    const press = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    row.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    // A failed check keeps the download from leaving a frame and timer behind.
    httpMock.expectOne(DOWNLOAD).flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('hides the file icon ligature from screen readers', () => {
    const icon = renderDocs().querySelector('li.clickable-row i.material-icons');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('CommentsComponent comment count', () => {
  function setup(pages: Subject<any>[]): CommentsComponent {
    let call = 0;
    setupDemiApi([
      ...route(),
      { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
      { provide: CommentPeriodService, useValue: { getById: () => of(openPeriod()) } },
      { provide: CommentService, useValue: { getByPeriodId: () => pages[call++] } },
    ]);
    return TestBed.runInInjectionContext(() => new CommentsComponent());
  }

  function rows(n: number): object[] {
    return Array.from({ length: n }, () => ({}));
  }

  it('counts every row up to the page shown when no total has come back yet', () => {
    const pages = [new Subject<any>(), new Subject<any>()];
    const component = setup(pages);

    component.getPaginatedComments(3);
    pages[1].next({ totalCount: null, currentComments: rows(5) });

    expect(component.tableData().totalListItems).toBe(25);
  });

  it('keeps the known total when an earlier page comes back without one', () => {
    const pages = [new Subject<any>(), new Subject<any>()];
    const component = setup(pages);

    pages[0].next({ totalCount: 25, currentComments: rows(10) });
    component.getPaginatedComments(2);
    pages[1].next({ totalCount: null, currentComments: rows(10) });

    expect(component.tableData().totalListItems).toBe(25);
  });
});
