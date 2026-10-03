import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';
import { NEVER, of } from 'rxjs';

import { CommentsComponent } from './comments.component';
import { ToastService } from '../services/toast.service';
import { CommentPeriod } from '../models/commentperiod';
import { Project } from '../models/project';
import { CommentPeriodService } from '../services/commentperiod.service';
import { CommentService } from '../services/comment.service';
import { ProjectService } from '../services/project.service';
import { SEARCH, setupDemiApi } from '../services/demi-api.spec-helper';

const DOWNLOAD = `${SEARCH}/documents/doc1/download?redirect=1`;

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

  afterEach(() => {
    httpMock.verify();
    frame()?.remove();
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

describe('CommentsComponent for an open period', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const METURL = 'https://engage.eao.gov.bc.ca/site-c';

  function render(fields: object = {}): HTMLElement {
    const period = new CommentPeriod({
      _id: 'cp1',
      project: 'p1',
      dateStarted: new Date(Date.now() - DAY).toISOString(),
      dateCompleted: new Date(Date.now() + 7 * DAY).toISOString(),
      ...fields,
    });
    setupDemiApi([
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ projId: 'p1', commentPeriodId: 'cp1' })) } },
      { provide: Router, useValue: { navigate: vi.fn(), url: '/p/p1/cp/cp1/details' } },
      { provide: ProjectService, useValue: { getById: () => of(new Project({ _id: 'p1', name: 'Site C' })) } },
      { provide: CommentPeriodService, useValue: { getById: () => of(period) } },
      // A synchronous answer would run detectChanges inside the constructor; the list is not under test.
      { provide: CommentService, useValue: { getByPeriodId: () => NEVER } },
    ]);
    const fixture = TestBed.createComponent(CommentsComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows the period read-only, with no way to submit a comment', () => {
    const el = render();
    expect(el.querySelector('h2')?.textContent).toBe('Public Comment Period is Now Open');
    expect(el.textContent).not.toMatch(/submit/i);
  });

  it('links an ENGAGE period to ENGAGE in a new tab', () => {
    const link = render({ isMet: true, metURL: METURL }).querySelector<HTMLAnchorElement>('a.engage-link');
    expect(link?.getAttribute('href')).toBe(METURL);
    expect(link?.target).toBe('_blank');
    expect(link?.textContent).toContain('Share your thoughts');
  });

  it('says comments are not taken here when the period has no ENGAGE page', () => {
    const el = render();
    expect(el.textContent).toContain('Comments are not accepted on this site.');
    expect(el.querySelector('a.engage-link')).toBeNull();
  });

  it('gives no ENGAGE link for a period whose ENGAGE address is not http or https', () => {
    const el = render({ isMet: true, metURL: 'javascript:alert(1)' });
    expect(el.querySelector('a.engage-link')).toBeNull();
    expect(el.textContent).toContain('Comments are not accepted on this site.');
  });
});
